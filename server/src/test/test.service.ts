import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  BasePaginatedResult,
  shuffleArray,
  validateObjectIdParam,
} from 'src/common.dto';

import { Flashcard } from 'src/flashcards/flashcards.schema';
import { Test, TestDocument } from './test.schema';
import { Model, SortOrder, Types } from 'mongoose';
import { TestCreateRequest, TestFilterDto, TestStats } from './test.dto';
import { FlashcardsService } from 'src/flashcards/flashcards.service';

@Injectable()
export class TestService {
  update(id: string, test: TestDocument) {
    if (!validateObjectIdParam(id))
      throw new BadRequestException('The id does not satisfy requirements');
    return this.testModel.findByIdAndUpdate(id, test);
  }
  constructor(
    @InjectModel(Test.name) private testModel: Model<Test>,
    @InjectModel(Flashcard.name) private flashcardModel: Model<Flashcard>,
    private readonly flashcardService: FlashcardsService,
  ) {}

  async getQuestion(test_id: string, index: number) {
    const test = await this.testModel
      .findById(test_id)
      .select({ questions: { $slice: [index, 1] } })
      .lean();

    if (!test || !test.questions || test.questions.length === 0)
      throw new NotFoundException(`Error searching question sended`); // TODO controllare l'inglese

    const flashcardId = test.questions[0].flashcard_id;
    return this.flashcardService.findOne(flashcardId.toString());
  }
  // TODO devo trovare un modo per filtrare solo le domande che non hanno categoria
  async create(test: TestCreateRequest): Promise<TestDocument> {
    return new this.testModel(test).save();
  }

  updateelapsed_time(id: string, time: number) {
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
      throw new NotFoundException(`Topic with id ${id} not found`);
    }
  }

  updateAnswer(test_id: string, question_id: string, is_correct: boolean) {
    if (!validateObjectIdParam(test_id) || !validateObjectIdParam(question_id))
      throw new BadRequestException('The id does not satisfy requirements');
    return this.testModel.findOneAndUpdate(
      { _id: test_id, 'questions.flashcard_id': question_id },
      { $set: { 'questions.$.is_correct': is_correct } },
      { new: true },
    );
  }

  async findAll(
    filter: TestFilterDto,
  ): Promise<BasePaginatedResult<TestDocument>> {
    const [data, count] = await Promise.all([
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
    return { data, count };
  }

  async getStats(): Promise<TestStats> {
    const [result] = await this.testModel.aggregate([
      {
        $addFields: {
          totalQuestions: { $size: '$questions' },
          correctQuestions: {
            $size: {
              $filter: {
                input: '$questions',
                as: 'q',
                cond: { $eq: ['$$q.is_correct', true] },
              },
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          totalTests: { $sum: 1 },
          completedTests: {
            $sum: { $cond: [{ $ifNull: ['$completedAt', false] }, 1, 0] },
          },
          totalTimeSpentSeconds: { $sum: { $ifNull: ['$elapsed_time', 0] } },
          totalQuestionsAnswered: { $sum: '$totalQuestions' },
          totalCorrectAnswers: { $sum: '$correctQuestions' },
        },
      },
    ]);

    const totalQuestionsAnswered = result?.totalQuestionsAnswered ?? 0;
    const totalCorrectAnswers = result?.totalCorrectAnswers ?? 0;

    return {
      totalTests: result?.totalTests ?? 0,
      completedTests: result?.completedTests ?? 0,
      totalTimeSpentSeconds: result?.totalTimeSpentSeconds ?? 0,
      averageScorePercent:
        totalQuestionsAnswered > 0
          ? Math.round((totalCorrectAnswers / totalQuestionsAnswered) * 100)
          : 0,
    };
  }

  async findOne(id: string): Promise<TestDocument> {
    const test = await this.testModel.findById(id).exec();

    if (!test || test == null)
      throw new NotFoundException('test not found');

    return test;
  }
}
