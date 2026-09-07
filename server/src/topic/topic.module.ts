import { Topic, TopicSchema } from './topic.schema';

import { TopicController } from './topic.controller';
import { TopicService } from './topic.service';
import { Module } from '@nestjs/common';
import { PublishingModule } from 'src/common/publishing.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Flashcard, FlashcardSchema } from 'src/flashcards/flashcards.schema';
import { PostModule } from 'src/post/post.module';
import { Subject, SubjectSchema } from 'src/subject/subject.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Topic.name, schema: TopicSchema },
      { name: Subject.name, schema: SubjectSchema },
      { name: Flashcard.name, schema: FlashcardSchema },
    ]),
    PostModule,
    PublishingModule,
  ],
  controllers: [TopicController],
  providers: [TopicService],
})
export class TopicModule {}