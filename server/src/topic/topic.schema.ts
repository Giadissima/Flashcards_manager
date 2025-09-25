import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';

export type TopicDocument = Topic & Document;

// ? This file contains Topic MongoDb's schema
@Schema({
  collection: 'topic',
  collation: { locale: 'it', caseFirst: 'off', strength: 1 },
})
export class Topic {
  @Prop({ required: true })
  name: string;

  @Prop({ required: false }) // TODO dovrà essere obbligatorio!
  color?: string; // TODO non deve essere una stringa!

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: false,
  })
  subject_id: mongoose.Types.ObjectId;
}

export const TopicSchema = SchemaFactory.createForClass(Topic);