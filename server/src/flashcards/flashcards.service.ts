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
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Flashcard, FlashcardDocument } from './flashcards.schema';
import { FilterQuery, Model, Types } from 'mongoose';
import { BasePaginatedResult } from 'src/common.dto';
import { dateRangeQuery } from 'src/common/date-range.util';
import {
  assertValidObjectId,
  findOwnedOrThrow,
  findPaginated,
  updateOwnedOrThrow,
} from 'src/common/mongo.util';
import { extractImageFileIds, replaceImageFileIds } from 'src/common/html.util';
import { FileService } from 'src/file/file.service';
import { PostService } from 'src/post/post.service';
import { Subject } from 'src/subject/subject.schema';
import { Topic } from 'src/topic/topic.schema';

const ENTITY = 'Flashcard';
const POPULATE = ['topic_id', 'subject_id'];
const defaultRandomSampleSize = 10;

// The Leitner boxes a card moves through: index is the box number, value is
// how many days out the next review lands once the card reaches it. Box 0 is
// "due now" - a brand new card, or one just gotten wrong.
const srIntervalDays = [0, 1, 3, 7, 14, 30];
const srMaxBox = srIntervalDays.length - 1;

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
    await this.publishing.assertMayPublish(
      userId,
      createFlashcardDto.visibility,
    );

    const owned = await this.claimImages(userId, createFlashcardDto);
    const created = await new this.flashcardModel({
      ...owned,
      user_id: userId,
      // A card added under something already shared is shared with it, unless
      // the form said otherwise: the topic or subject was made public exactly
      // to carry what goes in it.
      visibility: owned.visibility ?? (await this.inheritedVisibility(userId, owned)),
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

  findOne(userId: string, id: string): Promise<FlashcardDocument> {
    return findOwnedOrThrow<FlashcardDocument>(
      this.flashcardModel,
      id,
      userId,
      ENTITY,
      POPULATE,
    );
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
    if (filter.title) query.title = { $regex: filter.title, $options: 'i' };

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

    return this.flashcardModel
      .aggregate<RandomFlashcard>([
        { $match: query },
        { $sort: { sr_due_at: 1 } },
        { $limit: filter.numFlashcard || defaultRandomSampleSize },
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
   * The flashcards currently at Leitner box 0 that have actually been
   * reviewed at least once - the cards being gotten wrong right now, as
   * opposed to a brand new card that also starts at box 0 but has never been
   * tested. Sampled at random like getRandom, since there is no "most
   * overdue" ordering among cards that are not on a schedule.
   */
  getWeak(
    userId: string,
    filter: RandomFlashcardsDTO,
  ): Promise<RandomFlashcard[]> {
    const query = this.buildObjectIdQuery(userId, filter);
    query.sr_box = 0;
    query.sr_last_reviewed_at = { $exists: true };

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

  /**
   * Moves a card through its Leitner boxes after it is answered in any test,
   * not only a spaced-repetition one: reviewing a topic early, ahead of its
   * own schedule, still has to push the next date out, or studying for an
   * exam before daily catches up would count for nothing. A card belonging to
   * someone else, or already gone, is silently skipped - the same as any
   * other flashcard a test's questions can outlive.
   */
  async recordReview(
    userId: string,
    id: string,
    isCorrect: boolean,
  ): Promise<void> {
    const existing = await this.flashcardModel
      .findOne({ _id: id, user_id: userId }, { sr_box: 1 })
      .lean()
      .exec();
    if (!existing) return;

    const nextBox = isCorrect ? Math.min((existing.sr_box ?? 0) + 1, srMaxBox) : 0;
    const now = new Date();
    const dueAt = new Date(now);
    dueAt.setDate(dueAt.getDate() + srIntervalDays[nextBox]);

    await this.flashcardModel
      .updateOne(
        { _id: id, user_id: userId },
        { sr_box: nextBox, sr_due_at: dueAt, sr_last_reviewed_at: now },
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
            user_id: new Types.ObjectId(userId),
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

  async update(
    userId: string,
    id: string,
    updateObj: ModifyFlashcardDto,
  ): Promise<void> {
    assertValidObjectId(id);
    if (updateObj.visibility) {
      await this.assertCanBePublished(userId, id, updateObj.visibility);
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
    return query;
  }

  /** Only the visibility, for the quick toggle in the lists. */
  async setVisibility(
    userId: string,
    id: string,
    visibility: Visibility,
  ): Promise<void> {
    await this.assertCanBePublished(userId, id, visibility);
    await updateOwnedOrThrow(
      this.flashcardModel,
      id,
      userId,
      { visibility },
      ENTITY,
    );
    await this.refreshPostOf(userId, id);
  }

  /**
   * An imported card cannot go back out. It is somebody else's work, kept for
   * studying: republishing it would let the Community fill with copies whose
   * author has no say in them.
   */
  private async assertCanBePublished(
    userId: string,
    cardId: string,
    visibility: Visibility,
  ): Promise<void> {
    if (visibility !== 'public') return;

    await this.publishing.assertMayPublish(userId, visibility);

    const card = await this.flashcardModel
      .findOne({ _id: cardId, user_id: userId }, { imported: 1 })
      .lean()
      .exec();
    if (card?.imported) {
      throw new BadRequestException(
        'An imported flashcard cannot be published again',
      );
    }
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
