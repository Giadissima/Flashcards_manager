import * as mongoose from 'mongoose';

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Document } from 'mongoose';
import { Group } from '../group/group.schema';

export type FlashcardDocument = Flashcard & Document;

// ? This file contains Flashcard MongoDb's schema
@Schema({
  collection: 'flashcard',
  collation: { locale: 'it', caseFirst: 'off', strength: 1 },
})
export class Flashcard {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  question: string;

  @Prop({ required: true })
  answer: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: false })
  group: mongoose.Types.ObjectId;
}

export const FlashcardSchema = SchemaFactory.createForClass(Flashcard);
