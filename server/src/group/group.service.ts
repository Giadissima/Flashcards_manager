import { Injectable } from '@nestjs/common';
import { CreateGroupDto } from './group.dto';
import { Group } from './group.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class GroupService {
  constructor(@InjectModel(Group.name) private groupModel: Model<Group>) {}

  async create(createGroupDto: CreateGroupDto) {
    await new this.groupModel({ ...createGroupDto }).save();
    return 'Success';
  }

  // findAll() {
  //   return `This action returns all group`;
  // }

  // findOne(id: number) {
  //   return `This action returns a #${id} group`;
  // }

  // update(id: number, updateGroupDto: UpdateGroupDto) {
  //   return `This action updates a #${id} group`;
  // }

  // remove(id: number) {
  //   return `This action removes a #${id} group`;
  // }
}
