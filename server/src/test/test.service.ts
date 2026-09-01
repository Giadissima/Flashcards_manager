import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { BasePaginatedResult } from 'src/common.dto';
import {
  assertValidObjectId,
  deleteByIdOrThrow,
  findByIdOrThrow,
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

    // $facet runs several independent sub-pipelines over the *same* input
    // documents and returns each result under its own key, as one document.
    // It is what lets a single trip to the database answer the two questions a
    // paginated list always asks: which tests belong on this page, and how many
    // there are in total. Run separately, the count would have to repeat every
    // filter above and could disagree with the page it labels.
    // Note that each branch starts from the filtered set, not from the output
    // of the other: 'data' paginates it, 'totalCount' counts it whole.
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
          // The subject and the topic of a test are not stored on it either:
          // like the filter above, they are resolved through the flashcards of
          // its questions. These stages sit after $skip/$limit on purpose, so
          // they only touch the tests of the page being returned.
          {
            $addFields: {
              pageFlashcardIds: {
                $map: {
                  input: '$questions',
                  as: 'q',
                  in: { $toObjectId: '$$q.flashcard_id' },
                },
              },
            },
          },
          // $lookup is Mongo's join: for each test coming through, it reads
          // the documents of another collection whose 'foreignField' matches
          // this one's 'localField', and attaches them under 'as' - always as
          // an array, even when a single document matches.
          {
            $lookup: {
              from: 'flashcard',
              localField: 'pageFlashcardIds',
              foreignField: '_id',
              as: 'testMeta',
              // A $lookup normally hands back every matched document whole.
              // 'pipeline' lets the matches be processed inside the lookup, on
              // the database side, so that only the result of that processing
              // is attached to the test. It is worth it here: a test can hold
              // hundreds of questions, and without this every one of their
              // flashcards - question and answer text included - would travel
              // back only to be reduced to the two values below. One row per
              // test comes out instead.
              pipeline: [
                // $group is SQL's GROUP BY with the aggregate functions folded
                // into the same stage. '_id' is the grouping key, and null means
                // no key at all: every matched flashcard collapses into a single
                // row, the way a COUNT(*) with no GROUP BY does. Every other
                // field has to go through an accumulator ($sum, $first,
                // $addToSet, ...) - unlike SQL, a plain column cannot be carried
                // through untouched.
                {
                  $group: {
                    _id: null,
                    // $first takes the value of the first document to arrive.
                    // That is only meaningful because a test is built from a
                    // single subject, so every card carries the same one; with
                    // no $sort before it, the "first" document is otherwise in
                    // no defined order.
                    subject_id: { $first: '$subject_id' },
                    // $addToSet is a DISTINCT: it collects the differing values
                    // and drops repeats. The topic is not unique the way the
                    // subject is - a test set up by subject spans every topic of
                    // that subject - so what matters here is how many distinct
                    // ones come out.
                    topic_ids: { $addToSet: '$topic_id' },
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              subjectId: { $arrayElemAt: ['$testMeta.subject_id', 0] }, // lookup always returns an array, so we need to deconstruct it
              topicIds: { $arrayElemAt: ['$testMeta.topic_ids', 0] },
            },
          },
          {
            $lookup: {
              from: 'subject',
              localField: 'subjectId',
              foreignField: '_id',
              as: 'testSubjects',
              pipeline: [{ $project: { name: 1 } }],
            },
          },
          {
            $lookup: {
              from: 'topic',
              localField: 'topicIds',
              foreignField: '_id',
              as: 'testTopics',
              pipeline: [{ $project: { name: 1 } }],
            },
          },
          {
            $addFields: {
              subject_name: { $arrayElemAt: ['$testSubjects.name', 0] },
              // Sent only when the whole test shares one topic: with several of
              // them no single name would be true, so none is sent and the row
              // shows the subject alone.
              topic_name: {
                $cond: [
                  { $eq: [{ $size: { $ifNull: ['$topicIds', []] } }, 1] },
                  { $arrayElemAt: ['$testTopics.name', 0] },
                  null,
                ],
              },
            },
          },
          {
            $project: {
              matchedFlashcards: 0,
              flashcardIds: 0,
              pageFlashcardIds: 0,
              testMeta: 0,
              subjectId: 0,
              topicIds: 0,
              testSubjects: 0,
              testTopics: 0,
            },
          },
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

  findOne(id: string): Promise<TestDocument> {
    return findByIdOrThrow<TestDocument>(this.testModel, id, ENTITY);
  }
}
