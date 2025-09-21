import { Filters, idLength, nameMaxLength } from './config';
import { IsIn, IsMongoId, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Types } from 'mongoose';

export class FilterRequest {
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
    description: 'Filter by subject ID',
    required: false,
  })
  group_id?: string;
}

export interface BasePaginatedResult<T> {
  count: number;
  data: T[];
}

export function validateObjectIdParam(id: string) {
  return (
    typeof id === 'string' &&
    id.length == idLength &&
    Types.ObjectId.isValid(id)
  );
}

export function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
