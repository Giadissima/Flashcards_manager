import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
import { NotificationModule } from 'src/notification/notification.module';
import { Post, PostSchema } from 'src/post/post.schema';
import { Report, ReportSchema } from './report.schema';
import { Sanction, SanctionSchema } from './sanction.schema';
import { SignupBlock, SignupBlockSchema } from './signup-block.schema';
import { User, UserSchema } from 'src/auth/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Report.name, schema: ReportSchema },
      { name: Sanction.name, schema: SanctionSchema },
      { name: SignupBlock.name, schema: SignupBlockSchema },
      { name: Post.name, schema: PostSchema },
      { name: User.name, schema: UserSchema },
    ]),
    NotificationModule,
  ],
  controllers: [ModerationController],
  providers: [ModerationService],
  // AuthModule asks it whether an address may open an account
  exports: [ModerationService],
})
export class ModerationModule {}
