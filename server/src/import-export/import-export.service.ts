import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Response } from 'express';
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  ReadStream,
} from 'fs';
import { Model } from 'mongoose';
import { dirname, join } from 'path';
import { Flashcard } from 'src/flashcards/flashcards.schema';
import { Topic, TopicDocument } from 'src/topic/topic.schema';
import {
  FlashcardFileFormat,
  TopicFileFormat,
  SubjectFileFormat,
} from './file.dto';
import { Subject, SubjectDocument } from 'src/subject/subject.schema';

@Injectable()
export class ImportExportService {
  constructor(
    @InjectModel('Flashcard') private readonly flashcardModel: Model<Flashcard>,
    @InjectModel('Subject') private readonly subjectModel: Model<Subject>,
    @InjectModel('Topic') private readonly topicModel: Model<Topic>,
  ) {}

  async importFlashcardsFromFile(file: Express.Multer.File): Promise<void> {
    const buffer = file.buffer;
    const rawContent: string = buffer.toString('utf-8');

    let data: FlashcardFileFormat[];

    try {
      data = JSON.parse(rawContent);
    } catch {
      throw new Error('Invalid JSON');
    }

    // ? subject creation
    for (const item of data) {
      const subject_obj: SubjectFileFormat | undefined =
        item.subject_id ?? item.topic_id?.subject_id;

      let subject_doc: SubjectDocument | undefined = undefined;
      if (subject_obj)
        subject_doc = await this.subjectModel
          .findOneAndUpdate(
            { name: subject_obj.name },
            {
              $setOnInsert: {
                name: subject_obj.name.trim(),
                desc: subject_obj.desc.trim(),
                icon: subject_obj.icon,
              },
            },
            { upsert: true, new: true },
          )
          .exec();

      // ? topic creation
      const topic_obj: TopicFileFormat | undefined = item.topic_id;

      let topic_doc: TopicDocument | undefined = undefined;
      if (topic_obj && subject_doc) {
        topic_doc = await this.topicModel
          .findOneAndUpdate(
            { name: topic_obj.name, subject_id: subject_doc._id },
            {
              $setOnInsert: {
                name: topic_obj.name.trim(),
                color: topic_obj.color.trim(),
                subject_id: subject_doc._id,
              },
            },
            { upsert: true, new: true },
          )
          .exec();
      }

      // ? flashcard creation
      await this.flashcardModel.create({
        title: item.title?.trim(),
        question: item.question?.trim(),
        answer: item.answer?.trim(),
        topic_id: topic_doc?._id,
        subject_id: subject_doc?._id,
      });
    }
  }

  async exportFlashcardsToFileStream(): Promise<ReadStream> {
    const filePath = join(__dirname, '..', 'tmp', 'flashcards_export.json');
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true }); // crea la cartella tmp e tutte le eventuali sottocartelle mancanti
    }
    const writeStream = createWriteStream(filePath);

    const cursor = this.flashcardModel
      .find()
      .populate({
                  path: 'topic_id',        populate: { path: 'subject_id' },
      })
      .populate('subject_id')
      .lean() // questo comando converte in oggetto puro il risultato e non più in un oggetto di mongoose, permettendo nel caso di export di risparmiare memoria
      .cursor();

    // Apertura array JSON
    writeStream.write('[\n');

    let first = true;
    for await (const doc of cursor) {
      if (!first) {
        writeStream.write(',\n');
      } else {
        first = false;
      }

      writeStream.write(JSON.stringify(doc));
    }

    writeStream.write('\n]');

    writeStream.end();

    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    return createReadStream(filePath);
  }
  // TODO l'export dovrà essere filtrato per gruppi e materie
}
