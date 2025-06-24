import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FileDocument, FileMongo } from './file.schema';

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

  findOne(id: string): Promise<FileDocument | null> {
    return this.fileModel.findById(id).exec();
  }
}
