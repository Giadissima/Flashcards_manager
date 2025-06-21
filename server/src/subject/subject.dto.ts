import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';
import { charMinLenght, nameMaxLenght, titleMaxLenght } from 'src/config';

/** The Dto file contains the description of the client requests and the server's responses*/
export class CreateSubjectDto {
  @IsString()
  @Length(charMinLenght, nameMaxLenght)
  @ApiProperty({
    description: 'Name',
    example: 'Math',
  })
  name: string;

  @IsString()
  @Length(charMinLenght, titleMaxLenght)
  @ApiProperty({
    description: 'Description',
    example: 'Matematica 2o anno liceo', // TODO tradurlo in inglese
  })
  desc: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({
    description: 'icon',
    example: null,
  })
  icon: string; // TODO vedere da input come viene inviato il dato e metterci dei controlli
}
