import {
  CountFlashcardsDTO,
  FlashcardFilterDTO,
  ModifyFlashcardDto,
  RandomFlashcardsDTO,
} from './flashcards.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Injectable } from '@nestjs/common';
import { Flashcard, FlashcardDocument } from './flashcards.schema';
import { FilterQuery, Model, Types } from 'mongoose';
import { BasePaginatedResult } from 'src/common.dto';
import {
  deleteByIdOrThrow,
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

  findOne(id: string): Promise<FlashcardDocument | null> {
    return this.flashcardModel.findById(id).populate(POPULATE).exec();
  }

  findAll(
    filter: FlashcardFilterDTO,
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
