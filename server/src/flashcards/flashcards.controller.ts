import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { FlashcardsService } from './flashcards.service';

@Controller('flashcards')
export class FlashcardsController {
  constructor(private readonly flashcardsService: FlashcardsService) {}

  // @Post()
  // create(@Body() createFlashcardDto: CreateFlashcardDto) {
  //   return this.flashcardsService.create(createFlashcardDto);
  // }

  // @Get()
  // findAll() {
  //   return this.flashcardsService.findAll();
  // }

  // @Get(':id')
  // findOne(@Param('id') id: string) {
  //   return this.flashcardsService.findOne(+id);
  // }

  // @Patch(':id')
  // update(
  //   @Param('id') id: string,
  //   @Body() updateFlashcardDto: UpdateFlashcardDto,
  // ) {
  //   return this.flashcardsService.update(+id, updateFlashcardDto);
  // }

  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.flashcardsService.remove(+id);
  // }
}
