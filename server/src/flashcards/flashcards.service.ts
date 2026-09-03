import {
  CountFlashcardsDTO,
  ModifyFlashcardDto,
  RandomFlashcard,
  RandomFlashcardsDTO,
} from './flashcards.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Injectable } from '@nestjs/common';
import { Flashcard, FlashcardDocument } from './flashcards.schema';
import { FilterQuery, Model, Types } from 'mongoose';
import { BasePaginatedResult, ListFilterRequest } from 'src/common.dto';
import {
  deleteByIdOrThrow,
  findByIdOrThrow,
  findPaginated,
  updateByIdOrThrow,
} from 'src/common/mongo.util';

const ENTITY = 'Flashcard';
const POPULATE = ['topic_id', 'subject_id'];
const defaultRandomSampleSize = 10;

@Injectable()
export class FlashcardsService {
  constructor(
    @InjectModel(Flashcard.name)
    private flashcardModel: Model<Flashcard>,
  ) {}

  async create(createFlashcardDto: ModifyFlashcardDto): Promise<void> {
    await new this.flashcardModel(createFlashcardDto).save();
  }

  findOne(id: string): Promise<FlashcardDocument> {
    return findByIdOrThrow<FlashcardDocument>(
      this.flashcardModel,
      id,
      ENTITY,
      POPULATE,
    );
  }

  findAll(
    filter: ListFilterRequest,
  ): Promise<BasePaginatedResult<FlashcardDocument>> {
    const query: FilterQuery<Flashcard> = {};
    if (filter.subject_id) query.subject_id = filter.subject_id;
    if (filter.topic_id) query.topic_id = filter.topic_id;
    if (filter.title) query.title = { $regex: filter.title, $options: 'i' };

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
  getRandom(filter: RandomFlashcardsDTO): Promise<RandomFlashcard[]> {
    return this.flashcardModel
      .aggregate<RandomFlashcard>([
        { $match: this.buildObjectIdQuery(filter) },
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
   * The subject the given flashcards belong to, and every topic they are on. A
   * test is built from a single subject, so the subject is taken from the first
   * card; the topics are all of them, in no particular order, since a set built
   * from a whole subject spans as many as it has.
   *
   * Used when a test is created, to store on it what it is about.
   */
  async getSubjectAndTopic(ids: (string | Types.ObjectId)[]): Promise<{
    subject_id?: Types.ObjectId;
    topic_id: Types.ObjectId[];
  }> {
    if (!ids.length) return { topic_id: [] };

    const [result] = await this.flashcardModel
      .aggregate<{ subject_id?: Types.ObjectId; topic_ids: Types.ObjectId[] }>([
        { $match: { _id: { $in: ids.map((id) => new Types.ObjectId(id)) } } },
        {
          $group: {
            _id: null,
            subject_id: { $first: '$subject_id' },
            // A DISTINCT: what matters is how many different topics come out.
            topic_ids: { $addToSet: '$topic_id' },
          },
        },
      ])
      .exec();

    if (!result) return { topic_id: [] };
    return {
      subject_id: result.subject_id ?? undefined,
      // A card with no topic contributes a null to the set: it is not a topic
      // the test is on, and it cannot be offered as one either.
      topic_id: result.topic_ids.filter((id): id is Types.ObjectId => !!id),
    };
  }

  count(filter: CountFlashcardsDTO): Promise<number> {
    return this.flashcardModel
      .countDocuments(this.buildObjectIdQuery(filter))
      .exec();
  }

  delete(id: string): Promise<void> {
    return deleteByIdOrThrow(this.flashcardModel, id, ENTITY);
  }

  update(id: string, updateObj: ModifyFlashcardDto): Promise<void> {
    return updateByIdOrThrow(this.flashcardModel, id, updateObj, ENTITY);
  }

  // The aggregation pipeline does not cast strings to ObjectId the way find()
  // does, so subject_id/topic_id have to be converted explicitly here.
  private buildObjectIdQuery(
    filter: CountFlashcardsDTO,
  ): FilterQuery<Flashcard> {
    const query: FilterQuery<Flashcard> = {};
    if (filter.subject_id) {
      query.subject_id = new Types.ObjectId(filter.subject_id);
    }
    if (filter.topic_id) {
      query.topic_id = new Types.ObjectId(filter.topic_id);
    }
    return query;
  }
}
