import mongoose, { Document } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type ReportDocument = Report & Document;

/**
 * Why a post was reported.
 *
 * A short list on purpose: a free-text-only report is a paragraph to read on a
 * phone, and the reason is what decides how fast it has to be looked at.
 */
export const reportReasons = [
  'explicit',
  'offensive',
  'spam',
  'other',
] as const;
export type ReportReason = (typeof reportReasons)[number];

/**
 * Where a report stands. "open" is waiting to be looked at, and the two others
 * are what was decided, kept so the same post reported again shows what
 * happened last time rather than starting the argument over.
 */
export const reportStates = ['open', 'kept', 'removed'] as const;
export type ReportState = (typeof reportStates)[number];

/** What a report is about - a whole post, or one comment under it. */
export const reportTargets = ['post', 'comment'] as const;
export type ReportTarget = (typeof reportTargets)[number];

/** Somebody saying a post, or a comment under it, should not be there. */
@Schema({
  collection: 'report',
  timestamps: { createdAt: true, updatedAt: false },
})
export class Report {
  @Prop({ required: true, enum: reportTargets, default: 'post', index: true })
  target: ReportTarget;

  /**
   * The post, in both cases: it is what a post report is about, and what a
   * comment report's comment lives under - kept here too so the post a
   * reported comment belongs to never needs a second lookup.
   */
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true,
    index: true,
  })
  post_id: mongoose.Types.ObjectId;

  /** Set only when target is 'comment'. */
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    required: false,
    index: true,
  })
  comment_id?: mongoose.Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  reporter_id: mongoose.Types.ObjectId;

  @Prop({ required: true, enum: reportReasons })
  reason: ReportReason;

  /** What they added in their own words, when they had something to add. */
  @Prop({ required: false })
  note?: string;

  @Prop({ required: true, enum: reportStates, default: 'open', index: true })
  state: ReportState;

  /** When it was decided, whatever the decision was. */
  @Prop({ required: false })
  handledAt?: Date;

  /** Written by the timestamps above; declared so it can be read back. */
  createdAt?: Date;
}

export const ReportSchema = SchemaFactory.createForClass(Report);

// One report per post (or per comment) and person: reporting twice is not
// agreeing twice, and counting it as two would let one account hide anything
// it likes on its own. Split in two partial indexes rather than one compound
// one, because a comment report also carries the post_id of the post it
// lives under - a plain index on (post_id, reporter_id) would refuse a second
// comment reported under the same post by the same person, even a different
// comment entirely.
ReportSchema.index(
  { post_id: 1, reporter_id: 1 },
  { unique: true, partialFilterExpression: { target: 'post' } },
);
ReportSchema.index(
  { comment_id: 1, reporter_id: 1 },
  { unique: true, partialFilterExpression: { target: 'comment' } },
);
