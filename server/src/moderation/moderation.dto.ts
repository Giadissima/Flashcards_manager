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

