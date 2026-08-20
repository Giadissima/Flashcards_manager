import { FileMongo, FileSchema } from './file.schema';

import { FileService } from './file.service';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FileController } from './file.controller';

@Module({
  providers: [FileService],
  exports: [FileService],
  imports: [
    MongooseModule.forFeature([{ name: FileMongo.name, schema: FileSchema }]),
  ],
  controllers: [FileController],
})
export class FileModule {}
