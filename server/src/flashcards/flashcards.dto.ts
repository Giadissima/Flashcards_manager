import { IsMongoId, IsOptional, IsString, Length } from 'class-validator';
import {
  answerMaxLenght,
  charMinLenght,
  idLenght,
  questionMaxLenght,
  titleMaxLenght,
} from 'src/config';

import { ApiProperty } from '@nestjs/swagger';

/** The Dto file contains the description of the client requests and the server's responses*/
export class FlashcardRequestDto {
  @IsString()
  @Length(charMinLenght, titleMaxLenght)
  @ApiProperty({
    description: 'Title',
    example: 'Esercizio addizioni', // TODO tradurlo in inglese
  })
  title: string;

  @IsString()
  @Length(charMinLenght, questionMaxLenght)
  @ApiProperty({
    description: 'question',
    example: 'Quanto fa 2+2?',
  })
  question: string;

  @IsString()
  @Length(charMinLenght, answerMaxLenght)
  @ApiProperty({
    description: 'answer',
    example: '2+2=4',
  })
  answer: string;

  @IsOptional()
  @IsMongoId()
  @Length(idLenght, idLenght)
  @ApiProperty({
    description: 'group id',
    example: null,
  })
  group_id: string;
}

// export class AuthenticationResponse {
//   @ApiProperty({
//     description: "Jwt token"
//   })
//   jwt: string
// }
