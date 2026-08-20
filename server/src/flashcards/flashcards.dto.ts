import { ApiProperty, OmitType, PickType } from '@nestjs/swagger';
import {
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  answerMaxLength,
  charMinLength,
  idLength,
  questionMaxLength,
  titleMaxLength,
} from 'src/config';

import { BasicFilterRequest } from 'src/common.dto';
import { IsHtmlTextLength } from 'src/common/validators/html-text-length.validator';

/** The Dto file contains the description of the client requests and the server's responses*/
export class ModifyFlashcardDto {
  @IsString()
  @Length(charMinLength, titleMaxLength)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title: string;

  @IsString()
  @IsHtmlTextLength(charMinLength, questionMaxLength)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  question: string;

  @IsString()
  @IsHtmlTextLength(charMinLength, answerMaxLength)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  answer: string;

  @IsOptional()
  @IsMongoId()
  @Length(idLength, idLength)
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim() || undefined // "" diventa undefined
      : value,
  )
  topic_id?: string;

  @IsOptional()
  @IsMongoId()
  @Length(idLength, idLength)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  subject_id?: string;
}

export class FlashcardFilterDTO extends BasicFilterRequest {
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

export class RandomFlashcardsDTO {
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
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000, { message: 'Non puoi richiedere più di 1000 domande in un singolo test.' })
  @ApiProperty({
    description: 'Number of flashcard requested',
    required: false,
  })
  numFlashcard?: number = 10;
}

export class CountFlashcardsDTO {
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
}
