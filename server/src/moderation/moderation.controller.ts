import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { rateLimits } from 'src/config';

import { CurrentUser } from 'src/auth/current-user.decorator';
import { JwtPayload } from 'src/auth/auth.dto';
import { ModerationService } from './moderation.service';
import { ReportPostDto, ReportResult } from './moderation.dto';
import { TelegramService } from './telegram.service';

/**
 * Reporting lives under the post it is about, which is where a reader looks
 * for it - the moderation of it lives in this module, which is why the route
 * is declared here and not among the rest of the post's own.
 */
@Controller('post')
export class ModerationController {
  constructor(
    private readonly moderation: ModerationService,
    private readonly telegram: TelegramService,
  ) {}

  @ApiOperation({
    description: 'report a post; enough reports take it out of the feed',
  })
  @Throttle({ all: rateLimits.write })
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

    // Sent from here rather than from the service, so that the domain does not
    // depend on a chat app being reachable: a report is filed whether or not
    // anybody is listening on the other side.
    const summary = await this.moderation.summarise(filed.reportId);
    if (summary) await this.telegram.announce(summary);

    return { reports: filed.reports };
  }

  @ApiOperation({
    description: 'report a comment; enough reports take it out of the thread',
  })
  @Throttle({ all: rateLimits.write })
  @Post('comments/:id/report')
  async reportComment(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ReportPostDto,
  ): Promise<ReportResult> {
    const filed = await this.moderation.reportComment(
      user.sub,
      id,
      dto.reason,
      dto.note,
    );

    const summary = await this.moderation.summarise(filed.reportId);
    if (summary) await this.telegram.announce(summary);

    return { reports: filed.reports };
  }

  @ApiOperation({
    description: 'report one message in a private feedback exchange',
  })
  @Throttle({ all: rateLimits.write })
  @Post('feedback/:id/messages/:messageId/report')
  async reportFeedbackMessage(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Body() dto: ReportPostDto,
  ): Promise<ReportResult> {
    const filed = await this.moderation.reportFeedbackMessage(
      user.sub,
      id,
      messageId,
      dto.reason,
      dto.note,
    );

    const summary = await this.moderation.summarise(filed.reportId);
    if (summary) await this.telegram.announce(summary);

    return { reports: filed.reports };
  }
}
