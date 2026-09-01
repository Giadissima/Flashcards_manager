import { Document, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type TestDocument = Test & Document;

@Schema({ _id: false }) // subdocument: no automatic _id
export class Question {
  @Prop({ type: Types.ObjectId, ref: 'Flashcard', required: true })
  flashcard_id: Types.ObjectId;

  @Prop({ required: false, default: undefined })
  is_correct?: boolean;
}

@Schema({
  collection: 'test',
  timestamps: true,
})
export class Test {
  @Prop({ required: false })
  notes: string;

  @Prop({ type: Date, required: false })
  completedAt: Date;

  @Prop({ required: false })
  elapsed_time: number;

  @Prop({ type: [Question], required: true, default: [] })
  questions: Question[];

  // What the test is about, resolved from its flashcards when it is created and
  // stored here: every screen of a test states it, and reading it back through
  // the cards of every question meant a join over hundreds of documents each
  // time. Optional because tests created before this field exists do not carry
  // it - they are backfilled at startup, see TestService.backfillSubjectAndTopic.
  @Prop({ type: Types.ObjectId, ref: 'Subject', required: false })
  subject_id?: Types.ObjectId;

  // Only set when every question of the test shares one topic: a test set up by
  // subject spans several, and no single one of them would be true.
  @Prop({ type: Types.ObjectId, ref: 'Topic', required: false })
  topic_id?: Types.ObjectId;
}

export const TestSchema = SchemaFactory.createForClass(Test);
