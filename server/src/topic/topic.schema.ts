import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';

import {
  Visibility,
  defaultVisibility,
  visibilities,
} from 'src/common/visibility';

export type TopicDocument = Topic & Document;

// ? This file contains Topic MongoDb's schema
@Schema({
  collection: 'topic',
  collation: { locale: 'it', caseFirst: 'off', strength: 1 },
})
export class Topic {
  @Prop({ required: true })
  name: string;

  @Prop({ required: false }) // TODO this will have to become mandatory
  color?: string; // TODO it should not be a plain string

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: false,
  })
  subject_id: mongoose.Types.ObjectId;

  /**
   * Who this belongs to. Every list is scoped to it, and it is what the
   * Community section will group by once it exists.
   */
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  user_id: mongoose.Types.ObjectId;

  @Prop({ required: true, enum: visibilities, default: defaultVisibility })
  visibility: Visibility;

  /**
   * Whether this topic's cards are drawn into the daily spaced-repetition
   * test. Cascades down to the flashcards themselves (see
   * TopicService.setSpacedRepetition) the same way visibility does, so the
   * query that builds a daily test never has to join back to this collection.
   */
  @Prop({ required: true, default: false })
  in_spaced_repetition: boolean;
}

export const TopicSchema = SchemaFactory.createForClass(Topic);