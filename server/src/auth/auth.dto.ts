import { IsOptional, IsString, Length, Matches } from 'class-validator';
import {
  charMinLength,
  courseMaxLength,
  nameMaxLength,
  passwordMaxLength,
  passwordMinLength,
  usernameMaxLength,
} from 'src/config';

import { ApiProperty } from '@nestjs/swagger';
import { IntersectionType } from '@nestjs/mapped-types';
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

/**
 * Where the user studies. Asked for at registration and editable afterwards on
 * the profile page, so the fields are declared once and shared by both.
 *
 * Shape only: that the code names a real university, and that the course
 * belongs to it, is checked by AuthService against UniversityService - the
 * list lives there and a DTO cannot reach it.
 */
export class StudyFieldsDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{5}$/, {
    message: 'universityCode must be the five digit ministry code',
  })
  @ApiProperty({
    description: 'Ministry code of the university, from GET /university',
    example: '00101',
    required: false,
  })
  universityCode?: string;

  @IsOptional()
  @IsString()
  @Length(charMinLength, courseMaxLength)
  @ApiProperty({
    description: 'Degree course, only accepted together with universityCode',
    example: 'Informatica',
    required: false,
  })
  @Trim()
  course?: string;

  @IsOptional()
  @IsString()
  @Length(charMinLength, nameMaxLength)
  @ApiProperty({
    description: 'Level of the course, required whenever course is given',
    example: 'Laurea Magistrale',
    required: false,
  })
  @Trim()
  courseKind?: string;
}

export class RegisterDto extends IntersectionType(LoginDto, StudyFieldsDto) {
  // Letters, digits, dot, dash and underscore: a username also shows up in the
  // interface, so anything else is refused instead of being escaped everywhere.
  @Matches(/^[A-Za-z0-9._-]+$/, {
    message:
      'username can only contain letters, digits, dots, dashes and underscores',
  })
  declare username: string;

}

/**
 * The profile form sends the whole study block every time, so this is a
 * replacement and not a merge: a field left out is a field cleared.
 */
export class UpdateProfileDto extends StudyFieldsDto {}

export interface AuthResponse {
  access_token: string;
  user: PublicUser;
}

/** The user as the client is allowed to see it: never the password hash. */
export interface PublicUser {
  _id: string;
  username: string;
  universityCode?: string;
  course?: string;
  courseKind?: string;
}

/** What is signed into the JWT, and what the guard puts back on the request. */
export interface JwtPayload {
  sub: string;
  username: string;
}
