import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { PublishingService } from './publishing.service';
import { RestrictionsModule } from './restrictions.module';
import { User, UserSchema } from 'src/auth/user.schema';

/** Imported by the three modules that can make something public. */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    RestrictionsModule,
  ],
  providers: [PublishingService],
  exports: [PublishingService],
})
export class PublishingModule {}
