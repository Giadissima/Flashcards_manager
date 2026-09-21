import {
  CardListFilterRequest,
  CountFlashcardsDTO,
  ModifyFlashcardDto,
  RandomFlashcard,
  RandomFlashcardsDTO,
} from './flashcards.dto';
import { InjectModel } from '@nestjs/mongoose';
import { PublishingService } from 'src/common/publishing.service';
import { Visibility, defaultVisibility } from 'src/common/visibility';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Flashcard, FlashcardDocument } from './flashcards.schema';
import { FilterQuery, Model, PipelineStage, Types } from 'mongoose';
import { BasePaginatedResult } from 'src/common.dto';
import { dateRangeQuery } from 'src/common/date-range.util';
import {
  assertValidObjectId,
  findPaginated,
  updateOwnedOrThrow,
} from 'src/common/mongo.util';
import { extractImageFileIds, replaceImageFileIds } from 'src/common/html.util';
import { FileService } from 'src/file/file.service';
import { PostService } from 'src/post/post.service';
import { Subject } from 'src/subject/subject.schema';
import { Topic } from 'src/topic/topic.schema';

const ENTITY = 'Flashcard';
// The source card's owner is populated two levels deep, live rather than
// snapshotted: the badge reads it fresh every time, so a rename shows up
// right away and a source card or account gone by then just reads as unknown.
const POPULATE = [
  'topic_id',
  'subject_id',
  {
    path: 'imported_from',
    select: 'user_id',
    populate: { path: 'user_id', select: 'username' },
  },
];
const defaultRandomSampleSize = 10;

// The Leitner boxes a card moves through: index is the box number, value is
// how many days out the next review lands once the card reaches it. Box 0 is
// "due now" - a brand new card, or one just gotten wrong.
const srIntervalDays = [0, 1, 3, 7, 14, 30];
const srMaxBox = srIntervalDays.length - 1;

// A card counts as "weak" once it has been gotten wrong at least this share
// of the times it has been reviewed - independent of the Leitner box, which
// tracks how soon a card is due rather than how often it is missed.
const weakWrongRatio = 0.45;

@Injectable()
export class FlashcardsService {
  constructor(
    @InjectModel(Flashcard.name)
    private flashcardModel: Model<Flashcard>,
    private readonly fileService: FileService,
    @InjectModel(Subject.name) private subjectModel: Model<Subject>,
    @InjectModel(Topic.name) private topicModel: Model<Topic>,
    private readonly postService: PostService,
    private readonly publishing: PublishingService,
  ) {}

  async create(
    userId: string,
    createFlashcardDto: ModifyFlashcardDto,
  ): Promise<void> {
    const owned = await this.claimImages(userId, createFlashcardDto);
    // A card added under something already shared is shared with it, unless
    // the form said otherwise: the topic or subject was made public exactly
    // to carry what goes in it.
    const visibility =
      owned.visibility ?? (await this.inheritedVisibility(userId, owned));
    // Checked against the resolved value, not the raw one: inheriting public
    // from the topic or subject counts as publishing too.
    await this.publishing.assertMayPublish(userId, visibility);

    const created = await new this.flashcardModel({
      ...owned,
      user_id: userId,
      visibility,
      // Same idea for spaced repetition: a card added to a topic already
      // turned on for it starts on, instead of waiting for the topic's
      // toggle to be flipped off and on again to catch it.
      in_spaced_repetition: await this.inheritedSpacedRepetition(userId, owned),
    }).save();

    if (created.subject_id) {
      await this.postService.refresh(userId, created.subject_id);
    }
  }

  /** "public" when the topic, or failing that the subject, is itself public. */
  private async inheritedVisibility(
    userId: string,
    dto: ModifyFlashcardDto,
  ): Promise<Visibility> {
    if (dto.topic_id) {
      const topic = await this.topicModel
        .findOne({ _id: dto.topic_id, user_id: userId }, { visibility: 1 })
        .lean()
        .exec();
      if (topic?.visibility === 'public') return 'public';
    }
    if (dto.subject_id) {
      const subject = await this.subjectModel
        .findOne({ _id: dto.subject_id, user_id: userId }, { visibility: 1 })
        .lean()
        .exec();
      if (subject?.visibility === 'public') return 'public';
    }
    return defaultVisibility;
  }

  /** Whether the topic the card is added to is itself in spaced repetition - only topics carry the flag, not subjects. */
  private async inheritedSpacedRepetition(
    userId: string,
    dto: ModifyFlashcardDto,
  ): Promise<boolean> {
    if (!dto.topic_id) return false;
    const topic = await this.topicModel
      .findOne({ _id: dto.topic_id, user_id: userId }, { in_spaced_repetition: 1 })
      .lean()
      .exec();
    return topic?.in_spaced_repetition ?? false;
  }

