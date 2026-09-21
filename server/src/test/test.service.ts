import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { BasePaginatedResult } from 'src/common.dto';
import { dateRangeQuery } from 'src/common/date-range.util';
import {
  assertValidObjectId,
  deleteOwnedOrThrow,
} from 'src/common/mongo.util';

import { Test, TestDocument } from './test.schema';
import { Model, PipelineStage, Types } from 'mongoose';
import {
  QuestionDto,
  TestCreateRequest,
  TestFilterDto,
  TestStats,
  TestStatsFilterDto,
  TestTopic,
} from './test.dto';
import { FlashcardsService } from 'src/flashcards/flashcards.service';

const ENTITY = 'Test';

@Injectable()
export class TestService {
  constructor(
    @InjectModel(Test.name) private testModel: Model<Test>,
    private readonly flashcardService: FlashcardsService,
  ) {}

  // Total number of questions in the test, without pulling the whole
  // 'questions' array into memory: $size is computed by Mongo and only the
  // resulting number travels over the wire
  async getQuestionsCount(
    userId: string,
    test_id: string,
  ): Promise<{
    count: number;
    elapsed_time?: number;
  }> {
    assertValidObjectId(test_id);

    const [result] = await this.testModel.aggregate([
      { $match: this.ownedById(userId, test_id) },
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
    userId: string,
    test_id: string,
    skip: number,
    limit: number,
  ): Promise<QuestionDto[]> {
    assertValidObjectId(test_id);

    const [result] = await this.testModel.aggregate([
      { $match: this.ownedById(userId, test_id) },
      { $project: { questions: { $slice: ['$questions', skip, limit] } } },
    ]);

    if (!result) throw new NotFoundException('test not found');

    return result.questions;
  }

  /**
   * The topics the questions of a test are on, named, each with the subject it
   * belongs to. Read from the questions themselves, which carry their topic, so
   * the flashcards are not touched: the review filters by topic (and, on a
   * daily review spanning several subjects, by subject too) and the cards
   * behind the questions are only fetched one page at a time.
   *
   * A topic that has been deleted since drops out rather than being listed
   * without a name: what comes back is a list of choices, and a choice with no
   * label cannot be offered. Its subject can still be missing on its own (e.g.
   * deleted separately), in which case the topic is kept but names no subject.
   */
  async getTopics(userId: string, id: string): Promise<TestTopic[]> {
    assertValidObjectId(id);

    if (!(await this.testModel.exists(this.ownedById(userId, id))))
      throw new NotFoundException('test not found');

    return this.testModel.aggregate<TestTopic>([
      { $match: this.ownedById(userId, id) },
      { $unwind: '$questions' },
      { $group: { _id: '$questions.topic_id' } },
      {
        $lookup: {
          from: 'topic',
          localField: '_id',
          foreignField: '_id',
          as: 'topic',
        },
      },
      { $unwind: '$topic' },
      {
        $lookup: {
          from: 'subject',
          localField: 'topic.subject_id',
          foreignField: '_id',
          as: 'subject',
        },
      },
      { $unwind: { path: '$subject', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          name: '$topic.name',
          color: '$topic.color',
          subject_id: '$topic.subject_id',
          subject_name: '$subject.name',
        },
      },
      { $sort: { name: 1 } },
    ]);
  }

  // Marks the test as completed without having the client read back and
  // rewrite the whole document, the 'questions' array included
  completeTest(userId: string, id: string, elapsed_time: number) {
    assertValidObjectId(id);
    return this.testModel.findOneAndUpdate(
      { _id: id, user_id: userId },
      { completedAt: new Date(), elapsed_time },
    );
  }

  // Closes an unfinished test early, from the history page, with nothing new
  // to say about it: the remaining questions stay blank. Unlike completeTest,
  // this backdates completedAt to the test's own updatedAt - its last actual
  // activity - and skips the timestamps plugin so updatedAt itself does not
  // move. Otherwise closing it would read as new activity and jump the test
  // to the top of a history sorted by updatedAt, ahead of tests genuinely
  // worked on more recently.
  terminateTest(userId: string, id: string) {
    assertValidObjectId(id);
    return this.testModel.findOneAndUpdate(
      { _id: id, user_id: userId },
      [{ $set: { completedAt: '$updatedAt' } }],
      { timestamps: false },
    );
  }
  // TODO find a way to filter only the questions that have no category
  async create(
    userId: string,
    test: TestCreateRequest,
  ): Promise<TestDocument> {
    // The questions arrive with the topic each is on, so the topics of the test
    // are read off them rather than looked up again: one rule for what a test
    // is about, and no second answer to disagree with the questions. Resolved
    // here, once, instead of on every read: what the test is about cannot
    // change afterwards, since its questions are fixed.
    const topic_id = [
      ...new Set(test.questions.map((q) => q.topic_id).filter(Boolean)),
    ];
    // The subject is the one thing a question does not carry, so it is still
    // read from the cards. A daily review can span several subjects at once,
    // so every distinct one among the test's cards is kept, not just the first.
    // Scoped to the caller, like every other read of the flashcards: cards that
    // are not theirs answer nothing, so a test cannot be built over them.
    const subject_id = await this.flashcardService.getSubjects(
      userId,
      test.questions.map((q) => q.flashcard_id),
    );
    return new this.testModel({
      ...test,
      subject_id,
      topic_id,
      user_id: userId,
    }).save();
  }

  updateelapsed_time(userId: string, id: string, time: number) {
    assertValidObjectId(id);
    return this.testModel.findOneAndUpdate(
      { _id: id, user_id: userId },
      { elapsed_time: time },
    );
  }

  delete(userId: string, id: string): Promise<void> {
    return deleteOwnedOrThrow(this.testModel, id, userId, ENTITY);
  }

  async updateAnswer(
    userId: string,
    test_id: string,
    question_id: string,
    is_correct: boolean | undefined,
  ) {
    assertValidObjectId(test_id);
    assertValidObjectId(question_id);

    // Read this question's own prior state first: whether it already had a
    // verdict, and, if a Leitner review already ran for it, what box it
    // started from and when. A question appears at most once per test, so
    // this state is unambiguous.
    const before = await this.testModel.findOne(
      { _id: test_id, user_id: userId, 'questions.flashcard_id': question_id },
      { 'questions.$': 1 },
    );
    if (!before) return null;
    const question = before.questions[0];
    const previous = question.is_correct;

    // The box this question's review is anchored to: fixed the first time it
    // is answered (or, for a question answered before this anchor existed,
    // recovered from the card's current box on the first touch after the
    // upgrade). A later correction reuses the same anchor instead of
    // re-reading the card's box, which may have moved on by then.
    let sr_box_before = question.sr_box_before;
    if (is_correct !== undefined && sr_box_before === undefined) {
      sr_box_before = await this.flashcardService.getBox(userId, question_id);
    }

    const update =
      is_correct === undefined
        ? {
            $unset: {
              'questions.$.is_correct': '',
              'questions.$.sr_box_before': '',
              'questions.$.sr_reviewed_at': '',
            },
          }
        : { $set: { 'questions.$.is_correct': is_correct, 'questions.$.sr_box_before': sr_box_before } };

    const result = await this.testModel.findOneAndUpdate(
      { _id: test_id, user_id: userId, 'questions.flashcard_id': question_id },
      update,
      { new: true },
    );

    if (is_correct === undefined) {
      // Only undo a review that actually ran: a question can be cleared
      // before ever having an anchored box, e.g. legacy data.
      if (previous !== undefined && sr_box_before !== undefined) {
        await this.flashcardService.revertReview(
          userId,
          question_id,
          previous === false,
          sr_box_before,
          question.sr_reviewed_at,
        );
      }
    } else {
      const reviewedAt = await this.flashcardService.recordReview(
        userId,
        question_id,
        is_correct,
        sr_box_before ?? 0,
        previous === undefined,
        previous === false,
        previous === undefined ? undefined : question.sr_reviewed_at,
      );
      if (reviewedAt) {
        await this.testModel.updateOne(
          { _id: test_id, user_id: userId, 'questions.flashcard_id': question_id },
          { $set: { 'questions.$.sr_reviewed_at': reviewedAt } },
        );
      }
    }

    return result;
  }

  /**
   * The $match every aggregation over a single test opens with. An aggregation
   * does not cast strings the way find() does, so both ids are converted here.
   */
  private ownedById(userId: string, id: string) {
    return { _id: new Types.ObjectId(id), user_id: new Types.ObjectId(userId) };
  }

  // Shared by findAll and getStats: both must honour the same filters
  // (subject_id/topic_id/onlyWrong/completed) applied to the test list, so that
  // the stats shown always match what is currently filtered
  private buildFilterPipeline(
    userId: string,
    filter: TestStatsFilterDto,
  ): PipelineStage[] {
    // First stage of both lists: the owner narrows the set before any optional
    // filter is considered, so no query can leave it out by accident.
    const pipeline: PipelineStage[] = [
      { $match: { user_id: new Types.ObjectId(userId) } },
    ];

    // On when the test was taken. The list shows the day it was finished when
    // there is one, but an unfinished test has no such day and would drop out
    // of every range it belongs in.
    const createdAt = dateRangeQuery(filter);
    if (createdAt) pipeline.push({ $match: { createdAt } });

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
    // them. Each holds every subject/topic the test touches, and Mongo compares
    // a value against each element of an array: a filter by either returns
    // every test that touches it, one built on a single subject/topic and a
    // daily review spanning several alike.
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

    // Whether the test was built from the tester's own library or from a
    // community post, told apart by source_post_id: set only in the latter case.
    if (filter.source === 'own') {
      pipeline.push({ $match: { source_post_id: { $exists: false } } });
    } else if (filter.source === 'community') {
      pipeline.push({ $match: { source_post_id: { $exists: true } } });
    }

    return pipeline;
  }

  /**
   * Turns the subjects and topics stored on a test into their names. Shared by
   * the paginated list and by the single test, so both describe a test the
   * same way; the list pushes it after $skip/$limit, so it only touches the
   * tests of the page being returned.
   */
  private subjectAndTopicStages(): PipelineStage.FacetPipelineStage[] {
    return [
      // $lookup is Mongo's join: for each test coming through, it reads the
      // documents of another collection matched by the inner pipeline, and
      // attaches them under 'as' - always as an array, even when a single
      // document matches. Matched through $expr rather than
      // localField/foreignField because Mongo forbids combining those with a
      // pipeline. The inner pipeline keeps only the name, which is all that
      // travels back.
      {
        $lookup: {
          from: 'subject',
          // subject_id is an array on every test created since a test could
          // span more than one subject, but a test created before that holds
          // a single id, not wrapped in one - normalized to an array here so
          // both read the same way.
          let: {
            subjectIds: {
              $cond: [
                { $isArray: '$subject_id' },
                '$subject_id',
                { $cond: [{ $ifNull: ['$subject_id', false] }, ['$subject_id'], []] },
              ],
            },
          },
          pipeline: [
            { $match: { $expr: { $in: ['$_id', '$$subjectIds'] } } },
            { $project: { name: 1 } },
            { $sort: { name: 1 } },
          ],
          as: 'testSubjects',
        },
      },
      {
        $lookup: {
          from: 'topic',
          let: { topicIds: '$topic_id' },
          pipeline: [
            { $match: { $expr: { $in: ['$_id', '$$topicIds'] } } },
            { $project: { name: 1 } },
            { $sort: { name: 1 } },
          ],
          as: 'testTopics',
        },
      },
      {
        $addFields: {
          // Every name, in order, and the reader decides what to make of them:
          // one is stated, several are counted. A deleted subject or topic
          // drops out here rather than being carried as a blank, so a test
          // says as many as it can still name.
          subject_names: '$testSubjects.name',
          topic_names: '$testTopics.name',
        },
      },
      { $project: { testSubjects: 0, testTopics: 0 } },
    ];
  }

  // The list only ever shows root tests - a "repeat the wrong ones" is
  // reached by expanding its parent in the tree, not as a row of its own -
  // so the filters above narrow the roots themselves (a chain with a match
  // buried in a child, but not at the root, does not surface it).
  async findAll(
    userId: string,
    filter: TestFilterDto,
  ): Promise<BasePaginatedResult<TestDocument>> {
    const pipeline = this.buildFilterPipeline(userId, filter);
    pipeline.push({ $match: { parent_test_id: { $exists: false } } });

    // Every descendant of each root, however many generations down, walked
    // by repeatedly matching a found test's _id against the next one's
    // parent_test_id. A root sorts by the newest activity anywhere under it -
    // otherwise every fresh "repeat the wrong ones" would bury the tree it
    // belongs to at the bottom of a list ordered by updatedAt, behind trees
    // nobody has touched today. hasChildren is read off the same lookup, so
    // the tree can offer an expand arrow before the client ever asks for a
    // single child.
    pipeline.push(
      {
        $graphLookup: {
          from: 'test',
          startWith: '$_id',
          connectFromField: '_id',
          connectToField: 'parent_test_id',
          as: 'descendants',
        },
      },
      {
        $addFields: {
          lastActivityAt: {
            $max: ['$updatedAt', { $max: '$descendants.updatedAt' }],
          },
          hasChildren: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: '$descendants',
                    as: 'd',
                    cond: { $eq: ['$$d.parent_test_id', '$_id'] },
                  },
                },
              },
              0,
            ],
          },
        },
      },
      { $project: { descendants: 0 } },
    );

    // The only sort the history offers is "most recently active", which for a
    // root means lastActivityAt rather than its own updatedAt; any other sort
    // field passes through unchanged.
    const sortField =
      filter.sortField === 'updatedAt' ? 'lastActivityAt' : filter.sortField;

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
              [sortField]: filter.sortDirection === 'asc' ? 1 : -1,
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

  /**
   * Immediate children of one test - the "repeat the wrong ones" runs built
   * from it - fetched on demand as the reader expands a node in the history
   * tree rather than walked down for every test on the page. Each child
   * carries its own hasChildren, so a further arrow can be offered without a
   * round trip just to find out one is needed.
   */
  async getChildren(userId: string, id: string): Promise<TestDocument[]> {
    assertValidObjectId(id);

    return this.testModel.aggregate<TestDocument>([
      {
        $match: {
          parent_test_id: new Types.ObjectId(id),
          user_id: new Types.ObjectId(userId),
        },
      },
      {
        $lookup: {
          from: 'test',
          let: { testId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$parent_test_id', '$$testId'] } } },
            { $limit: 1 },
            { $project: { _id: 1 } },
          ],
          as: 'ownChildren',
        },
      },
      { $addFields: { hasChildren: { $gt: [{ $size: '$ownChildren' }, 0] } } },
      { $project: { ownChildren: 0 } },
      ...this.subjectAndTopicStages(),
      { $sort: { updatedAt: -1 } },
    ]);
  }

  async getStats(
    userId: string,
    filter: TestStatsFilterDto = {},
  ): Promise<TestStats> {
    const pipeline = this.buildFilterPipeline(userId, filter);

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

  async findOne(userId: string, id: string): Promise<TestDocument> {
    assertValidObjectId(id);

    const [test] = await this.testModel
      .aggregate<TestDocument>([
        { $match: this.ownedById(userId, id) },
        ...this.subjectAndTopicStages(),
      ])
      .exec();

    if (!test) {
      throw new NotFoundException(`${ENTITY} with id ${id} not found`);
    }
    return test;
  }
}
