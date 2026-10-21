import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import * as mongoose from 'mongoose';
import { Document } from 'mongoose';

export type FileDocument = FileMongo & Document;

// ? This file contains File MongoDb's schema
@Schema({
  collection: 'file',
  collation: { locale: 'it', caseFirst: 'off', strength: 1 },
})
export class FileMongo {
  @Prop({ required: true })
  content: Buffer;

  @Prop({ required: true })
  mimetype: string;

  /**
   * Whose content image this is: set on the inline images of flashcards and
   * subject descriptions, and only on those. Editing or deleting content only
   * ever deletes files its own author owns, so a picture copied from somebody
   * else's card can never take their file down with it. Absent on icons,
   * avatars and on images stored before this field existed.
   */
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  user_id?: mongoose.Types.ObjectId;
}

export const FileSchema = SchemaFactory.createForClass(FileMongo);
