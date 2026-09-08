import {
  AuthResponse,
  JwtPayload,
  LoginDto,
  PublicUser,
  RegisterDto,
  UpdateProfileDto,
} from './auth.dto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';

import { ApiBody, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { rateLimits } from 'src/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ description: 'create a new user and return its access token' })
  @Public()
  @Throttle({ all: rateLimits.register })
  @Post('register')
  register(
    @Body() registerDto: RegisterDto,
    @Ip() ip: string,
  ): Promise<AuthResponse> {
    // The address comes from Express, which reads it through however many
    // proxies are trusted (see main.ts): behind a reverse proxy the socket
    // always says the proxy, and blocking that would block everybody.
    return this.authService.register(registerDto, ip);
  }

  @ApiOperation({ description: 'exchange username and password for an access token' })
  @Public()
  @Throttle({ all: rateLimits.login })
  @Post('login')
  @HttpCode(HttpStatus.OK) // a login creates nothing, so 201 would be misleading
  login(@Body() loginDto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(loginDto);
  }

  @ApiOperation({
    description:
      'get the user the bearer token belongs to, as the database knows it now',
  })
  @Get('me')
  me(@CurrentUser() user: JwtPayload): Promise<PublicUser> {
    return this.authService.findMe(user);
  }

  @ApiOperation({
    description:
      'replace the study fields of the logged user; a field left out is cleared',
  })
  @Patch('me')
  @UseInterceptors(FileInterceptor('avatar'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        username: { type: 'string', example: 'giada' },
        universityCode: { type: 'string', example: '00101' },
        course: { type: 'string', example: 'Informatica' },
        courseKind: { type: 'string', example: 'Laurea' },
        avatarColor: { type: 'string', example: '#a294f9' },
        removeAvatar: { type: 'boolean' },
        avatar: {
          type: 'string',
          format: 'binary',
          description: 'Picture to use instead of the default drawing',
        },
      },
    },
  })
  updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() updateProfileDto: UpdateProfileDto,
    @UploadedFile() avatar?: Express.Multer.File,
  ): Promise<PublicUser> {
    return this.authService.updateProfile(user, updateProfileDto, avatar);
  }
}
