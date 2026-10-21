import { FileMongo, FileSchema } from './file.schema';

import { ContentImageService } from './content-image.service';
import { FileService } from './file.service';
import { Flashcard, FlashcardSchema } from 'src/flashcards/flashcards.schema';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FileController } from './file.controller';
import { Subject, SubjectSchema } from 'src/subject/subject.schema';

@Module({
  providers: [FileService, ContentImageService],
  exports: [FileService, ContentImageService],
  imports: [
    MongooseModule.forFeature([
      { name: FileMongo.name, schema: FileSchema },
      // Only read, by ContentImageService, to tell which content shows an image
      { name: Flashcard.name, schema: FlashcardSchema },
      { name: Subject.name, schema: SubjectSchema },
    ]),
  ],
  controllers: [FileController],
})
export class FileModule {}
