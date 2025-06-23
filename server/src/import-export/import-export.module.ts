import { Flashcard, FlashcardSchema } from 'src/flashcards/flashcards.schema';
import { Group, GroupSchema } from 'src/group/group.schema';
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
      { name: Group.name, schema: GroupSchema },
    ]),
  ],
})
export class ImportExportModule {}
