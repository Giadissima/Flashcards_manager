import { Document, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type TestDocument = Test & Document;

@Schema({
  collection: 'test',
  timestamps: true,
})
export class Test {
  @Prop({ required: false })
  notes: string;
  // TODO nome

  @Prop({ type: Date, required: false })
  completed_at: Date;

  @Prop({ required: false })
  elapsed_time: number;

  @Prop({
    type: [
      {
        flashcard_id: {
          type: Types.ObjectId,
          ref: 'Flashcard',
          required: true,
        },
        is_correct: { type: Boolean, required: false },
      },
    ],
    required: true,
    default: [],
  })
  questions: {
    flashcard_id: Types.ObjectId;
    is_correct?: boolean;
  }[];
}

export const TestSchema = SchemaFactory.createForClass(Test);
