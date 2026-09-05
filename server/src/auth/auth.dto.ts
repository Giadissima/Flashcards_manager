import { IsString, Length, Matches } from 'class-validator';
import {
  charMinLength,
  passwordMaxLength,
  passwordMinLength,
  usernameMaxLength,
} from 'src/config';

import { ApiProperty } from '@nestjs/swagger';
import { Trim } from 'src/common/transform.decorators';

/** The Dto file contains the description of the client requests and the server's responses*/
export class LoginDto {
  @IsString()
  @Length(charMinLength, usernameMaxLength)
  @ApiProperty({
    description: 'Username',
    example: 'giada',
  })
  @Trim()
  username: string;

  @IsString()
  @Length(passwordMinLength, passwordMaxLength)
  @ApiProperty({
    description: 'Password',
    example: 'password123',
  })
  password: string;
}

export class RegisterDto extends LoginDto {
  // Letters, digits, dot, dash and underscore: a username also shows up in the
  // interface, so anything else is refused instead of being escaped everywhere.
  @Matches(/^[A-Za-z0-9._-]+$/, {
    message:
      'username can only contain letters, digits, dots, dashes and underscores',
  })
  declare username: string;
}

export interface AuthResponse {
  access_token: string;
  user: PublicUser;
}

/** The user as the client is allowed to see it: never the password hash. */
export interface PublicUser {
  _id: string;
  username: string;
}

/** What is signed into the JWT, and what the guard puts back on the request. */
export interface JwtPayload {
  sub: string;
  username: string;
}
