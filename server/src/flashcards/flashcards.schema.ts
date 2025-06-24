import * as mongoose from 'mongoose';

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Document } from 'mongoose';

export type FlashcardDocument = Flashcard & Document;

// ? This file contains Flashcard MongoDb's schema
@Schema({
  collection: 'flashcard',
  collation: { locale: 'it', caseFirst: 'off', strength: 1 },
  timestamps: true,
})
export class Flashcard {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  question: string;

  @Prop({ required: true })
  answer: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: false })
  group_id: mongoose.Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: false,
  })
  subject_id: mongoose.Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FileMongo',
    required: false,
  })
  question_img_id?: mongoose.Types.ObjectId; // TODO le immagini salvate come buffer non devono superare 16 MB, farci dei controlli sopra

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FileMongo',
    required: false,
  })
  answer_img_id: mongoose.Types.ObjectId;
}
// ! exploit: il client potrebbe decidere di fare una flashcard appartenente a un gruppo e una materia non collegate modificando a mano la richiesta, dato che non ho messo controlli a riguardo. Non ce li metterò nemmeno perché non ne ho voglia, il mio progetto è un progetto semplice per studiarci sopra, se però sentite la necessità di modificarlo fatemi pure una pull request!
export const FlashcardSchema = SchemaFactory.createForClass(Flashcard);
