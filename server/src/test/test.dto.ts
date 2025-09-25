import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { idLength } from 'src/config';

export class TestFiltersRequest {
  @IsOptional()
  @IsArray()
  @IsString({ each: true }) // ogni elemento deve essere stringa
  @Length(idLength, idLength, { each: true })
  @Type(() => String)
  @ApiProperty({
    description: 'Array di gruppi (ids) da filtrare',
    required: false,
    type: [String],
  })
  topics?: string[];

  @IsOptional()
  @IsString()
  @Length(idLength, idLength)
  @Type(() => String)
  @ApiProperty({
    description: 'id della materia da filtrare',
    required: false,
    type: String,
  })
  subject?: string;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  @Min(1)
  @ApiProperty({
    description: 'Number of question to display',
    required: false,
    example: 0,
  })
  max_answer?: number;
}
