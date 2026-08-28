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
import { BasePaginatedResult, ListFilterRequest } from 'src/common.dto';
import {
  CountFlashcardsDTO,
  ModifyFlashcardDto,
  RandomFlashcardsDTO,
} from './flashcards.dto';
import { FlashcardDocument } from './flashcards.schema';

@Controller('flashcards')
export class FlashcardsController {
  constructor(private readonly flashcardsService: FlashcardsService) {}

  @ApiOperation({ description: 'create a new Flashcard obj and push it on db' })
  @Post()
  create(@Body() createFlashcardDto: ModifyFlashcardDto): Promise<void> {
    return this.flashcardsService.create(createFlashcardDto);
  }

  @ApiOperation({ description: 'get all Flashcard from db with filters' })
  @Get('all')
  findAll(
    @Query() filters: ListFilterRequest,
  ): Promise<BasePaginatedResult<FlashcardDocument>> {
    return this.flashcardsService.findAll(filters);
  }

  @ApiOperation({
    description: 'get random flashcards from db to create a new test',
  })
  @Get('random')
  getRandom(@Query() filters: RandomFlashcardsDTO): Promise<{ _id: string }[]> {
    return this.flashcardsService.getRandom(filters);
  }

  @ApiOperation({
    description: 'count flashcards matching the given filters',
  })
  @Get('count')
  count(@Query() filters: CountFlashcardsDTO): Promise<number> {
    return this.flashcardsService.count(filters);
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
