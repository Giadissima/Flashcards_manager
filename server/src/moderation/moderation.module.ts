import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
import { FileModule } from 'src/file/file.module';
import { NotificationModule } from 'src/notification/notification.module';
import { RestrictionsModule } from 'src/common/restrictions.module';
import { PostModule } from 'src/post/post.module';
import { SubjectModule } from 'src/subject/subject.module';
import { Post, PostSchema } from 'src/post/post.schema';
import { Comment, CommentSchema } from 'src/post/comment.schema';
import { Feedback, FeedbackSchema } from 'src/post/feedback.schema';
import { Report, ReportSchema } from './report.schema';
import { Sanction, SanctionSchema } from './sanction.schema';
import { SignupBlock, SignupBlockSchema } from './signup-block.schema';
import { TelegramService } from './telegram.service';
import { User, UserSchema } from 'src/auth/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Report.name, schema: ReportSchema },
      { name: Sanction.name, schema: SanctionSchema },
      { name: SignupBlock.name, schema: SignupBlockSchema },
      { name: Post.name, schema: PostSchema },
      { name: Comment.name, schema: CommentSchema },
      { name: Feedback.name, schema: FeedbackSchema },
      { name: User.name, schema: UserSchema },
    ]),
    NotificationModule,
    // For the cards of the post being decided on, and the pictures in them
    PostModule,
    // A ban takes the banned user's own content private through it
    SubjectModule,
    FileModule,
    RestrictionsModule,
  ],
  controllers: [ModerationController, AdminController],
  providers: [ModerationService, TelegramService, AdminGuard],
  // AuthModule asks it whether an address may open an account
  exports: [ModerationService],
})
export class ModerationModule {}
