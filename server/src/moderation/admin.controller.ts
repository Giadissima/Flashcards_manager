import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import { timingSafeEqual } from 'node:crypto';

import { AdminGuard } from './admin.guard';
import { AdminAction, AdminLoginDto, AdminReport, ModerationAction } from './moderation.dto';
import { ModerationService, Verdict } from './moderation.service';
import { Public } from 'src/auth/public.decorator';
import { adminSessionHours, rateLimits } from 'src/config';

/**
 * The moderation page behind the reports.
 *
 * A page rather than four buttons in a chat, because deciding needs the thing
 * itself: the post as its readers see it, every card, every picture. The chat
 * says something arrived and links here; this is where it is looked at.
 */
@Controller('admin')
export class AdminController {
  constructor(
    private readonly moderation: ModerationService,
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  @ApiOperation({ description: 'exchange the moderation password for a token' })
  @Public()
  @Throttle({ all: rateLimits.login })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: AdminLoginDto): Promise<{ token: string }> {
    const expected = this.config.get<string>('ADMIN_PASSWORD') ?? '';

    // Nothing to let anybody in with: better said plainly than as a wrong
    // password, which would have somebody trying the same thing all evening.
    if (!expected) {
      throw new ServiceUnavailableException(
        'No moderation password is set on this server',
      );
    }

    if (!same(dto.password, expected)) {
      throw new UnauthorizedException('Wrong password');
    }

    return {
      token: await this.jwtService.signAsync(
        { admin: true },
        { expiresIn: `${adminSessionHours}h` },
      ),
    };
  }

  @ApiOperation({ description: 'every report, the undecided ones first' })
  @Public()
  @UseGuards(AdminGuard)
  @Get('reports')
  reports(): Promise<AdminReport[]> {
    return this.moderation.reviews();
  }

  @ApiOperation({ description: 'one report, with the post it is about' })
  @Public()
  @UseGuards(AdminGuard)
  @Get('reports/:id')
  report(@Param('id') id: string): Promise<AdminReport | null> {
    return this.moderation.review(id);
  }

  @ApiOperation({ description: 'decide what happens to a reported post' })
  @Public()
  @UseGuards(AdminGuard)
  @Post('reports/:id/act')
  @HttpCode(HttpStatus.OK)
  act(
    @Param('id') id: string,
    @Body() dto: AdminAction,
  ): Promise<Verdict> {
    return this.moderation.act(id, dto.action as ModerationAction);
  }

  @ApiOperation({ description: 'give an account everything back' })
  @Public()
  @UseGuards(AdminGuard)
  @Post('users/:username/pardon')
  @HttpCode(HttpStatus.OK)
  pardon(@Param('username') username: string): Promise<Verdict> {
    return this.moderation.pardon(username);
  }
}

/**
 * Compared without letting the time it takes say how much was right.
 *
 * A plain !== answers faster the sooner it finds a difference, which over
 * enough tries is the password one letter at a time.
 */
function same(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    // Still compared, so the answer takes the same time either way
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}
