import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

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
}

export const FileSchema = SchemaFactory.createForClass(FileMongo);
