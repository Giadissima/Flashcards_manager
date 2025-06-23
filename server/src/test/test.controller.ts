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
import { ApiOperation } from '@nestjs/swagger';
import { BasePaginatedResult, FilterRequest } from 'src/common.dto';
import { TestDocument } from './test.schema';

@Controller('test')
export class TestController {
  constructor(private readonly testService: TestService) {}

  @ApiOperation({ description: 'create a new Test' })
  @Post()
  // TODO aggiungere su swagger che può ritornare anche notfoundexception
  create(): Promise<TestDocument> {
    // TODO come input i filtri del nuovo test
    return this.testService.create();
  }

  @ApiOperation({
    description:
      'get a specific test from db (resume or check a finished test)',
  })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.testService.findOne(id);
  }

  @ApiOperation({ description: 'get all test from db with filters' })
  @Get('all')
  findAll(
    @Query() filters: FilterRequest,
  ): Promise<BasePaginatedResult<TestDocument>> {
    return this.testService.findAll(filters);
  }

  @Patch(':id')
  updateAnswer(
    @Param('id') id: string,
    @Query('is_correct') is_correct: boolean,
  ) {
    return this.testService.updateAnswer(id, is_correct);
  }

  @Patch(':id')
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
