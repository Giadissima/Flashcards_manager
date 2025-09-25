import { Topic, TopicSchema } from './topic.schema';

import { TopicController } from './topic.controller';
import { TopicService } from './topic.service';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Topic.name, schema: TopicSchema }]),
  ],
  controllers: [TopicController],
  providers: [TopicService],
})
export class TopicModule {}