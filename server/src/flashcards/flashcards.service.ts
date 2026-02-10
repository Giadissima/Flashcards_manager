import {
  FlashcardFilterDTO,
  ModifyFlashcardDto,
  RandomFlashcardsDTO,
} from './flashcards.dto';
import { InjectModel } from '@nestjs/mongoose';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Flashcard, FlashcardDocument } from './flashcards.schema';
import { Model, SortOrder, Types } from 'mongoose';
import { BasePaginatedResult, validateObjectIdParam } from 'src/common.dto';
import { FileService } from 'src/file/file.service';

@Injectable()
export class FlashcardsService {
  constructor(
    @InjectModel(Flashcard.name)
    private flashcardModel: Model<Flashcard>,
    private readonly fileService: FileService,
  ) {}

  async create(
    createFlashcardDto: ModifyFlashcardDto,
    files: {
      question_img?: Express.Multer.File[];
      answer_img?: Express.Multer.File[];
    },
  ): Promise<void> {
    const question_img = files?.question_img;
    const answer_img = files?.answer_img;

    const question_img_id = question_img
      ? (await this.fileService.create(question_img))._id
      : undefined;
    const answer_img_id = answer_img
      ? (await this.fileService.create(answer_img))._id
      : undefined;

    await new this.flashcardModel({
      ...createFlashcardDto,
      question_img_id,
      answer_img_id,
    }).save();
  }

  findOne(id: string): Promise<FlashcardDocument | null> {
    return this.flashcardModel
      .findById(id)
      .populate(['topic_id', 'subject_id'])
      .exec();
  }

  async findAll(
    filter: FlashcardFilterDTO,
  ): Promise<BasePaginatedResult<FlashcardDocument>> {
    const query: any = {};
    if (filter.subject_id) {
      query.subject_id = filter.subject_id;
    }
    if (filter.topic_id) {
      query.topic_id = filter.topic_id;
    }
    if (filter.title) {
      query.title = { $regex: filter.title, $options: 'i' };
    }

    const [data, count] = await Promise.all([
      this.flashcardModel
        .find(query)
        .sort([
          [filter.sortField, filter.sortDirection as SortOrder],
          ['_id', 'desc'],
        ])
        .skip(filter.skip)
        .limit(filter.limit)
        .populate(['topic_id', 'subject_id'])
        .exec(),
      this.flashcardModel.find(query).countDocuments(),
    ]);
    return { data, count };
  }

  getRandom(filter: RandomFlashcardsDTO): Promise<{ _id: string }[]> {
    const query: any = {};
    if (filter.subject_id) {
      query.subject_id = new Types.ObjectId(filter.subject_id);
    }

    if (filter.topic_id) {
      query.topic_id = new Types.ObjectId(filter.topic_id);
    }

    const sampleSize = filter.numFlashcard || 10; // Default to 10 if numFlashcard is not provided or is falsy

    return this.flashcardModel
      .aggregate<{ _id: string }>([
        { $match: query },
        { $sample: { size: sampleSize } },
        {
          $project: {
            _id: { $toString: '$_id' },
          },
        },
      ])
      .exec();
  }

  async delete(
    id: string,
  ): Promise<void | BadRequestException | NotFoundException> {
    if (!validateObjectIdParam(id))
      throw new BadRequestException('The id does not satisfy requirements');

    const result = await this.flashcardModel.deleteOne({ _id: id });
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Flashcard with id ${id} not found`);
    }
  }

  async update(
    id: string,
    updateObj: ModifyFlashcardDto,
  ): Promise<void | NotFoundException> {
    if (!validateObjectIdParam(id))
      throw new BadRequestException('The id does not satisfy requirements');

    const result = await this.flashcardModel
      .findByIdAndUpdate({ _id: id }, updateObj, { new: true })
      .exec();

    if (!result) {
      throw new NotFoundException('Flashcard with id ${id} not found');
    }
  }
}
