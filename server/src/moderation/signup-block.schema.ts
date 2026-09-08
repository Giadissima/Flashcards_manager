import { Document } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type SignupBlockDocument = SignupBlock & Document;

/**
 * An address that may not open new accounts for a while.
 *
 * The one thing that stands between banning somebody and their eight hundredth
 * account, in a site where signing up costs nothing. Deliberately short-lived:
 * addresses are shared - a whole university building can sit behind one - so
 * this is a delay, never a wall, and it expires by itself.
 */
@Schema({
  collection: 'signup_block',
  timestamps: { createdAt: true, updatedAt: false },
})
export class SignupBlock {
  @Prop({ required: true, index: true })
  ip: string;

  @Prop({ required: true })
  until: Date;

  /** The account whose ban set it, for when it has to be explained. */
  @Prop({ required: false })
  because?: string;
}

export const SignupBlockSchema = SchemaFactory.createForClass(SignupBlock);

// Mongo throws these away on its own once they are spent: an expired block is
// of no use to anybody, and keeping every address that ever misbehaved would
// be keeping a list nobody asked us to keep.
SignupBlockSchema.index({ until: 1 }, { expireAfterSeconds: 0 });
