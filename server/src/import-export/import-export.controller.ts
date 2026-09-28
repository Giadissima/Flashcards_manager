import { CurrentUser } from 'src/auth/current-user.decorator';
import { JwtPayload } from 'src/auth/auth.dto';
import {
  Body,
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
import { ImportPreview } from './file.dto';

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
        resolutions: {
          type: 'string',
          description:
            'JSON with what to do with the subjects/topics whose name is already taken: { subjects: { [name]: { action, name? } }, topics: { [subject]: { [name]: { action, name? } } } }, action being merge, rename or skip',
        },
      },
    },
  })
  @Post('upload-flashcards')
  @UseInterceptors(FileInterceptor('file'))
  uploadFlashcardsJson(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body('resolutions') resolutions?: string,
  ): Promise<{ imported: number; skipped: number }> {
    return this.importService.importFlashcardsFromFile(
      user.sub,
      file,
      resolutions,
    );
  }

  @ApiOperation({
    description:
      'tells which subjects and topics of a file are already in the account, without importing anything',
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
  @Post('preview-flashcards')
  @UseInterceptors(FileInterceptor('file'))
  previewFlashcardsImport(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ImportPreview> {
    return this.importService.previewImport(user.sub, file);
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
  async exportFlashcards(
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
    @Query('subject_id') subject_id?: string,
  ): Promise<void> {
    const zipBuffer = await this.importService.exportFlashcardsAsZip(
      user.sub,
      subject_id,
    );
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="flashcards_export.zip"',
    );
    res.send(zipBuffer);
  }
}
