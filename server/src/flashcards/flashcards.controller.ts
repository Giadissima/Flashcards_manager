import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';

import { FlashcardsService } from './flashcards.service';
import { ApiBody, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { FlashcardFilterRequest, BasePaginatedResult } from 'src/common.dto';
import { ModifyFlashcardDto, RandomFlashcardsDTO } from './flashcards.dto';
import { FlashcardDocument } from './flashcards.schema';
import { FileFieldsInterceptor } from '@nestjs/platform-express';

@Controller('flashcards')
export class FlashcardsController {
  constructor(private readonly flashcardsService: FlashcardsService) {}

  @ApiOperation({ description: 'create a new Flashcard obj and push it on db' })
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'question_img', maxCount: 1 },
      { name: 'answer_img', maxCount: 1 },
    ]),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', example: 'Esercizio addizioni' },
        question: { type: 'string', example: 'Quanto fa 2+2?' },
        answer: { type: 'string', example: '2+2=4' },
        topic_id: { type: 'string', example: null },
        subject_id: { type: 'string', example: null },
        question_img: {
          type: 'string',
          format: 'binary',
          description: 'Image file for the question',
        },
        answer_img: {
          type: 'string',
          format: 'binary',
          description: 'Image file for the answer',
        },
      },
      required: ['title', 'question', 'answer'],
    },
  })
  create(
    @Body() createFlashcardDto: ModifyFlashcardDto,
    @UploadedFiles()
    files: {
      question_img?: Express.Multer.File[];
      answer_img?: Express.Multer.File[];
    },
  ): Promise<void> {
    return this.flashcardsService.create(createFlashcardDto, files);
  }

  @ApiOperation({ description: 'get all Flashcard from db with filters' })
  @Get('all')
  findAll(
    @Query() filters: FlashcardFilterRequest,
  ): Promise<BasePaginatedResult<FlashcardDocument>> {
    return this.flashcardsService.findAll(filters);
  }

  @ApiOperation({
    description: 'get random flashcards from db to create a new test',
  })
  @Get('random')
  getRandom(
    @Query() filters: RandomFlashcardsDTO,
  ): Promise<FlashcardDocument[]> {
    return this.flashcardsService.getRandom(filters);
  }

  @ApiOperation({ description: 'get a specific Flashcard from db' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.flashcardsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateFlashcardDto: ModifyFlashcardDto,
  ) {
    return this.flashcardsService.update(id, updateFlashcardDto);
  }

  @ApiOperation({ description: 'Delete one Flashcard from db' })
  @Delete(':id')
  delete(
    @Param('id') id: string,
  ): Promise<void | BadRequestException | NotFoundException> {
    return this.flashcardsService.delete(id);
  }
}
