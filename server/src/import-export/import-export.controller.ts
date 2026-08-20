import {
  Controller,
  Get,
  Post,
  Res,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiQuery, ApiOperation } from '@nestjs/swagger';
import { ImportExportService } from './import-export.service';
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
  ): Promise<{ imported: number; skipped: number }> {
    return this.importService.importFlashcardsFromFile(file);
  }

  @ApiOperation({
    description:
      'exports flashcards (and the icons of their subjects) as a zip archive',
  })
  @Get('export-flashcards')
  @ApiQuery({
    name: 'subject_id',
    required: false,
    type: String,
    description: 'L\'ID della materia per filtrare i risultati (opzionale)',
  })
  async exportFlashcards(@Res() res: Response, @Query('subject_id') subject_id?: string): Promise<void> {
    const zipBuffer = await this.importService.exportFlashcardsAsZip(subject_id);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="flashcards_export.zip"',
    );
    res.send(zipBuffer);
  }
}
