import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Group, GroupDocument } from './group.schema';
import { CreateGroupDto, UpdateGroupDto } from './group.dto';
import { Model, SortOrder } from 'mongoose';
import {
  BasePaginatedResult,
  FilterRequest,
  validateObjectIdParam,
} from 'src/common.dto';

@Injectable()
export class GroupService {
  constructor(@InjectModel(Group.name) private groupModel: Model<Group>) {}

  async create(createGroupDto: CreateGroupDto): Promise<string> {
    await new this.groupModel({ ...createGroupDto }).save();
    return 'Success';
  }

  findOne(id: string): Promise<GroupDocument | null> {
    return this.groupModel.findById(id).populate('subject_id').exec();
  }

  async findAll(
    filter: FilterRequest,
  ): Promise<BasePaginatedResult<GroupDocument>> {
    const [result, count] = await Promise.all([
      this.groupModel
        .find()
        .sort([
          [filter.sortField, filter.sortDirection as SortOrder],
          ['_id', 'desc'],
        ])
        .skip(filter.skip)
        .limit(filter.limit)
        .populate('subject_id')
        .exec(),
      this.groupModel.find().countDocuments(),
    ]);
    return { result, count };
  }

  async delete(
    id: string,
  ): Promise<void | BadRequestException | NotFoundException> {
    if (!validateObjectIdParam(id))
      throw new BadRequestException('The id does not satisfy requirements');

    const result = await this.groupModel.deleteOne({ _id: id });
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Group with id ${id} not found`);
    }
  }

  async update(
    id: string,
    updateObj: UpdateGroupDto,
  ): Promise<void | NotFoundException> {
    if (!validateObjectIdParam(id))
      throw new BadRequestException('The id does not satisfy requirements');

    const result = await this.groupModel
      .findByIdAndUpdate({ _id: id }, updateObj, { new: true })
      .exec();

    if (!result) {
      throw new NotFoundException('Group with id ${id} not found');
    }
  }
}
