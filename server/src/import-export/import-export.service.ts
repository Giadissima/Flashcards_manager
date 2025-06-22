import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class ImportExportService {
  constructor(
    @InjectModel('Flashcard') private readonly flashcardModel: Model<any>,
    @InjectModel('Group') private readonly groupModel: Model<any>,
  ) {}

  async importFlashcardsFromFile(file: Express.Multer.File): Promise<void> {
    const buffer = file.buffer;
    const rawContent: string = buffer.toString('utf-8');

    let data: any[];

    try {
      data = JSON.parse(rawContent);
    } catch {
      throw new Error('Invalid JSON');
    }

    for (const item of data) {
      await this.flashcardModel.create({
        title: item.title?.trim(),
        question: item.question?.trim(),
        answer: item.answer?.trim(),
        group_id: item.group_id?.$oid,
      });
    }
  }

  async importGroupsFromFile(file: Express.Multer.File): Promise<void> {
    const buffer = file.buffer;
    const rawContent: string = buffer.toString('utf-8');

    let data: any[];

    try {
      data = JSON.parse(rawContent);
    } catch {
      throw new Error('Invalid JSON');
    }

    for (const item of data) {
      await this.groupModel.create({
        name: item.name?.trim(),
        color: item.color?.trim(),
        subject_id: item.subject_id?.$oid,
      });
    }
  }
}
