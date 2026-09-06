/** The three orders the Community feed offers, all descending. */
export const feedSorts = ['created', 'updated', 'popular'] as const;
export type FeedSort = (typeof feedSorts)[number];

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
  score: number;
  /** How the person reading voted: 1, -1, or 0 when they have not. */
  myVote: number;
  createdAt: string;
  updatedAt: string;
}
