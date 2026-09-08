import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

import { ReportReason, reportReasons } from './report.schema';
import { Trim } from 'src/common/transform.decorators';
import { charMinLength, descMaxLength } from 'src/config';


/** What somebody says is wrong with a post. */
export class ReportPostDto {
  @IsString()
  @IsIn(reportReasons)
  @ApiProperty({ enum: reportReasons })
  reason: ReportReason;

  @IsOptional()
  @IsString()
  @Length(charMinLength, descMaxLength)
  @Trim()
  @ApiProperty({ description: 'Anything they want to add', required: false })
  note?: string;
}

/** What the reader is told back: enough to see it arrived, and no more. */
export class ReportResult {
  @ApiProperty({ description: 'Open reports on that post, this one included' })
  reports: number;
}

// ------------------------------------------------------- the moderation page

export class AdminLoginDto {
  @IsString()
  @Length(charMinLength, 200)
  @ApiProperty({ description: 'The moderation password of this server' })
  password: string;
}

/** What can be decided about a report, from the page or from the chat. */
export const moderationActions = [
  'keep',
  'remove',
  'warn',
  'ban',
  'restore',
] as const;
export type ModerationAction = (typeof moderationActions)[number];

export class AdminAction {
  @IsString()
  @IsIn(moderationActions)
  @ApiProperty({ enum: moderationActions })
  action: ModerationAction;
}

/** A card of the reported post, as it is, so the page can show it. */
export interface AdminCard {
  _id: string;
  title: string;
  question: string;
  answer: string;
  topic?: string;
}

/** One report with everything needed to decide on it. */
export interface AdminReport {
  reportId: string;
  postId: string;
  authorId: string;
  author: string;
  subject: string;
  reason: ReportReason;
  note?: string;
  reports: number;
  strikes: number;
  hidden: boolean;
  banned: boolean;
  state: string;
  createdAt: Date;
  cards: AdminCard[];
}
