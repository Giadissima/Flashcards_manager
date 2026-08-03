import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { FileService } from './file.service';
import { Readable } from 'stream';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('file')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @ApiOperation({
    description:
      'upload a generic image file and get back its id (used to embed inline images in flashcard question/answer)',
  })
  @Post()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file to upload',
        },
      },
      required: ['file'],
    },
  })
  async upload(
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<{ _id: string }> {
    if (!file) {
      throw new BadRequestException('Nessun file caricato');
    }
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException("Il file deve essere un'immagine");
    }

    const doc = await this.fileService.create([file]);
    return { _id: String(doc._id) };
  }

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
      // ogni edit crea un nuovo file con un nuovo id (vedi SubjectService.update),
      // quindi il contenuto dietro a questo id non cambierà mai: cache permanente
      'Cache-Control': 'public, max-age=31536000, immutable',
    });

    stream.pipe(res);
  }
}
