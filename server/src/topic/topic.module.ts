import { Topic, TopicSchema } from './topic.schema';

import { TopicController } from './topic.controller';
import { TopicService } from './topic.service';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PostModule } from 'src/post/post.module';
import { Subject, SubjectSchema } from 'src/subject/subject.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Topic.name, schema: TopicSchema },
      { name: Subject.name, schema: SubjectSchema },
    ]),
    PostModule,
  ],
  controllers: [TopicController],
  providers: [TopicService],
})
export class TopicModule {}