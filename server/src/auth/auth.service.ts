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
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { User, UserDocument } from './user.schema';

import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import { FileService } from 'src/file/file.service';
import { ModerationService } from 'src/moderation/moderation.service';
import { UniversityService } from 'src/university/university.service';
import { VerificationService } from './verification.service';
import bcrypt from 'bcryptjs';
import { bcryptSaltRounds } from 'src/config';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
    private readonly universityService: UniversityService,
    private readonly fileService: FileService,
    private readonly moderation: ModerationService,
    private readonly verification: VerificationService,
  ) {}

  async register(dto: RegisterDto, ip?: string): Promise<AuthResponse> {
    // Neither an invitation nor a payment: an account still costs a minute.
    // What it does cost is one address that answers, which is what stands
    // between a ban and the same person back an hour later - and the address
    // the ban came from waits a day before it can open the next account.
    if (await this.moderation.signupBlocked(ip)) {
      throw new ForbiddenException(
        'Too many accounts from here lately. Try again tomorrow.',
      );
    }

    this.assertStudyFieldsExist(dto);

    const username = dto.username.toLowerCase();
    if (await this.userModel.exists({ username })) {
      throw new ConflictException('Username already taken');
    }

    const email = dto.email.toLowerCase();
    if (await this.userModel.exists({ email })) {
      // Told apart from a taken username on purpose: the two are fixed in
      // different places, and one message for both would send half the people
      // who meet it to change the wrong field.
      throw new ConflictException({
        code: 'emailTaken',
        message: 'Email already registered',
      });
    }

    const password = await bcrypt.hash(dto.password, bcryptSaltRounds);
    // A unique index still decides it: two registrations of the same name can
    // both pass the check above, and only one of them can reach the database.
    let user: UserDocument;
    try {
      user = await this.userModel.create({
        username,
        email,
        password,
        universityCode: dto.universityCode,
        course: dto.course,
        courseKind: dto.courseKind,
        signupIp: ip,
      });
    } catch (error) {
      // A unique index still decides both, and it says which one it was.
      if ((error as { code?: number }).code === 11000) {
        const key = (error as { keyPattern?: Record<string, unknown> })
          .keyPattern;
        if (key && 'email' in key) {
          throw new ConflictException({
            code: 'emailTaken',
            message: 'Email already registered',
          });
        }
        throw new ConflictException('Username already taken');
      }
      throw error;
    }

    // After the account exists, and never in its way: a mail that does not go
    // out leaves somebody logged in with a button to ask for it again, while a
    // failure here would leave them with nothing.
    await this.verification.send(user);

    return this.buildResponse(user);
  }

  /** Asks for the confirmation mail again, for the account that is asking. */
  async resendVerification(payload: JwtPayload): Promise<void> {
    await this.verification.resend(payload.sub);
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
    avatar?: Express.Multer.File,
  ): Promise<PublicUser> {
    this.assertStudyFieldsExist(dto);

    const user = await this.userModel.findById(payload.sub).exec();
    if (!user) throw new UnauthorizedException('User no longer exists');

    if (dto.username) await this.renameTo(user, dto.username);

    user.universityCode = dto.universityCode;
    user.course = dto.course;
    user.courseKind = dto.courseKind;
    user.avatarColor = dto.avatarColor;

    // Read before the change, dropped only once the save went through
    const previousAvatar = user.avatar;
    if (avatar) {
      user.avatar = String((await this.fileService.create([avatar]))._id);
    } else if (dto.removeAvatar) {
      user.avatar = undefined;
    }

    await user.save();

    if (previousAvatar && previousAvatar !== user.avatar) {
      await this.fileService.delete(previousAvatar);
    }

    return this.toPublicUser(user);
  }

  /**
   * Renames the user, unless the name is taken. Nothing else has to move: the
   * token is signed with the id and every reference goes through it, which is
   * the whole reason the username can be changed at all.
   */
  private async renameTo(user: UserDocument, username: string): Promise<void> {
    const wanted = username.toLowerCase();
    if (wanted === user.username) return;

    const taken = await this.userModel.exists({ username: wanted });
    if (taken) throw new ConflictException('Username already taken');
    user.username = wanted;
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
      avatar: user.avatar,
      avatarColor: user.avatarColor,
      email: user.email,
      // An account from before the field existed has nothing to confirm, so it
      // counts as confirmed: the alternative is locking out everybody who
      // registered first.
      emailVerified: !user.email || !!user.emailVerifiedAt,
    };
  }
}
