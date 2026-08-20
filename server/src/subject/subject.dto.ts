import { IsOptional, IsString, Length, Matches } from 'class-validator';
import {
  charMinLength,
  nameMaxLength,
  descMaxLength,
} from 'src/config';

import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsHtmlTextLength } from 'src/common/validators/html-text-length.validator';

/** The Dto file contains the description of the client requests and the server's responses*/
export class ModifySubjectDto {
  @IsString()
  @Length(charMinLength, nameMaxLength)
  @ApiProperty({
    description: 'Name',
    example: 'Math',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @IsString()
  @IsOptional()
  @IsHtmlTextLength(charMinLength, descMaxLength, { allowEmpty: true })
  @ApiProperty({
    description: 'Description',
    example: 'Matematica 2o anno liceo', // TODO tradurlo in inglese
  })
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    // un editor TipTap vuoto produce "<p></p>": lo si normalizza a stringa
    // vuota invece di salvare markup senza contenuto reale
    const textOnly = trimmed.replace(/<[^>]*>/g, '').trim();
    return textOnly.length > 0 ? trimmed : '';
  })
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
