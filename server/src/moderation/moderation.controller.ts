import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

import { CurrentUser } from 'src/auth/current-user.decorator';
import { JwtPayload } from 'src/auth/auth.dto';
import { ModerationService } from './moderation.service';
import { ReportPostDto, ReportResult } from './moderation.dto';

/**
 * Reporting lives under the post it is about, which is where a reader looks
 * for it - the moderation of it lives in this module, which is why the route
 * is declared here and not among the rest of the post's own.
 */
@Controller('post')
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @ApiOperation({
    description: 'report a post; enough reports take it out of the feed',
  })
  @Post(':id/report')
  async report(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ReportPostDto,
  ): Promise<ReportResult> {
    const filed = await this.moderation.report(
      user.sub,
      id,
      dto.reason,
      dto.note,
    );

    return { reports: filed.reports };
  }
}
