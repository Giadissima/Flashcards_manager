import {
  AuthResponse,
  JwtPayload,
  LoginDto,
  PublicUser,
  RegisterDto,
  StudyFieldsDto,
  UpdateProfileDto,
} from './auth.dto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { User, UserDocument } from './user.schema';

import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import { UniversityService } from 'src/university/university.service';
import bcrypt from 'bcryptjs';
import { bcryptSaltRounds } from 'src/config';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
    private readonly universityService: UniversityService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    this.assertStudyFieldsExist(dto);

    const username = dto.username.toLowerCase();
    if (await this.userModel.exists({ username })) {
      throw new ConflictException('Username already taken');
    }

    const password = await bcrypt.hash(dto.password, bcryptSaltRounds);
    // A unique index still decides it: two registrations of the same name can
    // both pass the check above, and only one of them can reach the database.
    let user: UserDocument;
    try {
      user = await this.userModel.create({
        username,
        password,
        universityCode: dto.universityCode,
        course: dto.course,
        courseKind: dto.courseKind,
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException('Username already taken');
      }
      throw error;
    }

    return this.buildResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.userModel
      .findOne({ username: dto.username.toLowerCase() })
      .exec();

    // The same message either way, so the answer never says whether the
    // username exists.
    const invalid = new UnauthorizedException('Wrong username or password');
    if (!user) throw invalid;
    if (!(await bcrypt.compare(dto.password, user.password))) throw invalid;

    return this.buildResponse(user);
  }

  /**
   * The caller as the database knows it now: the token only carries what it was
   * signed with, which can be out of date by the time it is used.
   */
  async findMe(payload: JwtPayload): Promise<PublicUser> {
    const user = await this.userModel.findById(payload.sub).exec();
    if (!user) throw new UnauthorizedException('User no longer exists');
    return this.toPublicUser(user);
  }

  private async buildResponse(user: UserDocument): Promise<AuthResponse> {
    const payload: JwtPayload = {
      sub: String(user._id),
      username: user.username,
    };
    return {
      access_token: await this.jwtService.signAsync(payload),
      user: this.toPublicUser(user),
    };
  }

  /**
   * The DTO can only check the shape of the two study fields; whether they name
   * something real is decided here, where the reference lists are reachable.
   */
  /**
   * Replaces the study block of the logged user. The profile form always sends
   * the whole of it, so a field left out means "cleared" rather than
   * "unchanged" - assigning undefined is what drops it from the document.
   */
  async updateProfile(
    payload: JwtPayload,
    dto: UpdateProfileDto,
  ): Promise<PublicUser> {
    this.assertStudyFieldsExist(dto);

    const user = await this.userModel.findById(payload.sub).exec();
    if (!user) throw new UnauthorizedException('User no longer exists');

    user.universityCode = dto.universityCode;
    user.course = dto.course;
    user.courseKind = dto.courseKind;
    await user.save();

    return this.toPublicUser(user);
  }

  private assertStudyFieldsExist(dto: StudyFieldsDto): void {
    const { universityCode, course, courseKind } = dto;

    if (course && !universityCode) {
      throw new BadRequestException(
        'A course cannot be given without its university',
      );
    }
    if (!!course !== !!courseKind) {
      throw new BadRequestException(
        'A course and its level have to be given together',
      );
    }
    if (universityCode && !this.universityService.exists(universityCode)) {
      throw new BadRequestException(`Unknown university code ${universityCode}`);
    }
    if (
      universityCode &&
      course &&
      courseKind &&
      !this.universityService.hasCourse(universityCode, course, courseKind)
    ) {
      throw new BadRequestException(
        'That course does not belong to the chosen university',
      );
    }
  }

  private toPublicUser(user: UserDocument): PublicUser {
    return {
      _id: String(user._id),
      username: user.username,
      universityCode: user.universityCode,
      course: user.course,
      courseKind: user.courseKind,
    };
  }
}
