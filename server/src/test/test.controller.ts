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
import { TestService } from './test.service';
import { ApiNotFoundResponse, ApiOperation } from '@nestjs/swagger';
import { BasePaginatedResult } from 'src/common.dto';
import { TestDocument } from './test.schema';
import { TestCreateRequest } from './test.dto';
import { FlashcardFilterDTO } from 'src/flashcards/flashcards.dto';

@Controller('test')
export class TestController {
  constructor(private readonly testService: TestService) {}

  @ApiOperation({ description: 'create a new plain Test' })
  @Post()
  @ApiNotFoundResponse({
    type: NotFoundException,
    description: 'Error creating test',
  })
  create(@Body() test: TestCreateRequest): Promise<TestDocument> {
    return this.testService.create(test);
  }

  @ApiOperation({ description: 'get all test from db with filters' })
  @Get('all')
  findAll(
    @Query() filters: FlashcardFilterDTO,
  ): Promise<BasePaginatedResult<TestDocument>> {
    return this.testService.findAll(filters);
  }

  @ApiOperation({
    description:
      'get a specific test from db (resume or check a finished test)',
  })
  @Get(':id')
  findOne(@Param('id') id: string): Promise<TestDocument> {
    return this.testService.findOne(id);
  }

  @Patch(':test_id/answer/:question_id')
  updateAnswer(
    @Param('test_id') test_id: string,
    @Param('question_id') question_id: string,
    @Query('is_correct') is_correct: string,
  ) {
    return this.testService.updateAnswer(
      test_id,
      question_id,
      is_correct === 'true' ? true : false,
    );
  }

  @Get(':test_id/question/:question_index')
  getQuestion(
    @Param('test_id') test_id: string,
    @Param('question_index') question_index: number,
  ) {
    return this.testService.getQuestion(test_id, question_index);
  }

  @Patch(':id/time')
  updateelapsed_time(@Param('id') id: string, @Query('time') time: number) {
    return this.testService.updateelapsed_time(id, time);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() test: TestDocument) {
    return this.testService.update(id, test);
  }

  @ApiOperation({ description: 'Delete one Flashcard from db' })
  @Delete(':id')
  delete(
    @Param('id') id: string,
  ): Promise<void | BadRequestException | NotFoundException> {
    return this.testService.delete(id);
  }
}
