import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';

export type GroupDocument = Group & Document;

// ? This file contains Group MongoDb's schema
@Schema({
  collection: 'group',
  collation: { locale: 'it', caseFirst: 'off', strength: 1 },
})
export class Group {
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

export const GroupSchema = SchemaFactory.createForClass(Group);
