import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Topic, TopicDocument } from './topic.schema';
import { ModifyTopicDto } from './topic.dto';
import { Model, SortOrder } from 'mongoose';
import {
  BasePaginatedResult,
  FilterRequest,
  validateObjectIdParam,
} from 'src/common.dto';

@Injectable()
export class TopicService {
  constructor(@InjectModel(Topic.name) private topicModel: Model<Topic>) {}

  async create(createTopicDto: ModifyTopicDto): Promise<void> {
    await new this.topicModel({ ...createTopicDto }).save();
  }

  findOne(id: string): Promise<TopicDocument | null> {
    return this.topicModel.findById(id).populate('subject_id').exec();
  }

  async findAll(
    filter: FilterRequest,
  ): Promise<BasePaginatedResult<TopicDocument>> {
    const query: any = {};
    if (filter.subject_id) {
      query.subject_id = filter.subject_id;
    }

    const [data, count] = await Promise.all([
      this.topicModel
        .find(query)
        .sort([
          [filter.sortField, filter.sortDirection as SortOrder],
          ['_id', 'desc'],
        ])
        .skip(filter.skip)
        .limit(filter.limit)
        .populate('subject_id')
        .exec(),
      this.topicModel.find(query).countDocuments(),
    ]);
    return { data, count };
  }

  async delete(
    id: string,
  ): Promise<void | BadRequestException | NotFoundException> {
    if (!validateObjectIdParam(id))
      throw new BadRequestException('The id does not satisfy requirements');

    const result = await this.topicModel.deleteOne({ _id: id });
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Topic with id ${id} not found`);
    }
  }

  async update(
    id: string,
    updateObj: ModifyTopicDto,
  ): Promise<void | NotFoundException> {
    if (!validateObjectIdParam(id))
      throw new BadRequestException('The id does not satisfy requirements');

    const result = await this.topicModel
      .findByIdAndUpdate({ _id: id }, updateObj, { new: true })
      .exec();

    if (!result) {
      throw new NotFoundException('Topic with id ${id} not found');
    }
  }
}