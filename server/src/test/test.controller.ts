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
import { BasePaginatedResult, FilterRequest } from 'src/common.dto';
import { TestDocument } from './test.schema';
import { TestFiltersRequest } from './test.dto';

@Controller('test')
export class TestController {
  constructor(private readonly testService: TestService) {}

  @ApiOperation({ description: 'create a new Test' })
  @Post()
  @ApiNotFoundResponse({
    type: NotFoundException,
    description: 'Error creating test',
  })
  create(@Body() filters: TestFiltersRequest): Promise<TestDocument> {
    // TODO come input i filtri del nuovo test
    return this.testService.create(filters);
  }

  @ApiOperation({ description: 'get all test from db with filters' })
  @Get('all')
  findAll(
    @Query() filters: FilterRequest,
  ): Promise<BasePaginatedResult<TestDocument>> {
    return this.testService.findAll(filters);
  }

  @ApiOperation({
    description:
      'get a specific test from db (resume or check a finished test)',
  })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.testService.findOne(id);
  }

  @Patch(':test_id/answer/:question_id')
  updateAnswer(
    @Param('test_id') test_id: string,
    @Param('question_id') question_id: string,
    @Query('is_correct') is_correct: boolean,
  ) {
    return this.testService.updateAnswer(test_id, question_id, is_correct);
  }

  @Patch(':id/time')
  updateElapsedTime(@Param('id') id: string, @Query('time') time: number) {
    return this.testService.updateElapsedTime(id, time);
  }

  @ApiOperation({ description: 'Delete one Flashcard from db' })
  @Delete(':id')
  delete(
    @Param('id') id: string,
  ): Promise<void | BadRequestException | NotFoundException> {
    return this.testService.delete(id);
  }
}
