import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  answerMaxLength,
  charMinLength,
  idLength,
  questionMaxLength,
  titleMaxLength,
} from 'src/config';

import { IsHtmlTextLength } from 'src/common/validators/html-text-length.validator';
import { Trim, TrimToUndefined } from 'src/common/transform.decorators';

/** The Dto file contains the description of the client requests and the server's responses*/
export class ModifyFlashcardDto {
  @IsString()
  @Length(charMinLength, titleMaxLength)
  @Trim()
  title: string;

  @IsString()
  @IsHtmlTextLength(charMinLength, questionMaxLength)
  @Trim()
  question: string;

  @IsString()
  @IsHtmlTextLength(charMinLength, answerMaxLength)
  @Trim()
  answer: string;

  @IsOptional()
  @IsMongoId()
  @Length(idLength, idLength)
  @TrimToUndefined()
  topic_id?: string;

  @IsOptional()
  @IsMongoId()
  @Length(idLength, idLength)
  @TrimToUndefined()
  subject_id?: string;
}

/** Subject/topic filters shared by the "count" and "random" endpoints. */
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

export class RandomFlashcardsDTO extends CountFlashcardsDTO {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000, {
    message: 'Non puoi richiedere più di 1000 domande in un singolo test.',
  })
  @ApiProperty({
    description: 'Number of flashcard requested',
    required: false,
  })
  numFlashcard?: number = 10;
}
