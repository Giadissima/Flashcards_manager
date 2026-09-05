import { PostAuthor } from './post.dto';

/** A public comment under a post. */
export interface PostComment {
  _id: string;
  post_id: string;
  user_id: PostAuthor;
  text: string;
  createdAt: string;
}

export const notificationKinds = ['upvote', 'comment', 'feedback'] as const;
export type NotificationKind = (typeof notificationKinds)[number];

export interface AppNotification {
  _id: string;
  kind: NotificationKind;
  actor_id: PostAuthor;
  post_id?: string;
  feedback_id?: string;
  preview?: string;
  read: boolean;
  createdAt: string;
}
