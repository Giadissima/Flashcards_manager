import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Subject } from './subject.schema';
import { CreateSubjectDto } from './subject.dto';
import { Model } from 'mongoose';

@Injectable()
export class SubjectService {
  constructor(
    @InjectModel(Subject.name) private subjectModel: Model<Subject>,
  ) {}

  async create(createSubjectDto: CreateSubjectDto) {
    await new this.subjectModel({ ...createSubjectDto }).save();
    return 'Success';
  }

  // findAll() {
  //   return `This action returns all subject`;
  // }

  // findOne(id: number) {
  //   return `This action returns a #${id} subject`;
  // }

  // update(id: number, updateSubjectDto: UpdateSubjectDto) {
  //   return `This action updates a #${id} subject`;
  // }

  // remove(id: number) {
  //   return `This action removes a #${id} subject`;
  // }
}
