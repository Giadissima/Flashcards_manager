import {
  CountFlashcardsDTO,
  ModifyFlashcardDto,
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

  getRandom(filter: RandomFlashcardsDTO): Promise<{ _id: string }[]> {
    return this.flashcardModel
      .aggregate<{ _id: string }>([
        { $match: this.buildObjectIdQuery(filter) },
        { $sample: { size: filter.numFlashcard || defaultRandomSampleSize } },
        { $project: { _id: { $toString: '$_id' } } },
      ])
      .exec();
  }

  /**
   * The subject the given flashcards belong to, and their topic when they all
   * share one. A test is built from a single subject, so the subject is taken
   * from the first card; the topic is only meaningful when the whole set has
   * the same one, since a test set up by subject spans every topic of it.
   *
   * Used when a test is created, to store on it what it is about.
   */
  async getSubjectAndTopic(ids: (string | Types.ObjectId)[]): Promise<{
    subject_id?: Types.ObjectId;
    topic_id?: Types.ObjectId;
  }> {
    if (!ids.length) return {};

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

    if (!result) return {};
    return {
      subject_id: result.subject_id ?? undefined,
      topic_id:
        result.topic_ids.length === 1 ? (result.topic_ids[0] ?? undefined) : undefined,
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
