import mongoose, { Document, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type TestDocument = Test & Document;

@Schema({ _id: false }) // subdocument: no automatic _id
export class Question {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Flashcard', required: true })
  flashcard_id: Types.ObjectId;

  @Prop({ required: false, default: undefined })
  is_correct?: boolean;

  // The topic of the flashcard, kept on the question itself: the review of a
  // test filters by topic, and reading it back from hundreds of cards - some of
  // which may be deleted by then - is a join the question can carry instead.
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: false })
  topic_id?: Types.ObjectId;
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

  // Every topic the questions of the test are on, so a test set up by subject
  // states all of them instead of none. A test on a single topic holds an array
  // of one, which is what a filter by topic matches either way: Mongo compares
  // a value against each element of an array.
  @Prop({
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'Topic',
    required: false,
    default: undefined,
  })
  topic_id?: Types.ObjectId[];
}

export const TestSchema = SchemaFactory.createForClass(Test);
