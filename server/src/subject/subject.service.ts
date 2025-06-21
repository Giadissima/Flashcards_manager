import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Subject, SubjectDocument } from './subject.schema';
import { CreateSubjectDto } from './subject.dto';
import { Model, SortOrder } from 'mongoose';
import { BasePaginatedResult, FilterRequest } from 'src/common.dto';

@Injectable()
export class SubjectService {
  constructor(
    @InjectModel(Subject.name) private subjectModel: Model<Subject>,
  ) {}

  async create(createSubjectDto: CreateSubjectDto): Promise<string> {
    await new this.subjectModel({ ...createSubjectDto }).save();
    return 'Success';
  }

  findOne(id: string): Promise<SubjectDocument | null> {
    return this.subjectModel.findOne({ _id: id }).exec();
  }

  async findAll(
    filter: FilterRequest,
  ): Promise<BasePaginatedResult<SubjectDocument>> {
    const [result, count] = await Promise.all([
      this.subjectModel
        .find()
        .sort([
          [filter.sortField, filter.sortDirection as SortOrder],
          ['_id', 'desc'],
        ])
        .skip(filter.skip)
        .limit(filter.limit)
        .exec(),
      this.subjectModel.find().countDocuments(),
    ]);
    return { result, count };
  }

  // async deleteEmail(id: string): Promise<void> {
  //   // eslint-disable-next-line @typescript-eslint/naming-convention
  //   await this.subjectModel.deleteOne({ _id: id }).exec();
  // }
}
