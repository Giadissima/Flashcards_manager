import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Document } from 'mongoose';

export type UserDocument = User & Document;

// ? This file contains User MongoDb's schema
@Schema({
  collection: 'user',
  timestamps: { createdAt: true, updatedAt: false },
})
export class User {
  // Stored lowercased so the uniqueness check cannot be sidestepped by case,
  // which a collation on this collection alone would not guarantee.
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  username: string;

  // bcrypt hash, never the password itself
  @Prop({ required: true })
  password: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
