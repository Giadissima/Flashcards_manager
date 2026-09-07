import {
  IsArray,
  IsBoolean,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { charMinLength, nameMaxLength } from 'src/config';

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

/**
 * How the topics of a set travel with it.
 *
 * keep   - one topic of the reader's per topic of the author's
 * single - the whole lot under one topic of the reader's choosing
 *
 * There is no third way of dropping them in with no topic at all: a card is
 * created here under a subject and a topic both, the form asks for one, and a
 * card that answers to neither is a card nobody finds again.
 */
export const importTopicModes = ['keep', 'single'] as const;
export type ImportTopicMode = (typeof importTopicModes)[number];

/**
 * What to do when a topic being kept is called what one of the reader's own is
 * already called: put the cards in with theirs, or stand a second topic beside
 * it under a free name.
 */
export const importCollisions = ['merge', 'rename'] as const;
export type ImportCollision = (typeof importCollisions)[number];

/** A topic of the author's, and the name it is to take in the reader's library. */
export class TopicRenameDto {
  @IsMongoId()
  @ApiProperty({ description: "The author's topic being renamed" })
  topicId: string;

  @IsString()
  @Length(charMinLength, nameMaxLength)
  @Trim()
  @ApiProperty({ description: 'What to call it here' })
  name: string;
}

/**
 * Where copies land, asked the same way of a whole set and of a single card:
 * both arrive in a library that is already organised, and the questions worth
 * asking about one are the questions worth asking about the other.
 */
export class ImportTargetDto {
  @IsOptional()
  @IsMongoId()
  @ApiProperty({
    description: 'A subject of your own to put them in; absent means a new one',
    required: false,
  })
  subjectId?: string;

  @IsOptional()
  @IsString()
  @Length(charMinLength, nameMaxLength)
  @Trim()
  @ApiProperty({
    description: 'Name of the subject to create, when none was chosen',
    required: false,
  })
  subjectName?: string;

  @IsString()
  @IsIn(importTopicModes)
  @ApiProperty({ enum: importTopicModes, default: 'keep' })
  topicMode: ImportTopicMode;

  @IsOptional()
  @IsString()
  @Length(charMinLength, nameMaxLength)
  @Trim()
  @ApiProperty({
    description: 'The one topic everything goes under, when topicMode is single',
    required: false,
  })
  topicName?: string;


  @IsOptional()
  @IsString()
  @IsIn(importCollisions)
  @ApiProperty({
    description: 'What to do with a topic name you already use',
    enum: importCollisions,
    required: false,
    default: 'merge',
  })
  onCollision?: ImportCollision;

  // The names come from the dialog, one per topic whose name is taken: which
  // of two topics called "Analisi" is which is a question only the person with
  // both of them can answer.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TopicRenameDto)
  @ApiProperty({
    description: 'New names for the topics whose name you already use',
    required: false,
    type: [TopicRenameDto],
  })
  renames?: TopicRenameDto[];
}

/** The same, plus which part of the post is being taken. */
export class ImportPostDto extends ImportTargetDto {
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  @ApiProperty({
    description: "Which of the post's topics to take",
    required: false,
    type: [String],
  })
  topicIds?: string[];
}

/** What the import dialog draws its tree from. */
export interface PostContents {
  subject: { _id: string; name: string; color?: string };
  /** The topics that actually have shared cards in them, with how many. */
  topics: { _id: string; name: string; color?: string; cardCount: number }[];
  total: number;
  /** How many of them the reader has already taken, whole set included. */
  alreadyImported: number;
}

/** What an import did, which is what the toast reports. */
export interface ImportResult {
  imported: number;
  /** Cards left where they were because the reader already had them. */
  skipped: number;
  subjectId: string;
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
