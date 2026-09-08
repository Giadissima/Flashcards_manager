import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { NotificationModule } from 'src/notification/notification.module';
import { RestrictionsService } from './restrictions.service';
import { User, UserSchema } from 'src/auth/user.schema';

/** Imported wherever something reaches other people: publishing, comments,
    feedback - the three things a block can take away. */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    NotificationModule,
  ],
  providers: [RestrictionsService],
  exports: [RestrictionsService],
})
export class RestrictionsModule {}
