import {
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { ImportExportService } from './import-export.service';

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
  @Post('upload-groups')
  @UseInterceptors(FileInterceptor('file'))
  uploadGroupJson(@UploadedFile() file: Express.Multer.File): Promise<void> {
    return this.importService.importGroupsFromFile(file);
  }

  @Get('export-flashcards')
  @ApiOperation({
    description: 'it allows to upload a file contains groups on db',
  })
  exportFlashcards(): Promise<any> {
    return this.importService.exportFlashcards();
  }
}
