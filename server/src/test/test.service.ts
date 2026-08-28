import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { BasePaginatedResult } from 'src/common.dto';
import {
  assertValidObjectId,
  deleteByIdOrThrow,
} from 'src/common/mongo.util';

import { Test, TestDocument } from './test.schema';
import { Model, PipelineStage, Types } from 'mongoose';
import {
  QuestionDto,
  TestCreateRequest,
  TestFilterDto,
  TestStats,
  TestStatsFilterDto,
} from './test.dto';
import { FlashcardsService } from 'src/flashcards/flashcards.service';

const ENTITY = 'Test';

@Injectable()
export class TestService {
  update(id: string, test: TestDocument) {
    assertValidObjectId(id);
    return this.testModel.findByIdAndUpdate(id, test);
  }
  constructor(
    @InjectModel(Test.name) private testModel: Model<Test>,
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

  // Total number of questions in the test, without pulling the whole
  // 'questions' array into memory: $size is computed by Mongo and only the
  // resulting number travels over the wire
  async getQuestionsCount(test_id: string): Promise<{
    count: number;
    elapsed_time?: number;
  }> {
    assertValidObjectId(test_id);

    const [result] = await this.testModel.aggregate([
      { $match: { _id: new Types.ObjectId(test_id) } },
      {
        $project: {
          count: { $size: '$questions' },
          elapsed_time: 1,
        },
      },
    ]);

    if (!result) throw new NotFoundException('test not found');

    return {
      count: result.count,
      elapsed_time: result.elapsed_time,
    };
  }

  // A single page of questions (skip/limit) via $slice: Mongo extracts only the
  // requested slice, without loading the other questions of the test
  async getQuestionsPage(
    test_id: string,
    skip: number,
    limit: number,
  ): Promise<QuestionDto[]> {
    assertValidObjectId(test_id);

    const [result] = await this.testModel.aggregate([
      { $match: { _id: new Types.ObjectId(test_id) } },
      { $project: { questions: { $slice: ['$questions', skip, limit] } } },
    ]);

    if (!result) throw new NotFoundException('test not found');

    return result.questions;
  }

  // Marks the test as completed without having the client read back and
  // rewrite the whole document, the 'questions' array included
  completeTest(id: string, elapsed_time: number) {
    assertValidObjectId(id);
    return this.testModel.findByIdAndUpdate(id, {
      completedAt: new Date(),
      elapsed_time,
    });
  }
  // TODO find a way to filter only the questions that have no category
  async create(test: TestCreateRequest): Promise<TestDocument> {
    return new this.testModel(test).save();
  }

  updateelapsed_time(id: string, time: number) {
    assertValidObjectId(id);
    return this.testModel.findByIdAndUpdate(id, { elapsed_time: time });
  }

  delete(id: string): Promise<void> {
    return deleteByIdOrThrow(this.testModel, id, ENTITY);
  }

  updateAnswer(
    test_id: string,
    question_id: string,
    is_correct: boolean | undefined,
  ) {
    assertValidObjectId(test_id);
    assertValidObjectId(question_id);
    const update =
      is_correct === undefined
        ? { $unset: { 'questions.$.is_correct': '' } }
        : { $set: { 'questions.$.is_correct': is_correct } };
    return this.testModel.findOneAndUpdate(
      { _id: test_id, 'questions.flashcard_id': question_id },
      update,
      { new: true },
    );
  }

  // Shared by findAll and getStats: both must honour the same filters
  // (subject_id/topic_id/onlyWrong/completed) applied to the test list, so that
  // the stats shown always match what is currently filtered
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

    // subject_id/topic_id are not stored on the test: the subject and topic a test
    // belongs to are resolved through the flashcards of its questions.
    // In some historical documents questions.flashcard_id is stored as a string
    // instead of an ObjectId, so it must be converted before the $lookup or it
    // would never match flashcard._id, which is an ObjectId
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
