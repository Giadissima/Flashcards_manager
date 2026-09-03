import mongoose, { Document, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type TestDocument = Test & Document;

@Schema({ _id: false }) // subdocument: no automatic _id
export class Question {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Flashcard', required: true })
  flashcard_id: Types.ObjectId;

  @Prop({ required: false, default: undefined })
  is_correct?: boolean;
}

// Built from the class, and not the class itself: passing the class to @Prop
// leaves Mongoose with a plain object type and no casting at all. Note that
// every id above is declared with Schema.Types.ObjectId, the SchemaType, and
// not with Types.ObjectId, which is the BSON class - given that one, @Prop
// falls back to Mixed and writes whatever arrives, which is how the ids of a
// question came to be stored as the strings they were sent as.
export const QuestionSchema = SchemaFactory.createForClass(Question);

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

  @Prop({ type: [QuestionSchema], required: true, default: [] })
  questions: Question[];

  // What the test is about, resolved from its flashcards when it is created and
  // stored here: every screen of a test states it, and reading it back through
  // the cards of every question meant a join over hundreds of documents each
  // time. Optional because tests created before this field exists do not carry
  // it - they are backfilled at startup, see TestService.backfillSubjectAndTopic.
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: false })
  subject_id?: Types.ObjectId;

  // Only set when every question of the test shares one topic: a test set up by
  // subject spans several, and no single one of them would be true.
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: false })
  topic_id?: Types.ObjectId;
}

export const TestSchema = SchemaFactory.createForClass(Test);
