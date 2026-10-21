import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { FileService } from './file.service';
import { Readable } from 'stream';
import { Response } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Public } from 'src/auth/public.decorator';
import { CurrentUser } from 'src/auth/current-user.decorator';
import { JwtPayload } from 'src/auth/auth.dto';

// Comfortably more than a flashcard's two fields (question/answer) could ever
// hold between them in one draft; just a backstop against an abusive request.
const maxFilesPerUpload = 20;

@Controller('file')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @ApiOperation({
    description:
      'upload one or more image files and get back their ids, in the same order (used to resolve the inline images a flashcard/subject draft is still only holding in the browser, once it is actually saved)',
  })
  @Post()
  @UseInterceptors(
    FilesInterceptor('files', maxFilesPerUpload, {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Image files to upload',
        },
      },
      required: ['files'],
    },
  })
  async upload(
    @CurrentUser() user: JwtPayload,
    @UploadedFiles() files?: Express.Multer.File[],
  ): Promise<{ ids: string[] }> {
    if (!files?.length) {
      throw new BadRequestException('Nessun file caricato');
    }
    if (files.some((file) => !file.mimetype.startsWith('image/'))) {
      throw new BadRequestException("Il file deve essere un'immagine");
    }

    const docs = await this.fileService.createMany(files, user.sub);
    return { ids: docs.map((doc) => String(doc._id)) };
  }

  @ApiOperation({ description: 'get a specific file from db' })
  // The browser loads these URLs on its own, straight out of <img src>, where
  // no Authorization header can be attached. Left open on purpose: the id is an
  // opaque ObjectId and nothing but the image bytes is behind it.
  @Public()
  @Get(':id') // TODO document the NotFoundException response in Swagger
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
      // Every edit creates a new file with a new id (see SubjectService.update),
      // so the content behind this id will never change: cache it forever
      'Cache-Control': 'public, max-age=31536000, immutable',
    });

    stream.pipe(res);
  }
}
