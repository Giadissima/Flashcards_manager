import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Document } from 'mongoose';

import { Privilege, privileges } from 'src/common/privileges';

export type UserDocument = User & Document;

/**
 * One thing this account may not do, and until when.
 *
 * Stored as a list rather than three flags because that is how it is read:
 * "what is taken away from you, and when do you get it back" is one question,
 * and an empty list is the answer everybody else gets.
 */
@Schema({ _id: false })
export class Restriction {
  @Prop({ required: true, enum: privileges })
  privilege: Privilege;

  /** Absent means no end: only lifting it by hand gives it back. */
  @Prop({ required: false })
  until?: Date;

  /** What it followed from, so the user can be told and the bot can show it. */
  @Prop({ required: false })
  reason?: string;
}

export const RestrictionSchema = SchemaFactory.createForClass(Restriction);

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

  /**
   * Id of the uploaded picture in the file collection, as subjects hold their
   * icon. Absent means the default drawing, which the client builds from
   * avatarColor - nothing is stored for it.
   */
  @Prop({ required: false })
  avatar?: string;

  /** Background colour of the default avatar, as "#rrggbb". */
  @Prop({ required: false })
  avatarColor?: string;

  // ------------------------------------------------------------- moderation

  /**
   * How many warnings this account has collected, ever.
   *
   * Never reset when a block expires: the ladder is the whole point, and an
   * account that comes back from a week off starts from where it left rather
   * than from zero.
   */
  @Prop({ required: true, default: 0 })
  strikes: number;

  /** What is taken away right now. Empty for everybody who behaves. */
  @Prop({ type: [RestrictionSchema], default: [] })
  restrictions: Restriction[];

  /** Set when the account was banned for good, which is also a restriction. */
  @Prop({ required: false })
  bannedAt?: Date;

  /**
   * The address the account was made from.
   *
   * Kept for one thing only: a ban blocks that address from registering again
   * for a few hours, which is what stands between one ban and eight hundred
   * new accounts. Not shown anywhere, not used to recognise anybody.
   */
  @Prop({ required: false })
  signupIp?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
