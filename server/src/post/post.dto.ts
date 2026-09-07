import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

import { ApiProperty, IntersectionType } from '@nestjs/swagger';
import { BasicFilterRequest, DateRangeRequest } from 'src/common.dto';
import { Trim } from 'src/common/transform.decorators';

/**
 * The three orders the feed offers: what was shared most recently, what was
 * touched most recently, and what people rated best. All descending - an
 * ascending feed would open on the oldest thing anybody ever posted.
 */
export const feedSorts = ['created', 'updated', 'popular'] as const;
export type FeedSort = (typeof feedSorts)[number];

/**
 * Which of a post's two dates the range narrows.
 *
 * Worth choosing rather than fixed: "shared in March" and "touched in March"
 * are different questions, and a post that has grown a card a week since it
 * went up answers only one of them.
 */
export const feedDateFields = ['created', 'updated'] as const;
export type FeedDateField = (typeof feedDateFields)[number];

export class FeedFilterRequest extends IntersectionType(
  BasicFilterRequest,
  DateRangeRequest,
) {
  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'Only the posts of people studying at this university',
    required: false,
  })
  universityCode?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'Only the posts of people on this degree course',
    required: false,
  })
  course?: string;

  // The name of a course does not pin it down on its own: "Informatica" is a
  // different course as a Laurea and as a Laurea Magistrale.
  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'The level of that course',
    required: false,
  })
  courseKind?: string;

  @IsOptional()
  @IsString()
  @Trim()
  @ApiProperty({
    description: 'Matches a username, a subject or a topic',
    required: false,
  })
  search?: string;

  @IsOptional()
  @IsString()
  @IsIn(feedDateFields)
  @ApiProperty({
    description: 'Which date the from/to range applies to',
    enum: feedDateFields,
    required: false,
    default: 'created',
  })
  dateField?: FeedDateField;

  @IsOptional()
  @IsString()
  @IsIn(feedSorts)
  @ApiProperty({
    description:
      'created = newest, updated = most recently changed, popular = best rated',
    enum: feedSorts,
    required: false,
    default: 'created',
  })
  sort?: FeedSort;
}

/** True likes a post, false takes the like back. */
export class SetLikeDto {
  @IsBoolean()
  @ApiProperty({ example: true })
  liked: boolean;
}

/** How long a comment or a feedback message may be. */
export const messageMaxLength = 1000;
export const messageMinLength = 2;

/** The body of a comment, of a report, and of a reply: all three are one text. */
export class WriteMessageDto {
  @IsString()
  @Length(messageMinLength, messageMaxLength)
  @ApiProperty({ description: 'What to say', example: 'Grazie, utilissime!' })
  @Trim()
  text: string;
}

/** The author of a post, as the feed shows them. */
export interface PostAuthor {
  _id: string;
  username: string;
  avatar?: string;
  avatarColor?: string;
}

/** A post as the feed returns it, with everything the card needs to draw. */
export interface FeedPost {
  _id: string;
  author: PostAuthor;
  subject: {
    _id: string;
    name: string;
    icon?: string;
    color?: string;
  };
  /** Named in the header beside the subject; empty when the whole subject is shared. */
  topics: { _id: string; name: string; color?: string }[];
  wholeSubject: boolean;
  /** How many flashcards the carousel can page through. */
  flashcardCount: number;
  /** Shown on the comments button, which is why it travels with the feed. */
  commentCount: number;
  likes: number;
  /** Whether the person reading has liked it. */
  liked: boolean;
  createdAt: Date;
  updatedAt: Date;
}
