import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  BasePaginatedResult,
  FilterRequest,
  validateObjectIdParam,
} from 'src/common.dto';

import { Flashcard, FlashcardDocument } from 'src/flashcards/flashcards.schema';
import { Test, TestDocument } from './test.schema';
import { Model, SortOrder } from 'mongoose';

@Injectable()
export class TestService {
  constructor(
    @InjectModel(Test.name) private testModel: Model<Test>,
    @InjectModel(Flashcard.name) private flashcardModel: Model<Flashcard>,
  ) {}

  async create(): Promise<TestDocument> {
    // const totalCount = await this.flashcardModel.countDocuments();
    // TODO la dimensione delle domande può essere passata o conta dal numero di gruppi o materie richieste
    const questions = await this.flashcardModel.aggregate([
      { $sample: { size: 50 } },
      { $project: { _id: 1 } },
    ]);
    const test = await this.testModel.create({
      questions: questions.map((q: FlashcardDocument) => ({
        flashcard_id: q._id,
      })),
    });
    const test_obj: TestDocument | null = await this.testModel
      .findById(test._id)
      .populate('questions.flashcard_id')
      .exec();
    if (test_obj == null)
      throw new NotFoundException('errore nella creazione del test');
    return test_obj;
  }

  updateElapsedTime(id: string, time: number) {
    if (!validateObjectIdParam(id))
      throw new BadRequestException('The id does not satisfy requirements');
    return this.testModel.findByIdAndUpdate(id, { elapsed_time: time });
  }

  async delete(
    id: string,
  ): Promise<void | BadRequestException | NotFoundException> {
    if (!validateObjectIdParam(id))
      throw new BadRequestException('The id does not satisfy requirements');

    const result = await this.testModel.findByIdAndDelete(id);
    if (result == null) {
      throw new NotFoundException(`Group with id ${id} not found`);
    }
  }

  updateAnswer(id: string, is_correct: boolean) {
    if (!validateObjectIdParam(id))
      throw new BadRequestException('The id does not satisfy requirements');
    return this.testModel.findByIdAndUpdate(id, { is_correct });
  }

  async findAll(
    filter: FilterRequest,
  ): Promise<BasePaginatedResult<TestDocument>> {
    const [result, count] = await Promise.all([
      this.testModel
        .find()
        .sort([
          [filter.sortField, filter.sortDirection as SortOrder],
          ['_id', 'desc'],
        ])
        .skip(filter.skip)
        .limit(filter.limit)
        .exec(),
      this.testModel.find().countDocuments(),
    ]);
    return { result, count };
  }

  findOne(id: string) {
    return this.testModel
      .findById(id)
      .populate('questions.flashcard_id')
      .exec();
  }
}
