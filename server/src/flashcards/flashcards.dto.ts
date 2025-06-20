import { IsMongoId, IsOptional, IsString, Length } from 'class-validator';
import {
  answerMaxLenght,
  charMinLenght,
  idMaxLenght,
  questionMaxLenght,
  titleMaxLenght,
} from 'src/config';

import { ApiProperty } from '@nestjs/swagger';

// import { NotFoundError } from "rxjs";

// TODO queste righe cancellate serviranno?
// ? this line import config file without dependecy injection
// const userDto = configFn().userDto;
// if(!userDto) throw new NotFoundError("CONFIG FILE NOT INITIALIZED")

//TODO fixare l'errore che il config non prende i valori dal .env
/** The Dto file contains the description of the client requests and the server's responses*/
export class FlashcardRequestDto {
  @IsString()
  @Length(charMinLenght, titleMaxLenght)
  @ApiProperty({
    description: 'Titolo della flashcard',
    example: 'Esercizio addizioni',
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
  @Length(charMinLenght, idMaxLenght)
  @ApiProperty({
    description: 'group id',
    example: 'Operazioni aritmetiche',
  })
  group: string;
}

// export class AuthenticationResponse {
//   @ApiProperty({
//     description: "Jwt token"
//   })
//   jwt: string
// }
