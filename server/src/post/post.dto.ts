import { IsIn, IsOptional, IsString, Length } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';
import { BasicFilterRequest } from 'src/common.dto';
import { Trim } from 'src/common/transform.decorators';

/**
 * The three orders the feed offers: what was shared most recently, what was
 * touched most recently, and what people rated best. All descending - an
 * ascending feed would open on the oldest thing anybody ever posted.
 */
export const feedSorts = ['created', 'updated', 'popular'] as const;
export type FeedSort = (typeof feedSorts)[number];

export class FeedFilterRequest extends BasicFilterRequest {
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

/** What an up or down arrow sends. 0 takes the vote back. */
export class CastVoteDto {
  @IsIn([1, -1, 0])
  @ApiProperty({ enum: [1, -1, 0], example: 1 })
  value: number;
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
  score: number;
  /** How the person reading voted: 1, -1, or 0 when they have not. */
  myVote: number;
  createdAt: Date;
  updatedAt: Date;
}
