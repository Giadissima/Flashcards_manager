import { IsOptional, IsString, Length, Matches } from 'class-validator';
import { charMinLength, descMaxLength, nameMaxLength } from 'src/config';

import { ApiProperty } from '@nestjs/swagger';
import { IsHtmlTextLength } from 'src/common/validators/html-text-length.validator';
import { Trim, TrimHtml } from 'src/common/transform.decorators';

/** The Dto file contains the description of the client requests and the server's responses*/
export class ModifySubjectDto {
  @IsString()
  @Length(charMinLength, nameMaxLength)
  @ApiProperty({
    description: 'Name',
    example: 'Math',
  })
  @Trim()
  name: string;

  @IsString()
  @IsOptional()
  @IsHtmlTextLength(charMinLength, descMaxLength, { allowEmpty: true })
  @ApiProperty({
    description: 'Description',
    example: 'Maths, second year of high school',
  })
  @TrimHtml()
  desc: string;

  @IsString()
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'color must be a hex color in the format #rrggbb',
  })
  @ApiProperty({
    description: 'Background color of the default subject icon',
    example: '#7fa8d9',
    required: false,
  })
  color?: string;
}
