import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { NotificationKind, notificationKinds } from './notification.schema';

import { ApiProperty } from '@nestjs/swagger';
import { BasicFilterRequest } from 'src/common.dto';
import { ToBoolean } from 'src/common/transform.decorators';

/**
 * What the panel asks for. Both filters are optional: with neither, it is the
 * whole list, which is what it opens on.
 */
export class NotificationFilterRequest extends BasicFilterRequest {
  @IsOptional()
  @IsString()
  @IsIn(notificationKinds)
  @ApiProperty({
    description: 'Only this kind of event',
    enum: notificationKinds,
    required: false,
  })
  kind?: NotificationKind;

  @IsOptional()
  @IsBoolean()
  @ToBoolean()
  @ApiProperty({
    description: 'Only the ones not read yet',
    required: false,
  })
  unread?: boolean;
}
