import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FlattenMaps, Model } from 'mongoose';
import { FileDocument, FileMongo } from './file.schema';
import { ReadStream } from 'fs';
import { Binary } from 'mongodb';

@Injectable()
export class FileService {
  constructor(
    @InjectModel(FileMongo.name) private fileModel: Model<FileMongo>,
  ) {}
  create(file: Express.Multer.File[]): Promise<FileDocument> {
    console.dir(file); // prima di dare errore
    return new this.fileModel({
      content: file[0].buffer,
      mimetype: file[0].mimetype,
    }).save();
  }

  // aggiungere una res per fare il download del file
  async findOne(id: string) {
    return this.fileModel.findById(id).lean().exec();
  }

  convertBuffer(b) {
    return Buffer.isBuffer(b)
      ? b
      : b instanceof Binary
        ? b.buffer // estrai il buffer dal Binary
        : Buffer.from(b);
  }
}
