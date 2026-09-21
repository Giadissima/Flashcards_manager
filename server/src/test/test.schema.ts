import mongoose, { Document, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type TestDocument = Test & Document;

@Schema({ _id: false }) // subdocument: no automatic _id
export class Question {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Flashcard', required: true })
  flashcard_id: Types.ObjectId;

  @Prop({ required: false, default: undefined })
  is_correct?: boolean;

  // The card's sr_box right before this question was first answered in this
  // test, and the sr_last_reviewed_at that answer wrote back onto the card.
  // Together they let a later correction (undo, or flipping right/wrong)
  // recompute the Leitner box from the same starting point instead of
  // compounding on top of itself - but only while sr_last_reviewed_at on the
  // card still matches what was stored here. If it no longer matches, another
  // test reviewed the same card meanwhile and moved its box on legitimately;
  // the correction then leaves the box alone rather than overwriting that
  // more recent progress.
  @Prop({ required: false })
  sr_box_before?: number;

  @Prop({ type: Date, required: false })
  sr_reviewed_at?: Date;

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
  /**
   * Who sat this test. No visibility beside it, unlike a flashcard or a
   * subject: a test is a record of one person's attempt, and there is nothing
   * in it that another could use.
   */
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  user_id: mongoose.Types.ObjectId;

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

  // The test this one was built from, e.g. by "repeat the wrong ones": set
  // once at creation and never changed, it is what lets the history show a
  // test as a continuation of another instead of an unrelated attempt.
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: false })
  parent_test_id?: Types.ObjectId;

  // Set alongside parent_test_id when the questions carried over are only the
  // ones the parent got wrong, rather than every question of it - the history
  // captions a repeat by which of the two this was, and cannot tell them
  // apart from the question count alone (a parent gotten entirely wrong
  // repeats the same number of questions either way).
  @Prop({ type: Boolean, required: false })
  only_wrong?: boolean;

  // Set when the test was started from a community post rather than the
  // tester's own library: its questions reference flashcards someone else
  // shared, and the runner uses this to send "exit" back to the Community
  // instead of the tester's own test history, and to ask first whether such a
  // run is worth keeping there at all.
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: false })
  source_post_id?: Types.ObjectId;
}

export const TestSchema = SchemaFactory.createForClass(Test);
