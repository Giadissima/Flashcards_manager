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

  /**
   * Ministry code of the university the user belongs to, e.g. "00101". Both
   * study fields are optional: they describe the user, they do not gate
   * anything, and the registration form lets them be skipped.
   */
  @Prop({ required: false })
  universityCode?: string;

  /** Degree course name, only meaningful together with universityCode. */
  @Prop({ required: false })
  course?: string;

  /** Its level - "Laurea", "Laurea Magistrale", "Laurea Magistrale Ciclo Unico"
      - which the name alone does not pin down. */
  @Prop({ required: false })
  courseKind?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
