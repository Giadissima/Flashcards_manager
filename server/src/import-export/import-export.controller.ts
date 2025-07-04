import {
  Controller,
  Get,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { ImportExportService } from './import-export.service';
import { Writable } from 'stream';
import { Response } from 'express';

@Controller('import-export')
export class ImportExportController {
  constructor(private readonly importService: ImportExportService) {}

  @ApiOperation({
    description: 'it allows to upload a file contains flashcards on db',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @Post('upload-flashcards')
  @UseInterceptors(FileInterceptor('file'))
  uploadFlashcardsJson(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<void> {
    return this.importService.importFlashcardsFromFile(file);
  }

  @ApiOperation({
    description: 'it allows to upload a file contains groups on db',
  })
  @Get('export-flashcards')
  @ApiOperation({
    description: 'it allows to upload a file contains groups on db',
  })
  async exportFlashcards(@Res() res: Response): Promise<void> {
    const stream = await this.importService.exportFlashcardsToFileStream();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="flashcards.json"',
    );
    stream.pipe(res as unknown as Writable);
  }
}
