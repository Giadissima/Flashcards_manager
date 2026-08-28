import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FileDocument, FileMongo } from './file.schema';
import { Binary } from 'mongodb';

@Injectable()
export class FileService {
  constructor(
    @InjectModel(FileMongo.name) private fileModel: Model<FileMongo>,
  ) {}
  // Takes a reduced shape, not the whole Express.Multer.File, because only these
  // two fields are used: this way it can also be called for files rebuilt from a
  // zip during an import, not just from a real multipart upload
  create(file: { buffer: Buffer; mimetype: string }[]): Promise<FileDocument> {
    return new this.fileModel({
      content: file[0].buffer,
      mimetype: file[0].mimetype,
    }).save();
  }

  // TODO take a res parameter to serve the file as a download
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
        ? b.buffer // unwrap the Binary
        : Buffer.from(b);
  }
}
