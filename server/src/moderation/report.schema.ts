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

/** Somebody saying a post should not be there. */
@Schema({
  collection: 'report',
  timestamps: { createdAt: true, updatedAt: false },
})
export class Report {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true,
    index: true,
  })
  post_id: mongoose.Types.ObjectId;

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

// One report per post and person: reporting twice is not agreeing twice, and
// counting it as two would let one account hide any post it likes.
ReportSchema.index({ post_id: 1, reporter_id: 1 }, { unique: true });
