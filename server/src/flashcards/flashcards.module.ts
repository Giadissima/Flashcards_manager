import { Flashcard, FlashcardSchema } from './flashcards.schema';

import { FlashcardsController } from './flashcards.controller';
import { FlashcardsService } from './flashcards.service';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  controllers: [FlashcardsController],
  providers: [FlashcardsService],
  imports: [
    MongooseModule.forFeature([
      { name: Flashcard.name, schema: FlashcardSchema },
    ]),
  ],
})
export class FlashcardsModule {}
