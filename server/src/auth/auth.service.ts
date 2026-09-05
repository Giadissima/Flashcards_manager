import { AuthResponse, JwtPayload, LoginDto, PublicUser, RegisterDto } from './auth.dto';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { User, UserDocument } from './user.schema';

import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { bcryptSaltRounds } from 'src/config';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const username = dto.username.toLowerCase();
    if (await this.userModel.exists({ username })) {
      throw new ConflictException('Username already taken');
    }

    const password = await bcrypt.hash(dto.password, bcryptSaltRounds);
    // A unique index still decides it: two registrations of the same name can
    // both pass the check above, and only one of them can reach the database.
    let user: UserDocument;
    try {
      user = await this.userModel.create({ username, password });
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

  private toPublicUser(user: UserDocument): PublicUser {
    return { _id: String(user._id), username: user.username };
  }
}
