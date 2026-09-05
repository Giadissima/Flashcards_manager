import { Subject, SubjectSchema } from './subject.schema';

import { FileModule } from 'src/file/file.module';
import { Module } from '@nestjs/common';
import { Flashcard, FlashcardSchema } from 'src/flashcards/flashcards.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { Topic, TopicSchema } from 'src/topic/topic.schema';
import { PostModule } from 'src/post/post.module';
import { SubjectController } from './subject.controller';
import { SubjectService } from './subject.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Subject.name, schema: SubjectSchema },
      { name: Topic.name, schema: TopicSchema },
      { name: Flashcard.name, schema: FlashcardSchema },
    ]),
    FileModule,
    PostModule,
  ],
  controllers: [SubjectController],
  providers: [SubjectService],
})
export class SubjectModule {}
