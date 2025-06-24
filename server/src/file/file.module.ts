import { FileMongo, FileSchema } from './file.schema';

import { FileService } from './file.service';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  providers: [FileService],
  exports: [FileService],
  imports: [
    MongooseModule.forFeature([{ name: FileMongo.name, schema: FileSchema }]),
  ],
})
export class FileModule {}
