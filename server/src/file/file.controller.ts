import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { FileService } from './file.service';
import { Readable } from 'stream';
import { Response } from 'express';

@Controller('file')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @ApiOperation({ description: 'get a specific file from db' })
  @Get(':id') // TODO aggiungere la response di swaggere della NotFoundException
  async findOne(@Param('id') id: string, @Res() res: Response) {
    const fileDoc = await this.fileService.findOne(id);
    if (!fileDoc) {
      throw new NotFoundException('File non trovato');
    }

    const content = this.fileService.convertBuffer(fileDoc.content);
    const stream = Readable.from(content); // trasforma Buffer in stream
    res.set({
      'Content-Type': fileDoc.mimetype,
      'Content-Length': content.length,
      'Content-Disposition': `inline; filename="${fileDoc._id}"`,
    });

    stream.pipe(res);
  }
}
