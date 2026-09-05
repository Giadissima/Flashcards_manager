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

import { CurrentUser } from 'src/auth/current-user.decorator';
import { FlashcardsService } from './flashcards.service';
import { JwtPayload } from 'src/auth/auth.dto';
import { ApiOperation } from '@nestjs/swagger';
import { BasePaginatedResult, ListFilterRequest } from 'src/common.dto';
import {
  CountFlashcardsDTO,
  ModifyFlashcardDto,
  RandomFlashcard,
  RandomFlashcardsDTO,
} from './flashcards.dto';
import { FlashcardDocument } from './flashcards.schema';

@Controller('flashcards')
export class FlashcardsController {
  constructor(private readonly flashcardsService: FlashcardsService) {}

  @ApiOperation({ description: 'create a new Flashcard obj and push it on db' })
  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body() createFlashcardDto: ModifyFlashcardDto,
  ): Promise<void> {
    return this.flashcardsService.create(user.sub, createFlashcardDto);
  }

  @ApiOperation({ description: 'get all Flashcard from db with filters' })
  @Get('all')
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query() filters: ListFilterRequest,
  ): Promise<BasePaginatedResult<FlashcardDocument>> {
    return this.flashcardsService.findAll(user.sub, filters);
  }

  @ApiOperation({
    description: 'get random flashcards from db to create a new test',
  })
  @Get('random')
  getRandom(
    @CurrentUser() user: JwtPayload,
    @Query() filters: RandomFlashcardsDTO,
  ): Promise<RandomFlashcard[]> {
    return this.flashcardsService.getRandom(user.sub, filters);
  }

  @ApiOperation({
    description: 'count flashcards matching the given filters',
  })
  @Get('count')
  count(
    @CurrentUser() user: JwtPayload,
    @Query() filters: CountFlashcardsDTO,
  ): Promise<number> {
    return this.flashcardsService.count(user.sub, filters);
  }

  @ApiOperation({ description: 'get a specific Flashcard from db' })
  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.flashcardsService.findOne(user.sub, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() updateFlashcardDto: ModifyFlashcardDto,
  ) {
    return this.flashcardsService.update(user.sub, id, updateFlashcardDto);
  }

  @ApiOperation({ description: 'Delete one Flashcard from db' })
  @Delete(':id')
  delete(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<void | BadRequestException | NotFoundException> {
    return this.flashcardsService.delete(user.sub, id);
  }

}
