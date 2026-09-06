import { Controller, Get, Param, Patch, Query } from '@nestjs/common';

import { ApiOperation } from '@nestjs/swagger';
import { BasePaginatedResult } from 'src/common.dto';
import { NotificationFilterRequest } from './notification.dto';
import { CurrentUser } from 'src/auth/current-user.decorator';
import { JwtPayload } from 'src/auth/auth.dto';
import { Notification } from './notification.schema';
import { NotificationService } from './notification.service';

@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @ApiOperation({ description: 'the notifications of the logged user' })
  @Get()
  findMine(
    @CurrentUser() user: JwtPayload,
    @Query() filters: NotificationFilterRequest,
  ): Promise<BasePaginatedResult<Notification>> {
    return this.notificationService.findMine(user.sub, filters);
  }

  @ApiOperation({
    description: 'how many are unread, for the badge on the bell',
  })
  @Get('unread-count')
  countUnread(@CurrentUser() user: JwtPayload): Promise<number> {
    return this.notificationService.countUnread(user.sub);
  }

  @ApiOperation({ description: 'mark every notification as read' })
  @Patch('read')
  markAllRead(@CurrentUser() user: JwtPayload): Promise<void> {
    return this.notificationService.markRead(user.sub);
  }

  @ApiOperation({ description: 'mark one notification as read' })
  @Patch(':id/read')
  markRead(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<void> {
    return this.notificationService.markRead(user.sub, id);
  }
}
