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
  icon?: string; // TODO it should not be a plain string

  @Prop({ required: false })
  desc?: string;

  // background color of the default SVG icon, used when no icon file is set
  @Prop({ required: false })
  color?: string;
}

export const SubjectSchema = SchemaFactory.createForClass(Subject);
