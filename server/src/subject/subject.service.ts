import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UploadedFile,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Subject, SubjectDocument } from './subject.schema';
import { ModifySubjectDto } from './subject.dto';
import { Model, SortOrder } from 'mongoose';
import {
  BasePaginatedResult,
  validateObjectIdParam,
} from 'src/common.dto';
import { FileService } from 'src/file/file.service';
import { FlashcardFilterDTO } from 'src/flashcards/flashcards.dto';

@Injectable()
export class SubjectService {
  constructor(
    @InjectModel(Subject.name) private subjectModel: Model<Subject>,
    private readonly fileService: FileService,
  ) {}

  async create(
    createSubjectDto: ModifySubjectDto,
    @UploadedFile() icon?: Express.Multer.File,
  ): Promise<void> {
    const icon_id = icon
      ? (await this.fileService.create([icon]))._id
      : undefined;
    await new this.subjectModel({ ...createSubjectDto, icon: icon_id }).save();
  }

  findOne(id: string): Promise<SubjectDocument | null> {
    return this.subjectModel.findById(id).exec();
  }

  async findAll(
    filter: FlashcardFilterDTO,
  ): Promise<BasePaginatedResult<SubjectDocument>> {
    const query: any = {};
    if (filter.title) {
      query.name = { $regex: filter.title, $options: 'i' };
    }

    const [data, count] = await Promise.all([
      this.subjectModel
        .find(query)
        .sort([
          [filter.sortField, filter.sortDirection as SortOrder],
          ['_id', 'desc'],
        ])
        .skip(filter.skip)
        .limit(filter.limit)
        .exec(),
      this.subjectModel.find(query).countDocuments(),
    ]);
    return { data, count };
  }

  async delete(
    id: string,
  ): Promise<void | BadRequestException | NotFoundException> {
    if (!validateObjectIdParam(id))
      throw new BadRequestException('The id does not satisfy requirements');

    const result = await this.subjectModel.deleteOne({ _id: id });
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Subject with id ${id} not found`);
    }
  }

  async update(
    id: string,
    updateObj: ModifySubjectDto,
    icon?: Express.Multer.File,
  ): Promise<void | NotFoundException> {
    if (!validateObjectIdParam(id))
      throw new BadRequestException('The id does not satisfy requirements');

    const existing = await this.subjectModel.findById(id).exec();
    if (!existing) {
      throw new NotFoundException(`Subject with id ${id} not found`);
    }

    const newIconId = icon ? (await this.fileService.create([icon]))._id : undefined;
    const previousIconId = existing.icon;

    const result = await this.subjectModel
      .findByIdAndUpdate(
        { _id: id },
        { ...updateObj, ...(newIconId ? { icon: newIconId } : {}) },
        { new: true },
      )
      .exec();

    if (!result) {
      throw new NotFoundException(`Subject with id ${id} not found`);
    }

    // cancella la vecchia icona solo dopo che l'update è andato a buon fine
    if (newIconId && previousIconId) {
      await this.fileService.delete(previousIconId.toString());
    }
  }
}
