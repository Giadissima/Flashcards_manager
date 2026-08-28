import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { Subject, SubjectDocument } from './subject.schema';
import { ModifySubjectDto } from './subject.dto';
import { BasePaginatedResult, ListFilterRequest } from 'src/common.dto';
import {
  assertValidObjectId,
  deleteByIdOrThrow,
  findPaginated,
} from 'src/common/mongo.util';
import { FileService } from 'src/file/file.service';

const ENTITY = 'Subject';

@Injectable()
export class SubjectService {
  constructor(
    @InjectModel(Subject.name) private subjectModel: Model<Subject>,
    private readonly fileService: FileService,
  ) {}

  async create(
    createSubjectDto: ModifySubjectDto,
    icon?: Express.Multer.File,
  ): Promise<void> {
    const icon_id = icon
      ? (await this.fileService.create([icon]))._id
      : undefined;
    await new this.subjectModel({ ...createSubjectDto, icon: icon_id }).save();
  }

  findOne(id: string): Promise<SubjectDocument | null> {
    return this.subjectModel.findById(id).exec();
  }

  findAll(
    filter: ListFilterRequest,
  ): Promise<BasePaginatedResult<SubjectDocument>> {
    const query: FilterQuery<Subject> = {};
    if (filter.title) query.name = { $regex: filter.title, $options: 'i' };

    return findPaginated<SubjectDocument>(this.subjectModel, query, filter);
  }

  delete(id: string): Promise<void> {
    return deleteByIdOrThrow(this.subjectModel, id, ENTITY);
  }

  // Not routed through updateByIdOrThrow: the previous icon has to be read
  // before the update and deleted only once the update succeeded.
  async update(
    id: string,
    updateObj: ModifySubjectDto,
    icon?: Express.Multer.File,
  ): Promise<void> {
    assertValidObjectId(id);

    const existing = await this.subjectModel.findById(id).exec();
    if (!existing) {
      throw new NotFoundException(`${ENTITY} with id ${id} not found`);
    }

    const newIconId = icon
      ? (await this.fileService.create([icon]))._id
      : undefined;
    const previousIconId = existing.icon;

    const result = await this.subjectModel
      .findByIdAndUpdate(
        id,
        { ...updateObj, ...(newIconId ? { icon: newIconId } : {}) },
        { new: true },
      )
      .exec();

    if (!result) {
      throw new NotFoundException(`${ENTITY} with id ${id} not found`);
    }

    // Drop the previous icon only once the update actually succeeded.
    if (newIconId && previousIconId) {
      await this.fileService.delete(previousIconId.toString());
    }
  }
}
