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
  // accetta un tipo ridotto (non l'intero Express.Multer.File) perché usa solo
  // questi due campi: così può essere chiamato anche per file ricostruiti da
  // uno zip in fase di import, non solo da un vero upload multipart
  create(file: { buffer: Buffer; mimetype: string }[]): Promise<FileDocument> {
    return new this.fileModel({
      content: file[0].buffer,
      mimetype: file[0].mimetype,
    }).save();
  }

  // aggiungere una res per fare il download del file
  async findOne(id: string) {
    return this.fileModel.findById(id).lean().exec();
  }

  async delete(id: string): Promise<void> {
    await this.fileModel.findByIdAndDelete(id).exec();
  }

  convertBuffer(b) {
    return Buffer.isBuffer(b)
      ? b
      : b instanceof Binary
        ? b.buffer // estrai il buffer dal Binary
        : Buffer.from(b);
  }
}
