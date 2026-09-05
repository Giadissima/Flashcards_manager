import { Flashcard, FlashcardSchema } from 'src/flashcards/flashcards.schema';
import { Post, PostSchema } from './post.schema';
import { Subject, SubjectSchema } from 'src/subject/subject.schema';
import { Topic, TopicSchema } from 'src/topic/topic.schema';

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PostController } from './post.controller';
import { PostService } from './post.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: Subject.name, schema: SubjectSchema },
      { name: Topic.name, schema: TopicSchema },
      { name: Flashcard.name, schema: FlashcardSchema },
    ]),
  ],
  controllers: [PostController],
  // The three services that change a visibility keep the feed in step through it
  providers: [PostService],
  exports: [PostService],
})
export class PostModule {}
