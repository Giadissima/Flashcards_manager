import mongoose, { Document } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Privilege, privileges } from 'src/common/privileges';

export type SanctionDocument = Sanction & Document;

/** What was done to an account, and by what. */
export const sanctionKinds = ['warning', 'ban', 'lifted'] as const;
export type SanctionKind = (typeof sanctionKinds)[number];

/**
 * The record of a decision about an account.
 *
 * The user carries what is in force now; this carries what happened, which is
 * a different question and the one that gets asked on the second offence. Kept
 * even after a block expires: an account with three warnings behind it is not
 * the same as one with none, and the ladder needs to remember.
 */
@Schema({
  collection: 'sanction',
  timestamps: { createdAt: true, updatedAt: false },
})
export class Sanction {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  user_id: mongoose.Types.ObjectId;

  @Prop({ required: true, enum: sanctionKinds })
  kind: SanctionKind;

  /** The post it followed from, when it followed from one. */
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: false })
  post_id?: mongoose.Types.ObjectId;

  /** Which privileges it took away, if any. */
  @Prop({ type: [String], enum: privileges, default: [] })
  privileges: Privilege[];

  /** When they come back. Absent on a warning, or on a block with no end. */
  @Prop({ required: false })
  until?: Date;

  /** The warning number this was, so the ladder can be read back. */
  @Prop({ required: false })
  strike?: number;

  @Prop({ required: false })
  note?: string;
}

export const SanctionSchema = SchemaFactory.createForClass(Sanction);
