import { IsMongoId, IsString, Length } from 'class-validator';
import {
  charMinLength,
  idLength,
  nameMaxLength,
  titleMaxLength,
} from 'src/config';

import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

/** The Dto file contains the description of the client requests and the server's responses*/
export class CreateSubjectDto {
  @IsString()
  @Length(charMinLength, nameMaxLength)
  @ApiProperty({
    description: 'Name',
    example: 'Math',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @IsString()
  @Length(charMinLength, titleMaxLength)
  @ApiProperty({
    description: 'Description',
    example: 'Matematica 2o anno liceo', // TODO tradurlo in inglese
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  desc: string;
}

export class UpdateSubjectDto extends CreateSubjectDto {
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
  id: string;
}
