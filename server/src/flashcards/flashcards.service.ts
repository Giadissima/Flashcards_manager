import { CreateFlashcardDto, UpdateFlashcardDto } from './flashcards.dto';
import { InjectModel } from '@nestjs/mongoose';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Flashcard, FlashcardDocument } from './flashcards.schema';
import { Model, SortOrder } from 'mongoose';
import {
  BasePaginatedResult,
  FilterRequest,
  validateObjectIdParam,
} from 'src/common.dto';

@Injectable()
export class FlashcardsService {
  constructor(
    @InjectModel(Flashcard.name) private flashcardModel: Model<Flashcard>,
  ) {}

  async create(createFlashcardDto: CreateFlashcardDto): Promise<void> {
    await new this.flashcardModel({ ...createFlashcardDto }).save();
  }

  findOne(id: string): Promise<FlashcardDocument | null> {
    return this.flashcardModel
      .findById(id)
      .populate(['group_id', 'subject_id'])
      .exec();
  }

  async findAll(
    filter: FilterRequest,
  ): Promise<BasePaginatedResult<FlashcardDocument>> {
    const [result, count] = await Promise.all([
      this.flashcardModel
        .find()
        .sort([
          [filter.sortField, filter.sortDirection as SortOrder],
          ['_id', 'desc'],
        ])
        .skip(filter.skip)
        .limit(filter.limit)
        .populate(['group_id', 'subject_id'])
        .exec(),
      this.flashcardModel.find().countDocuments(),
    ]);
    return { result, count };
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
    updateObj: UpdateFlashcardDto,
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
