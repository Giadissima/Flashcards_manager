import { PostAuthor } from './post.dto';

/** A public comment under a post. */
export interface PostComment {
  _id: string;
  post_id: string;
  user_id: PostAuthor;
  text: string;
  createdAt: string;
}

export interface FeedbackMessage {
  user_id: { _id: string; username: string };
  text: string;
  createdAt: string;
}

/** A private exchange about one flashcard, closed at three messages. */
export interface Feedback {
  _id: string;
  flashcard_id: { _id: string; title: string };
  author_id: string;
  reporter_id: string;
  messages: FeedbackMessage[];
  /** Set by the author once they have taken the report on board. */
  resolved: boolean;
}

export const notificationKinds = [
  'upvote',
  'comment',
  'feedback',
  'resolved',
  'moderation',
] as const;
export type NotificationKind = (typeof notificationKinds)[number];

/** What the site decided about the account, on the one kind nobody caused. */
export interface ModerationNotice {
  event: 'warned' | 'blocked' | 'lifted' | 'removed';
  /** What was taken away, or given back. */
  privileges: string[];
  /** When it ends. Absent means there is no date to wait for. */
  until?: string;
}

export interface AppNotification {
  _id: string;
  kind: NotificationKind;
  /** Absent on moderation notices: those come from the site, not from a user. */
  actor_id?: PostAuthor;
  post_id?: string;
  feedback_id?: string;
  preview?: string;
  moderation?: ModerationNotice;
  read: boolean;
  createdAt: string;
}
