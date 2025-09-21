import { IsMongoId, IsOptional, IsString, Length } from 'class-validator';
import {
  answerMaxLength,
  charMinLength,
  idLength,
  questionMaxLength,
  titleMaxLength,
} from 'src/config';

import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

/** The Dto file contains the description of the client requests and the server's responses*/
export class ModifyFlashcardDto {
  @IsString()
  @Length(charMinLength, titleMaxLength)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title: string;

  @IsString()
  @Length(charMinLength, questionMaxLength)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  question: string;

  @IsString()
  @Length(charMinLength, answerMaxLength)
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
  group_id?: string;

  @IsOptional()
  @IsMongoId()
  @Length(idLength, idLength)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  subject_id?: string;
}
