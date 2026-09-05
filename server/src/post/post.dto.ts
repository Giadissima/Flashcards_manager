import { IsIn, IsOptional, IsString } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';
import { BasicFilterRequest } from 'src/common.dto';

/**
 * The two orders the feed offers: what was shared most recently, and what was
 * touched most recently. Both descending - an ascending feed would open on the
 * oldest thing anybody ever posted.
 */
export const feedSorts = ['created', 'updated'] as const;
export type FeedSort = (typeof feedSorts)[number];

export class FeedFilterRequest extends BasicFilterRequest {
  @IsOptional()
  @IsString()
  @IsIn(feedSorts)
  @ApiProperty({
    description: 'created = newest posts, updated = most recently changed',
    enum: feedSorts,
    required: false,
    default: 'created',
  })
  sort?: FeedSort;
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
  createdAt: Date;
  updatedAt: Date;
}