  /**
   * Owned by the caller, or public: a test built from a community post
   * references cards that belong to whoever shared them, and the runner reads
   * each one back through this same endpoint - the same rule the post's own
   * carousel and import already read them under, just reached a different way.
   */
  async findOne(userId: string, id: string): Promise<FlashcardDocument> {
    assertValidObjectId(id);
    const card = await this.flashcardModel
      .findOne({
        _id: id,
        $or: [{ user_id: userId }, { visibility: 'public' }],
      })
      .populate(POPULATE)
      .exec();
    if (!card) {
      throw new NotFoundException(`${ENTITY} with id ${id} not found`);
    }
    return card;
  }

  findAll(
    userId: string,
    filter: CardListFilterRequest,
  ): Promise<BasePaginatedResult<FlashcardDocument>> {
    // The owner is not one of the optional filters: it is the first thing every
    // query is narrowed by, so nobody can list what is not theirs.
    const query: FilterQuery<Flashcard> = { user_id: userId };
    if (filter.subject_id) query.subject_id = filter.subject_id;
    if (filter.topic_id) query.topic_id = filter.topic_id;
    if (filter.title) {
      const regex = { $regex: filter.title, $options: 'i' };
      query.$or = [{ title: regex }, { question: regex }];
    }
    // A three-way filter over one boolean field: present and true narrows to
    // imported cards, present and false to the reader's own, absent leaves
    // both in.
    if (filter.imported === true) query.imported = true;
    else if (filter.imported === false) query.imported = { $ne: true };

    // On when the card was written, which is the only date it has and the one
    // the list can already be sorted by.
    const createdAt = dateRangeQuery(filter);
    if (createdAt) query.createdAt = createdAt;

    return findPaginated<FlashcardDocument>(
      this.flashcardModel,
      query,
      filter,
      POPULATE,
    );
  }

  /**
   * The flashcards a new test is built from, with the topic of each: the test
   * keeps every topic it touches, and taking them from the cards that were
   * drawn saves reading those same cards again to find out.
   */
  getRandom(
    userId: string,
    filter: RandomFlashcardsDTO,
  ): Promise<RandomFlashcard[]> {
    return this.flashcardModel
      .aggregate<RandomFlashcard>([
        { $match: this.buildObjectIdQuery(userId, filter) },
        { $sample: { size: filter.numFlashcard || defaultRandomSampleSize } },
        {
          $project: {
            _id: { $toString: '$_id' },
            topic_id: { $toString: '$topic_id' },
          },
        },
      ])
      .exec();
  }

  /**
   * The flashcards currently due for spaced repetition: in a topic marked for
   * it, and not due later than now. Most overdue first, since that is the
   * card most at risk of being forgotten if the test runs out before reaching
   * it.
   */
  getDue(
    userId: string,
    filter: RandomFlashcardsDTO,
  ): Promise<RandomFlashcard[]> {
    const query = this.buildObjectIdQuery(userId, filter);
    query.in_spaced_repetition = true;
    // A card written before this field existed has no sr_due_at stored at
    // all - the schema's default only applies to a document as it is
    // created, never retroactively to one already sitting in the collection
    // - and $lte against a field that is simply absent does not match it.
    // Such a card is exactly as due as a brand new one would be, so missing
    // counts as due alongside "due today or earlier".
    query.$or = [
      { sr_due_at: { $exists: false } },
      { sr_due_at: { $lte: new Date() } },
    ];

    // Unlike getRandom/getWeak, an unset numFlashcard here is not filled in
    // with defaultRandomSampleSize: the daily review is meant to show every
    // due card by default, not just a sample of them.
    const pipeline: PipelineStage[] = [
      { $match: query },
      { $sort: { sr_due_at: 1 } },
    ];
    if (filter.numFlashcard) {
      pipeline.push({ $limit: filter.numFlashcard });
    }
    pipeline.push({
      $project: {
        _id: { $toString: '$_id' },
        topic_id: { $toString: '$topic_id' },
      },
    });

    return this.flashcardModel.aggregate<RandomFlashcard>(pipeline).exec();
  }

