import { IsMongoId, IsOptional, IsString, Length } from 'class-validator';
import { charMinLength, idLength, nameMaxLength } from 'src/config';

import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

/** The Dto file contains the description of the client requests and the server's responses*/
export class CreateGroupDto {
  @IsString()
  @Length(charMinLength, nameMaxLength)
  @ApiProperty({
    description: 'Name',
    example: 'Operazioni Aritmetiche',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @IsString()
  @ApiProperty({
    description: 'color',
    example: '#CDCDCD',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  color: string; // TODO vedere da input come viene inviato il dato e metterci dei controlli

  @IsMongoId()
  @Length(idLength, idLength)
  @ApiProperty({
    description: 'subject id',
    example: null,
  })
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim() || undefined // "" diventa undefined
      : value,
  )
  subject_id: string;
}

export class UpdateGroupDto extends CreateGroupDto {
  @IsMongoId()
  @Length(idLength, idLength)
  @ApiProperty({
    description: 'Group id',
    example: null,
  })
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim() || undefined // "" diventa undefined
      : value,
  )
  id: string;
}
