import { CurrentUser } from 'src/auth/current-user.decorator';
import { JwtPayload } from 'src/auth/auth.dto';
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
import {
  TestCreateRequest,
  TestFilterDto,
  TestStats,
  TestStatsFilterDto,
} from './test.dto';

@Controller('test')
export class TestController {
  constructor(private readonly testService: TestService) {}

  @ApiOperation({ description: 'create a new plain Test' })
  @Post()
  @ApiNotFoundResponse({
    type: NotFoundException,
    description: 'Error creating test',
  })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() test: TestCreateRequest,
  ): Promise<TestDocument> {
    return this.testService.create(user.sub, test);
  }

  @ApiOperation({ description: 'get all test from db with filters' })
  @Get('all')
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query() filters: TestFilterDto,
  ): Promise<BasePaginatedResult<TestDocument>> {
    return this.testService.findAll(user.sub, filters);
  }

  @ApiOperation({ description: 'get aggregate stats across all tests' })
  @Get('stats')
  getStats(
    @CurrentUser() user: JwtPayload,
    @Query() filter: TestStatsFilterDto,
  ): Promise<TestStats> {
    return this.testService.getStats(user.sub, filter);
  }

  @ApiOperation({
    description:
      'get a specific test from db (resume or check a finished test)',
  })
  @Get(':id')
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<TestDocument> {
    return this.testService.findOne(user.sub, id);
  }

  @Patch(':test_id/answer/:question_id')
  updateAnswer(
    @CurrentUser() user: JwtPayload,
    @Param('test_id') test_id: string,
    @Param('question_id') question_id: string,
    @Query('is_correct') is_correct?: string,
  ) {
    return this.testService.updateAnswer(
      user.sub,
      test_id,
      question_id,
      is_correct === undefined ? undefined : is_correct === 'true',
    );
  }

  @ApiOperation({
    description:
      'get the total number of questions of a test, without loading the questions array',
  })
  @Get(':id/questions/count')
  getQuestionsCount(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.testService.getQuestionsCount(user.sub, id);
  }

  @ApiOperation({ description: 'get one page of questions of a test' })
  @Get(':id/questions')
  getQuestionsPage(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('skip') skip: string,
    @Query('limit') limit: string,
  ) {
    return this.testService.getQuestionsPage(
      user.sub,
      id,
      Number(skip) || 0,
      Number(limit) || 9,
    );
  }

  @ApiOperation({
    description:
      'get the topics the questions of a test are on, with the flashcards of each',
  })
  @Get(':id/topics')
  getTopics(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.testService.getTopics(user.sub, id);
  }

  @ApiOperation({
    description: 'get the tests built as a repeat of this one, directly',
  })
  @Get(':id/children')
  getChildren(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.testService.getChildren(user.sub, id);
  }

  @Patch(':id/time')
  updateelapsed_time(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('time') time: number,
  ) {
    return this.testService.updateelapsed_time(user.sub, id, time);
  }

  @Patch(':id/complete')
  complete(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('time') time: number,
  ) {
    return this.testService.completeTest(user.sub, id, Number(time));
  }

  @Patch(':id/terminate')
  terminate(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.testService.terminateTest(user.sub, id);
  }

  @ApiOperation({ description: 'Delete one Flashcard from db' })
  @Delete(':id')
  delete(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<void | BadRequestException | NotFoundException> {
    return this.testService.delete(user.sub, id);
  }
}
