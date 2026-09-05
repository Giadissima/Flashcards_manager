import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import * as mongoose from 'mongoose';

import { Document } from 'mongoose';
import {
  Visibility,
  defaultVisibility,
  visibilities,
} from 'src/common/visibility';

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

  /**
   * Who this belongs to. Every list is scoped to it, and it is what the
   * Community section will group by once it exists.
   */
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  user_id: mongoose.Types.ObjectId;

  @Prop({ required: true, enum: visibilities, default: defaultVisibility })
  visibility: Visibility;
}

export const SubjectSchema = SchemaFactory.createForClass(Subject);
