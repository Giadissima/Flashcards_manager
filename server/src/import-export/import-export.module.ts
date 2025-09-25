import { Flashcard, FlashcardSchema } from 'src/flashcards/flashcards.schema';
import { Topic, TopicSchema } from 'src/topic/topic.schema';
import { Subject, SubjectSchema } from 'src/subject/subject.schema';

import { ImportExportController } from './import-export.controller';
import { ImportExportService } from './import-export.service';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  controllers: [ImportExportController],
  providers: [ImportExportService],
  imports: [
    MongooseModule.forFeature([
      { name: Flashcard.name, schema: FlashcardSchema },
      { name: Subject.name, schema: SubjectSchema },
      { name: Topic.name, schema: TopicSchema },
    ]),
  ],
})
export class ImportExportModule {}
