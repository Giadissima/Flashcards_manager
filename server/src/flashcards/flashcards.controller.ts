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
} from '@nestjs/common';

import { FlashcardsService } from './flashcards.service';
import { ApiOperation } from '@nestjs/swagger';
import { FilterRequest, BasePaginatedResult } from 'src/common.dto';
import { CreateFlashcardDto, UpdateFlashcardDto } from './flashcards.dto';
import { FlashcardDocument } from './flashcards.schema';

@Controller('flashcards')
export class FlashcardsController {
  constructor(private readonly flashcardsService: FlashcardsService) {}

  @ApiOperation({ description: 'create a new Flashcard obj and push it on db' })
  @Post()
  create(@Body() createFlashcardDto: CreateFlashcardDto): Promise<void> {
    return this.flashcardsService.create(createFlashcardDto);
  }

  @ApiOperation({ description: 'get all Flashcard from db with filters' })
  @Get('all')
  findAll(
    @Query() filters: FilterRequest,
  ): Promise<BasePaginatedResult<FlashcardDocument>> {
    return this.flashcardsService.findAll(filters);
  }

  @ApiOperation({ description: 'get a specific Flashcard from db' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.flashcardsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateFlashcardDto: UpdateFlashcardDto,
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
