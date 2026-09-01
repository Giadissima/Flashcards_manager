import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
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
export class TestService implements OnModuleInit {
  private readonly logger = new Logger(TestService.name);

  /**
   * Tests created before subject_id/topic_id were stored on the test carry
   * neither, which would leave them without a subject on every screen and out
   * of every filter by subject. They are filled in once, from the flashcards of
   * their questions - the way those two values used to be resolved on read.
   * Once done, the check below is a single indexed query at startup.
   */
  async onModuleInit(): Promise<void> {
    const pending = await this.testModel
      .find({ subject_id: { $exists: false } }, { questions: 1 })
      .exec();
    if (!pending.length) return;

    for (const test of pending) {
      const { subject_id, topic_id } =
        await this.flashcardService.getSubjectAndTopic(
          test.questions.map((q) => q.flashcard_id),
        );
      // A test whose flashcards were all deleted resolves to nothing: it is
      // still marked, with null, so it is not looked at again at every startup.
      await this.testModel
        .updateOne(
          { _id: test._id },
          { $set: { subject_id: subject_id ?? null, topic_id: topic_id ?? null } },
        )
        .exec();
    }

    this.logger.log(`Backfilled subject and topic on ${pending.length} test(s)`);
  }

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
    // Resolved here, once, instead of on every read of the test: what the test
    // is about cannot change afterwards, since its questions are fixed.
    const { subject_id, topic_id } = await this.flashcardService.getSubjectAndTopic(
      test.questions.map((q) => q.flashcard_id),
    );
    return new this.testModel({ ...test, subject_id, topic_id }).save();
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

    // Both are stored on the test itself, so no join is needed to filter by
    // them. topic_id is only set on tests whose questions share one topic,
    // which is exactly the set a filter by topic should return.
    if (filter.subject_id) {
      pipeline.push({
        $match: { subject_id: new Types.ObjectId(filter.subject_id) },
      });
    }
    if (filter.topic_id) {
      pipeline.push({
        $match: { topic_id: new Types.ObjectId(filter.topic_id) },
      });
    }

    return pipeline;
  }

  /**
   * Turns the subject and topic stored on a test into their names. Shared by
   * the paginated list and by the single test, so both describe a test the
   * same way; the list pushes it after $skip/$limit, so it only touches the
   * tests of the page being returned.
   */
  private subjectAndTopicStages(): PipelineStage.FacetPipelineStage[] {
    return [
      // $lookup is Mongo's join: for each test coming through, it reads the
      // documents of another collection whose 'foreignField' matches this
      // one's 'localField', and attaches them under 'as' - always as an array,
      // even when a single document matches. The inner pipeline keeps only the
      // name, which is all that travels back.
      {
        $lookup: {
          from: 'subject',
          localField: 'subject_id',
          foreignField: '_id',
          as: 'testSubjects',
          pipeline: [{ $project: { name: 1 } }],
        },
      },
      {
        $lookup: {
          from: 'topic',
          localField: 'topic_id',
          foreignField: '_id',
          as: 'testTopics',
          pipeline: [{ $project: { name: 1 } }],
        },
      },
      {
        $addFields: {
          subject_name: { $arrayElemAt: ['$testSubjects.name', 0] },
          // Null rather than missing, so a test spanning several topics is
          // told apart from one whose topic was deleted only by the name.
          topic_name: { $ifNull: [{ $arrayElemAt: ['$testTopics.name', 0] }, null] },
        },
      },
      { $project: { testSubjects: 0, testTopics: 0 } },
    ];
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
          ...this.subjectAndTopicStages(),
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
    assertValidObjectId(id);

    const [test] = await this.testModel
      .aggregate<TestDocument>([
        { $match: { _id: new Types.ObjectId(id) } },
        ...this.subjectAndTopicStages(),
      ])
      .exec();

    if (!test) {
      throw new NotFoundException(`${ENTITY} with id ${id} not found`);
    }
    return test;
  }
}
