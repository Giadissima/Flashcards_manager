import { FlashcardRequestDto } from './flashcards.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Injectable } from '@nestjs/common';
import { Flashcard } from './flashcards.schema';
import { Model } from 'mongoose';

@Injectable()
export class FlashcardsService {
  constructor(
    @InjectModel(Flashcard.name) private flashcardModel: Model<Flashcard>,
  ) {}

  async create(createFlashcardDto: FlashcardRequestDto) {
    await new this.flashcardModel({ ...createFlashcardDto }).save();
    return 'Success';
  }

  // findAll() {
  //   return `This action returns all flashcards`;
  // }

  // findOne(id: number) {
  //   return `This action returns a #${id} flashcard`;
  // }

  // update(id: number, updateFlashcardDto: UpdateFlashcardDto) {
  //   return `This action updates a #${id} flashcard`;
  // }

  // remove(id: number) {
  //   return `This action removes a #${id} flashcard`;
  // }
}
