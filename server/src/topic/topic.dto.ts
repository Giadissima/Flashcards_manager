import { IsIn, IsMongoId, IsOptional, IsString, Length } from 'class-validator';
import { charMinLength, idLength, nameMaxLength } from 'src/config';

import { ApiProperty } from '@nestjs/swagger';
import { Visibility, visibilities } from 'src/common/visibility';
import { Trim, TrimToUndefined } from 'src/common/transform.decorators';

/** The Dto file contains the description of the client requests and the server's responses*/
export class ModifyTopicDto {
  @IsString()
  @Length(charMinLength, nameMaxLength)
  @ApiProperty({
    description: 'Name',
    example: 'Operazioni Aritmetiche',
  })
  @Trim()
  name: string;

  @IsString()
  @ApiProperty({
    description: 'color',
    example: '#CDCDCD',
  })
  @Trim()
  color: string; // TODO check how the value arrives from the input and validate it

  @IsOptional()
  @IsMongoId()
  @Length(idLength, idLength)
  @ApiProperty({
    description: 'subject id',
    example: null,
  })
  @TrimToUndefined()
  subject_id: string;

  @IsOptional()
  @IsIn(visibilities)
  @ApiProperty({
    description: 'Who may see it; defaults to private when left out',
    enum: visibilities,
    required: false,
  })
  visibility?: Visibility;

}
