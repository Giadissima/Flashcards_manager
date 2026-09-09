/** The three orders the Community feed offers, all descending. */
export const feedSorts = ['created', 'updated', 'popular'] as const;
export type FeedSort = (typeof feedSorts)[number];

/** Which of a post's two dates the range filter reads. */
export const feedDateFields = ['created', 'updated'] as const;
export type FeedDateField = (typeof feedDateFields)[number];

/** The tree the import dialog is drawn from. */
export interface PostContents {
  subject: { _id: string; name: string; color?: string };
  topics: { _id: string; name: string; color?: string; cardCount: number }[];
  total: number;
  /** How many of them the reader has already taken. */
  alreadyImported: number;
}

/** How the topics of a set are laid out on the way in. */
export type ImportTopicMode = 'keep' | 'single';

/** What to do with a topic name the reader already uses. */
export type ImportCollision = 'merge' | 'rename';

/** Where copies land: asked the same way of a whole set and of one card. */
export interface ImportTargetRequest {
  /** A subject of the reader's own; absent means create the one named below. */
  subjectId?: string;
  subjectName?: string;
  topicMode: ImportTopicMode;
  topicName?: string;
  onCollision?: ImportCollision;
  renames?: { topicId: string; name: string }[];
}

/** The same, plus which part of the post is being taken. */
export interface ImportPostRequest extends ImportTargetRequest {
  topicIds?: string[];
}

/** What an import did. */
export interface ImportResult {
  imported: number;
  /** Cards left alone because the reader already had them. */
  skipped: number;
  subjectId: string;
}

/** Why a post is being reported. Matches the server's own list. */
export const reportReasons = [
  'explicit',
  'offensive',
  'spam',
  'other',
] as const;
export type ReportReason = (typeof reportReasons)[number];

export interface ReportRequest {
  reason: ReportReason;
  note?: string;
}

export interface ReportResult {
  /** Open reports on that post, this one included. */
  reports: number;
}

export interface PostAuthor {
  _id: string;
  username: string;
  /** Id of the uploaded picture; absent means the default drawing. */
  avatar?: string;
  avatarColor?: string;
}

/** A post as the feed returns it, with everything its card needs to draw. */
export interface FeedPost {
  _id: string;
  author: PostAuthor;
  subject: { _id: string; name: string; icon?: string; color?: string };
  /** Named beside the subject; empty when the whole subject is shared. */
  topics: { _id: string; name: string; color?: string }[];
  wholeSubject: boolean;
  flashcardCount: number;
  /** Shown on the comments button, without having to open them first. */
  commentCount: number;
  likes: number;
  /** Whether the person reading has liked it. */
  liked: boolean;
  createdAt: string;
  updatedAt: string;
}
