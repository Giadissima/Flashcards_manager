import { IsMongoId, IsOptional, IsString, Length } from 'class-validator';
import {
  answerMaxLength,
  charMinLength,
  idLength,
  questionMaxLength,
  titleMaxLength,
} from 'src/config';

import { ApiProperty } from '@nestjs/swagger';

/** The Dto file contains the description of the client requests and the server's responses*/
export class CreateFlashcardDto {
  @IsString()
  @Length(charMinLength, titleMaxLength)
  @ApiProperty({
    description: 'Title',
    example: 'Esercizio addizioni', // TODO tradurlo in inglese
  })
  title: string;

  @IsString()
  @Length(charMinLength, questionMaxLength)
  @ApiProperty({
    description: 'question',
    example: 'Quanto fa 2+2?',
  })
  question: string;

  @IsString()
  @Length(charMinLength, answerMaxLength)
  @ApiProperty({
    description: 'answer',
    example: '2+2=4',
  })
  answer: string;

  @IsOptional()
  @IsMongoId()
  @Length(idLength, idLength)
  @ApiProperty({
    description: 'group id',
    example: null,
  })
  group_id: string;
}

export class UpdateFlashcardDto extends CreateFlashcardDto {
  @IsMongoId()
  @Length(idLength, idLength)
  @ApiProperty({
    description: 'Group id',
    example: null,
  })
  id: string;
}
