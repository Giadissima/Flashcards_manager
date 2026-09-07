import { Flashcard, FlashcardSchema } from './flashcards.schema';

import { FileModule } from 'src/file/file.module';
import { PostModule } from 'src/post/post.module';
import { Subject, SubjectSchema } from 'src/subject/subject.schema';
import { Topic, TopicSchema } from 'src/topic/topic.schema';
import { FlashcardsController } from './flashcards.controller';
import { FlashcardsService } from './flashcards.service';
import { Module } from '@nestjs/common';
import { PublishingModule } from 'src/common/publishing.module';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  controllers: [FlashcardsController],
  providers: [FlashcardsService],
  imports: [
    MongooseModule.forFeature([
      { name: Flashcard.name, schema: FlashcardSchema },
      { name: Subject.name, schema: SubjectSchema },
      { name: Topic.name, schema: TopicSchema },
    ]),
    FileModule,
    PublishingModule,
    PostModule,
  ],
  exports: [FlashcardsService],
})
export class FlashcardsModule {}
