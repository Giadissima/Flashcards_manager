import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Document } from 'mongoose';

export type GroupDocument = Group & Document;

// ? This file contains Group MongoDb's schema
@Schema({
  collection: 'Group',
  collation: { locale: 'it', caseFirst: 'off', strength: 1 },
})
export class Group {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  color: string; // TODO non deve essere una stringa!
}

export const UserSchema = SchemaFactory.createForClass(Group);
