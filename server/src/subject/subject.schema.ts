import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Document } from 'mongoose';

export type SubjectDocument = Subject & Document;

// ? This file contains Subject MongoDb's schema
@Schema({
  collection: 'subject',
  collation: { locale: 'it', caseFirst: 'off', strength: 1 },
})
export class Subject {
  @Prop({ required: true })
  name: string;

  @Prop({ required: false })
  icon?: string; // TODO non deve essere una stringa!

  @Prop({ required: false })
  desc?: string;
}

export const SubjectSchema = SchemaFactory.createForClass(Subject);
