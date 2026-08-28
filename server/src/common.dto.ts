import { Filters, nameMaxLength } from './config';
import {
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';
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

export interface BasePaginatedResult<T> {
  count: number;
  data: T[];
}
