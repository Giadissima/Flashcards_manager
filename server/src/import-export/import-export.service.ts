import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Flashcard } from 'src/flashcards/flashcards.schema';
import { Group } from 'src/group/group.schema';

@Injectable()
export class ImportExportService {
  constructor(
    @InjectModel('Flashcard') private readonly flashcardModel: Model<Flashcard>,
    @InjectModel('Group') private readonly groupModel: Model<Group>,
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

    // TODO una volta finita l'export creare le interfacce per item
    for (const item of data) {
      await this.groupModel.create({
        _id: item._id?.$oid ? item._id.$oid.trim() : undefined,
        name: item.name?.trim(),
        color: item.color?.trim(),
        subject_id: item.subject_id?.$oid
          ? item.subject_id.$oid.trim()
          : undefined,
      });
    }
  }

  async exportFlashcards() {
    return await this.flashcardModel
      .find()
      .populate({
        path: 'group_id',
        populate: {
          path: 'subject_id',
        },
      })
      .populate('subject_id') // TODO una volta fatto devo streammare in chunk il file al client
      .exec(); // TODO vedere se è possibile rimuovere alcuni campi per tenere più pulito il file
  }
  // TODO nell'export io non devo esportare l'id del gruppo ma i suoi attributi
  // TODO ci sarà solo un import singolo delle flashcards
}