  /**
   * The flashcards gotten wrong at least weakWrongRatio of the times they
   * have been reviewed - the cards actually worth retrying, as opposed to
   * ones merely due soon (that is what the Leitner-driven daily test is
   * for). A card never reviewed has no ratio to speak of and is excluded.
   * Sampled at random like getRandom, since there is no ordering among these
   * cards that means more than another.
   */
  getWeak(
    userId: string,
    filter: RandomFlashcardsDTO,
  ): Promise<RandomFlashcard[]> {
    const query = this.buildObjectIdQuery(userId, filter);
    query.review_count = { $gt: 0 };
    query.$expr = {
      $gte: [{ $divide: ['$wrong_count', '$review_count'] }, weakWrongRatio],
    };

    return this.flashcardModel
      .aggregate<RandomFlashcard>([
        { $match: query },
        { $sample: { size: filter.numFlashcard || defaultRandomSampleSize } },
        {
          $project: {
            _id: { $toString: '$_id' },
            topic_id: { $toString: '$topic_id' },
          },
        },
      ])
      .exec();
  }

  // The card's current sr_box, read for a question being answered for the
  // first time in a test (or one with no stored anchor yet): the box the
  // Leitner progression should start from.
  async getBox(userId: string, id: string): Promise<number> {
    const existing = await this.flashcardModel
      .findOne({ _id: id, user_id: userId }, { sr_box: 1 })
      .lean()
      .exec();
    return existing?.sr_box ?? 0;
  }

  /**
   * Moves a card through its Leitner boxes after it is answered in any test,
   * not only a spaced-repetition one: reviewing a topic early, ahead of its
   * own schedule, still has to push the next date out, or studying for an
   * exam before daily catches up would count for nothing. A card belonging to
   * someone else, or already gone, is silently skipped - the same as any
   * other flashcard a test's questions can outlive.
   *
   * fromBox is the box to progress from - normally the card's box before this
   * question was ever answered in its test, so that flipping the same
   * question between right and wrong (a misclick, then a correction) always
   * lands on the same result instead of compounding with each toggle.
   *
   * countsAsNewReview is false when this call is only correcting an already
   * counted answer (right<->wrong on the same question): review_count is not
   * incremented again, and wrong_count is adjusted by the net change instead
   * of blindly incremented.
   *
   * On a correction (countsAsNewReview false), reviewedAt is the timestamp
   * the question's original review wrote onto the card. The box is only
   * moved from fromBox when that still matches the card's current
   * sr_last_reviewed_at - i.e. nothing else has reviewed the same card since.
   * If another test reviewed it meanwhile, its box has moved on legitimately,
   * and this correction must not overwrite that: the box, due date and
   * last-reviewed date are left alone, though review_count/wrong_count - a
   * running tally, not a snapshot of "current state" - are still adjusted.
   */
  async recordReview(
    userId: string,
    id: string,
    isCorrect: boolean,
    fromBox: number,
    countsAsNewReview: boolean,
    previousWasWrong = false,
    reviewedAt?: Date,
  ): Promise<Date | undefined> {
    const existing = await this.flashcardModel
      .findOne({ _id: id, user_id: userId }, { sr_last_reviewed_at: 1 })
      .lean()
      .exec();
    if (!existing) return undefined;

    const stale =
      !countsAsNewReview &&
      reviewedAt !== undefined &&
      existing.sr_last_reviewed_at?.getTime() !== reviewedAt.getTime();

    const reviewDelta = countsAsNewReview ? 1 : 0;
    // wrong_count reflects the current verdict, not every verdict a question
    // has ever held: a first review adds one when wrong, and a correction
    // swaps out the old verdict's contribution for the new one's.
    const wasWrongBefore = countsAsNewReview ? false : previousWasWrong;
    const wrongDelta = (isCorrect ? 0 : 1) - (wasWrongBefore ? 1 : 0);

    let boxSet: Record<string, unknown> = {};
    let newReviewedAt = reviewedAt;
    if (!stale) {
      const nextBox = isCorrect ? Math.min(fromBox + 1, srMaxBox) : 0;
      const now = new Date();
      const dueAt = new Date(now);
      dueAt.setDate(dueAt.getDate() + srIntervalDays[nextBox]);
      boxSet = { sr_box: nextBox, sr_due_at: dueAt, sr_last_reviewed_at: now };
      newReviewedAt = now;
    }

    await this.flashcardModel
      .updateOne(
        { _id: id, user_id: userId },
        {
          $set: boxSet,
          $inc: { review_count: reviewDelta, wrong_count: wrongDelta },
        },
      )
      .exec();

    return newReviewedAt;
  }

