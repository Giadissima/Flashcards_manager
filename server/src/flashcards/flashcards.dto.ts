import { ApiProperty, IntersectionType } from '@nestjs/swagger';
import { DateRangeRequest, ListFilterRequest } from 'src/common.dto';
import { Visibility, visibilities } from 'src/common/visibility';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsMongoId,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  answerMaxLength,
  charMinLength,
  idLength,
  questionMaxLength,
  titleMaxLength,
} from 'src/config';

import { IsHtmlTextLength } from 'src/common/validators/html-text-length.validator';
import { Trim, TrimToUndefined } from 'src/common/transform.decorators';

/** The Dto file contains the description of the client requests and the server's responses*/
export class ModifyFlashcardDto {
  @IsString()
  @Length(charMinLength, titleMaxLength)
  @Trim()
  title: string;

  @IsString()
  @IsHtmlTextLength(charMinLength, questionMaxLength)
  @Trim()
  question: string;

  @IsString()
  @IsHtmlTextLength(charMinLength, answerMaxLength)
  @Trim()
  answer: string;

  // Required, like the form that fills it in has always asked: a card under
  // no topic is one nobody comes across again, since every list and every test
  // is reached through a subject and a topic.
  @IsMongoId()
  @Length(idLength, idLength)
  @TrimToUndefined()
  topic_id: string;

  @IsOptional()
  @IsMongoId()
  @Length(idLength, idLength)
  @TrimToUndefined()
  subject_id?: string;

  @IsOptional()
  @IsIn(visibilities)
  @ApiProperty({
    description: 'Who may see it; defaults to private when left out',
    enum: visibilities,
    required: false,
  })
  visibility?: Visibility;

}

/** Subject/topic/date filters shared by the "count" and "random" endpoints. */
/** Where a set of cards is taken from: a subject, and any of its topics. */
export class CardSetFilter extends DateRangeRequest {
  @IsOptional()
  @IsMongoId()
  @ApiProperty({
    description: 'Filter by subject ID',
    required: false,
  })
  subject_id?: string;

  // A test can be built from several topics of the subject, so the filter takes
  // a list. An empty or absent list means every topic - the whole subject.
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  @ApiProperty({
    description: 'Filter by topic IDs; empty means every topic of the subject',
    required: false,
    type: [String],
  })
  topic_ids?: string[];
}

export class CountFlashcardsDTO extends CardSetFilter {
  /**
   * Only on the count, and not on the draw above it: a test is built from
   * one's own cards whether they are shared or not, so letting /random take
   * this would be offering a choice that means nothing.
   */
  @IsOptional()
  @IsIn(visibilities)
  @ApiProperty({
    description: 'Count only the cards with this visibility',
    enum: visibilities,
    required: false,
  })
  visibility?: Visibility;
}

export class RandomFlashcardsDTO extends CardSetFilter {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000, {
    message: 'Non puoi richiedere più di 1000 domande in un singolo test.',
  })
  @ApiProperty({
    description: 'Number of flashcard requested',
    required: false,
  })
  numFlashcard?: number;
}

/** One of the flashcards drawn for a new test, with the topic it is on. */
export interface RandomFlashcard {
  _id: string;
  topic_id: string;
}

/**
 * The query string of the flashcard list: the shared list filter, plus the two
 * ends of a date range. On top of it rather than inside it, so the subject and
 * topic lists, which share that filter and offer no dates, go on refusing the
 * two parameters.
 */
export class CardListFilterRequest extends IntersectionType(
  ListFilterRequest,
  DateRangeRequest,
) {
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @ApiProperty({
    description:
      'true = only cards imported from someone else, false = only the reader\'s own, absent = both',
    required: false,
  })
  imported?: boolean;
}
