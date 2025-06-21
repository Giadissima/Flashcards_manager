import { Filters, nameMaxLength } from './config';
import { IsIn, IsString, Max, Min } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

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
  @Max(nameMaxLength)
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

export interface BasePaginatedResult<T> {
  count: number;
  result: T[];
}