  /**
   * Undoes the single review a now-removed answer applied: review_count goes
   * back down by one and wrong_count follows if that answer was wrong.
   *
   * The box itself is only restored to fromBox when reviewedAt still matches
   * the card's sr_last_reviewed_at - i.e. nothing else has reviewed the same
   * card since. If another test reviewed it meanwhile, its box has moved on
   * legitimately, and undoing this stale answer must not overwrite that: the
   * box, due date and last-reviewed date are left as they are.
   */
  async revertReview(
    userId: string,
    id: string,
    wasWrong: boolean,
    fromBox: number,
    reviewedAt: Date | undefined,
  ): Promise<void> {
    const existing = await this.flashcardModel
      .findOne({ _id: id, user_id: userId }, { sr_last_reviewed_at: 1 })
      .lean()
      .exec();
    if (!existing) return;

    const stillFresh =
      reviewedAt !== undefined &&
      existing.sr_last_reviewed_at?.getTime() === reviewedAt.getTime();

    const boxUpdate = stillFresh
      ? (() => {
          const dueAt = new Date();
          dueAt.setDate(dueAt.getDate() + srIntervalDays[fromBox]);
          return { sr_box: fromBox, sr_due_at: dueAt };
        })()
      : {};

    await this.flashcardModel
      .updateOne(
        { _id: id, user_id: userId },
        {
          $set: boxUpdate,
          $inc: { review_count: -1, wrong_count: wasWrong ? -1 : 0 },
        },
      )
      .exec();
  }

  /**
   * The subject the given flashcards belong to. A test is built from a single
   * subject, so it is taken from the first card that answers.
   *
   * Used when a test is created, to store on it what it is about. Its topics
   * are not asked for here: the questions of a test carry the topic each is on,
   * which is where the test reads them from.
   *
   * Owned by the caller, or public: a test can also be built from a community
   * post's flashcards (see PostCardComponent.openTry), which belong to
   * whoever shared them - the subject is still theirs to read, the same way
   * the post's own carousel already does.
   */
  async getSubject(
    userId: string,
    ids: (string | Types.ObjectId)[],
  ): Promise<Types.ObjectId | undefined> {
    if (!ids.length) return undefined;

    const [result] = await this.flashcardModel
      .aggregate<{ subject_id?: Types.ObjectId }>([
        {
          $match: {
            _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
            $or: [
              { user_id: new Types.ObjectId(userId) },
              { visibility: 'public' },
            ],
          },
        },
        { $group: { _id: null, subject_id: { $first: '$subject_id' } } },
      ])
      .exec();

    return result?.subject_id ?? undefined;
  }

  count(userId: string, filter: CountFlashcardsDTO): Promise<number> {
    return this.flashcardModel
      .countDocuments(this.buildObjectIdQuery(userId, filter))
      .exec();
  }

  // Not routed through deleteByIdOrThrow: the images live inside the HTML, so
  // the document has to be read before it goes to know what to delete with it.
  async delete(userId: string, id: string): Promise<void> {
    assertValidObjectId(id);

    const existing = await this.flashcardModel
      .findOneAndDelete({ _id: id, user_id: userId })
      .exec();
    if (!existing) {
      throw new NotFoundException(`${ENTITY} with id ${id} not found`);
    }

    // Unconditionally, with no check on who else might point at them: a file
    // belongs to one flashcard only, which is what claimImages() guarantees.
    await this.deleteImagesOf(existing.question, existing.answer);

    if (existing.subject_id) {
      await this.postService.refresh(userId, existing.subject_id);
    }
  }

  /**
   * Deletes every flashcard matching the filter, images included. Used by the
   * topic and subject cascades: a flashcard can never be left pointing at a
   * topic or a subject that no longer exists, so removing one always takes
   * its cards down with it, the same as removing a single card does.
   */
  async deleteMany(
    userId: string,
    filter: FilterQuery<Flashcard>,
  ): Promise<void> {
    const query: FilterQuery<Flashcard> = { ...filter, user_id: userId };

    const cards = await this.flashcardModel
      .find(query, { question: 1, answer: 1 })
      .lean()
      .exec();
    if (!cards.length) return;

    await Promise.all(cards.map((c) => this.deleteImagesOf(c.question, c.answer)));
    await this.flashcardModel.deleteMany(query).exec();
  }

  async update(
    userId: string,
    id: string,
    updateObj: ModifyFlashcardDto,
  ): Promise<void> {
    assertValidObjectId(id);
    if (updateObj.visibility === 'public') {
      await this.publishing.assertMayPublish(userId, updateObj.visibility);
    }

    const existing = await this.flashcardModel
      .findOne({ _id: id, user_id: userId })
      .lean()
      .exec();
    if (!existing) {
      throw new NotFoundException(`${ENTITY} with id ${id} not found`);
    }

    const owned = await this.claimImages(userId, updateObj, id);
    await updateOwnedOrThrow(this.flashcardModel, id, userId, owned, ENTITY);

    // Images the edit took out of the content have nothing left pointing at
    // them, so they go with it. Done after the update succeeded.
    const before = this.imageIdsOf(existing.question, existing.answer);
    const after = this.imageIdsOf(owned.question, owned.answer);
    await this.deleteFiles(before.filter((fileId) => !after.includes(fileId)));

    await this.refreshPostOf(userId, id);
  }

