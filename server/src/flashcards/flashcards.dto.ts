import { IsString, Length } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';

// import { NotFoundError } from "rxjs";

// import configFn from 'src/config/config'
// TODO queste righe cancellate serviranno?
// ? this line import config file without dependecy injection
// const userDto = configFn().userDto;
// if(!userDto) throw new NotFoundError("CONFIG FILE NOT INITIALIZED")

//TODO fixare l'errore che il config non prende i valori dal .env
/** The Dto file contains the description of the client requests and the server's responses*/
export class FlashcardRequestDto {
  @IsString()
  @Length(userDto.usernameMinLenght, userDto.usernameMaxLenght)
  @ApiProperty({
    description: 'Titolo della flashcard',
    example: 'Esercizio addizioni',
  })
  title: string;

  @IsString()
  @Length(userDto.passwordMinLenght, userDto.passwordMaxLenght)
  @ApiProperty({
    description: 'password',
    example: 'changeme'
  })
  password: string;
  /*
  @Prop({ required: true })
    title: string;
  
    @Prop({ required: true })
    question: string;
  
    @Prop({ required: true })
    answer: string;
  
    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: false })
    group: mongoose.Types.ObjectId;
    */
}

export class AuthenticationResponse {
  @ApiProperty({
    description: "Jwt token"
  })
  jwt: string
} 