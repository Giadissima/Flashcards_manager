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
import { Model, PipelineStage, Types } from 'mongoose';
import {
  TestCreateRequest,
  TestFilterDto,
  TestStats,
  TestStatsFilterDto,
} from './test.dto';
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

  // Condiviso tra findAll e getStats: entrambi devono rispettare gli stessi
  // filtri (subject_id/topic_id/onlyWrong/completed) applicati sulla lista dei
  // test, così che le stats mostrate corrispondano a ciò che è filtrato
  private buildFilterPipeline(filter: TestStatsFilterDto): PipelineStage[] {
    const pipeline: PipelineStage[] = [];

    if (filter.onlyWrong) {
      pipeline.push({ $match: { 'questions.is_correct': false } });
    }

    if (filter.completed === true) {
      pipeline.push({ $match: { completedAt: { $exists: true, $ne: null } } });
    } else if (filter.completed === false) {
      pipeline.push({
        $match: {
          $or: [{ completedAt: { $exists: false } }, { completedAt: null }],
        },
      });
    }

    // subject_id/topic_id non sono salvati sul test: si risale alle flashcard
    // delle domande per sapere a quale materia/argomento appartiene il test.
    // questions.flashcard_id in alcuni documenti storici è salvato come stringa
    // invece che come ObjectId: va convertito esplicitamente prima del $lookup,
    // altrimenti il confronto con flashcard._id (ObjectId) non troverebbe nulla
    if (filter.subject_id || filter.topic_id) {
      pipeline.push({
        $addFields: {
          flashcardIds: {
            $map: {
              input: '$questions',
              as: 'q',
              in: { $toObjectId: '$$q.flashcard_id' },
            },
          },
        },
      });

      pipeline.push({
        $lookup: {
          from: 'flashcard',
          localField: 'flashcardIds',
          foreignField: '_id',
          as: 'matchedFlashcards',
        },
      });

      const flashcardMatch: Record<string, any> = {};
      if (filter.subject_id) {
        flashcardMatch['matchedFlashcards.subject_id'] = new Types.ObjectId(
          filter.subject_id,
        );
      }
      if (filter.topic_id) {
        flashcardMatch['matchedFlashcards.topic_id'] = new Types.ObjectId(
          filter.topic_id,
        );
      }
      pipeline.push({ $match: flashcardMatch });
    }

    return pipeline;
  }

  async findAll(
    filter: TestFilterDto,
  ): Promise<BasePaginatedResult<TestDocument>> {
    const pipeline = this.buildFilterPipeline(filter);

    pipeline.push({
      $facet: {
        data: [
          {
            $sort: {
              [filter.sortField]: filter.sortDirection === 'asc' ? 1 : -1,
              _id: -1,
            },
          },
          { $skip: filter.skip },
          { $limit: filter.limit },
          { $project: { matchedFlashcards: 0, flashcardIds: 0 } },
        ],
        totalCount: [{ $count: 'count' }],
      },
    });

    const [result] = await this.testModel.aggregate(pipeline).exec();

    return {
      data: result.data,
      count: result.totalCount[0]?.count ?? 0,
    };
  }

  async getStats(filter: TestStatsFilterDto = {}): Promise<TestStats> {
    const pipeline = this.buildFilterPipeline(filter);

    pipeline.push(
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
    );

    const [result] = await this.testModel.aggregate(pipeline);

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