  private imageIdsOf(question?: string, answer?: string): string[] {
    return [...new Set([...extractImageFileIds(question), ...extractImageFileIds(answer)])];
  }

  private deleteImagesOf(question?: string, answer?: string): Promise<void> {
    return this.deleteFiles(this.imageIdsOf(question, answer));
  }

  private async deleteFiles(ids: string[]): Promise<void> {
    await Promise.all(ids.map((fileId) => this.fileService.delete(fileId)));
  }

  /**
   * Gives the flashcard images of its own, so that deleting it can drop them
   * without asking anyone's permission.
   *
   * The editor uploads a new file for every picture inserted, so normally there
   * is nothing to do. What this catches is content copied from another
   * flashcard, which carries the very same <img src> along: that file is copied
   * and the markup repointed at the copy, rather than being shared - a shared
   * file would turn one deletion into a broken image somewhere else.
   */
  private async claimImages(
    userId: string,
    dto: ModifyFlashcardDto,
    selfId?: string,
  ): Promise<ModifyFlashcardDto> {
    const ids = this.imageIdsOf(dto.question, dto.answer);
    if (!ids.length) return dto;

    const pattern = ids.join('|');
    // Only the cards of the same user can hold the same picture: content is
    // copied between flashcards one can see, and nobody sees another's.
    const query: FilterQuery<Flashcard> = {
      user_id: userId,
      $or: [{ question: { $regex: pattern } }, { answer: { $regex: pattern } }],
    };
    if (selfId) query._id = { $ne: new Types.ObjectId(selfId) };

    const others = await this.flashcardModel
      .find(query, { question: 1, answer: 1 })
      .lean()
      .exec();

    const alreadyTaken = new Set(
      others.flatMap((other) => this.imageIdsOf(other.question, other.answer)),
    );

    const idMap = new Map<string, string>();
    for (const fileId of ids) {
      if (!alreadyTaken.has(fileId)) continue;
      const copyId = await this.fileService.duplicate(fileId);
      // A missing file means the reference was already broken: left as it is,
      // since copying nothing would not mend it
      if (copyId) idMap.set(fileId, copyId);
    }
    if (!idMap.size) return dto;

    return {
      ...dto,
      question: replaceImageFileIds(dto.question, idMap),
      answer: replaceImageFileIds(dto.answer, idMap),
    };
  }

  // The aggregation pipeline does not cast strings to ObjectId the way find()
  // does, so subject_id/topic_id have to be converted explicitly here.
  private buildObjectIdQuery(
    userId: string,
    filter: CountFlashcardsDTO | RandomFlashcardsDTO,
  ): FilterQuery<Flashcard> {
    const query: FilterQuery<Flashcard> = {
      user_id: new Types.ObjectId(userId),
    };
    if (filter.subject_id) {
      query.subject_id = new Types.ObjectId(filter.subject_id);
    }
    // Any of the chosen topics: a test built from several is the union of their
    // cards. No topic given leaves the subject to stand on its own.
    if (filter.topic_ids?.length) {
      query.topic_id = {
        $in: filter.topic_ids.map((id) => new Types.ObjectId(id)),
      };
    }
    if ('visibility' in filter && filter.visibility) {
      query.visibility = filter.visibility;
    }
    const createdAt = dateRangeQuery(filter);
    if (createdAt) query.createdAt = createdAt;
    return query;
  }

  /** Only the visibility, for the quick toggle in the lists. */
  async setVisibility(
    userId: string,
    id: string,
    visibility: Visibility,
  ): Promise<void> {
    if (visibility === 'public') {
      await this.publishing.assertMayPublish(userId, visibility);
    }
    await updateOwnedOrThrow(
      this.flashcardModel,
      id,
      userId,
      { visibility },
      ENTITY,
    );
    await this.refreshPostOf(userId, id);
  }

  private async refreshPostOf(userId: string, cardId: string): Promise<void> {
    const card = await this.flashcardModel
      .findOne({ _id: cardId, user_id: userId }, { subject_id: 1 })
      .lean()
      .exec();
    if (card?.subject_id) {
      await this.postService.refresh(userId, card.subject_id);
    }
  }

}
