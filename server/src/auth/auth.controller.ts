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
  Patch,
  Post,
} from '@nestjs/common';

import { ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ description: 'create a new user and return its access token' })
  @Public()
  @Post('register')
  register(@Body() registerDto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(registerDto);
  }

  @ApiOperation({ description: 'exchange username and password for an access token' })
  @Public()
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
  updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<PublicUser> {
    return this.authService.updateProfile(user, updateProfileDto);
  }
}
