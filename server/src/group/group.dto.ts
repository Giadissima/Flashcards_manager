import { IsMongoId, IsOptional, IsString, Length } from 'class-validator';
import { charMinLenght, idLenght, nameMaxLenght } from 'src/config';

import { ApiProperty } from '@nestjs/swagger';

/** The Dto file contains the description of the client requests and the server's responses*/
export class CreateGroupDto {
  @IsString()
  @Length(charMinLenght, nameMaxLenght)
  @ApiProperty({
    description: 'Name',
    example: 'Operazioni Aritmetiche',
  })
  name: string;

  @IsString()
  @ApiProperty({
    description: 'color',
    example: '#CDCDCD',
  })
  color: string; // TODO vedere da input come viene inviato il dato e metterci dei controlli

  @IsOptional() // TODO togliere l'opzionale, un argomento è sempre connesso a una materia
  @IsMongoId()
  @Length(idLenght, idLenght)
  @ApiProperty({
    description: 'subject id',
    example: null,
  })
  subject_id: string;
}
