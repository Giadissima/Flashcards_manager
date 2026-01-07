import { Document, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type TestDocument = Test & Document;

@Schema({ _id: false }) // disabilita _id automatico per subdocumento
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
}

export const TestSchema = SchemaFactory.createForClass(Test);
