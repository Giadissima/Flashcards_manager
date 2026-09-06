import { Filters, nameMaxLength } from './config';
import {
  IsDateString,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';
import { Visibility, visibilities } from './common/visibility';
import { Type } from 'class-transformer';

export class BasicFilterRequest{
  @Type(() => Number)
  @Min(Filters.skipMinLength)
  @ApiProperty({
    description: 'Number of document to skip (already seen)',
    required: true,
    example: 0,
  })
  skip: number;

  @Type(() => Number)
  @Min(Filters.limitMinLength)
  @Max(Filters.limitMaxLength)
  @ApiProperty({
    description: 'Number of document to display',
    required: true,
    example: 10,
  })
  limit: number;

  @IsString()
  @MaxLength(nameMaxLength)
  @ApiProperty({
    description: 'field name to select the sorting method',
    required: true,
    example: '_id',
    default: '_id',
  })
  sortField: string;

  @IsString()
  @IsIn(['asc', 'desc'])
  @ApiProperty({
    description: 'sorting direction (ascendant or descendant)',
    required: true,
    example: 'desc',
    default: 'desc',
  })
  sortDirection: string;
}

/**
 * Query string accepted by every paginated list endpoint (flashcards, topics,
 * subjects). Declared once here instead of being borrowed from another
 * module's DTO: with forbidNonWhitelisted enabled this class *is* the contract
 * of those endpoints, so it belongs where all three can see it.
 */
export class ListFilterRequest extends BasicFilterRequest {
  @IsOptional()
  @IsMongoId()
  @ApiProperty({
    description: 'Filter by subject ID',
    required: false,
  })
  subject_id?: string;

  @IsOptional()
  @IsMongoId()
  @ApiProperty({
    description: 'Filter by topic ID',
    required: false,
  })
  topic_id?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'Search a title',
    required: false,
  })
  title?: string;
}

/**
 * The two ends of a date range, both optional and both taken as whole days.
 *
 * Its own class rather than two more fields on the shared list filter: the
 * three lists that offer a range - flashcards, tests, the feed - have nothing
 * else in common, and the lists that do not offer one have to go on refusing
 * the two parameters, which is what forbidNonWhitelisted is there for.
 */
export class DateRangeRequest {
  @IsOptional()
  @IsDateString()
  @ApiProperty({
    description: 'Only what is dated on this day or after it (YYYY-MM-DD)',
    required: false,
    example: '2026-01-01',
  })
  from?: string;

  @IsOptional()
  @IsDateString()
  @ApiProperty({
    description: 'Only what is dated on this day or before it (YYYY-MM-DD)',
    required: false,
    example: '2026-12-31',
  })
  to?: string;
}

export interface BasePaginatedResult<T> {
  count: number;
  data: T[];
}

/**
 * The whole body of the quick toggle in the lists. The full Modify*Dto cannot
 * serve here: it requires every field of the entity, which a list does not
 * hold - and for a flashcard would mean sending the question and answer HTML
 * back and forth just to flip a flag.
 */
export class SetVisibilityDto {
  @IsIn(visibilities)
  @ApiProperty({ enum: visibilities, example: 'public' })
  visibility: Visibility;
}
