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

import { TopicService } from './topic.service';
import { ModifyTopicDto } from './topic.dto';
import { ApiOperation } from '@nestjs/swagger';
import { FilterRequest, BasePaginatedResult } from '../common.dto';
import { TopicDocument } from './topic.schema';

@Controller('topic')
export class TopicController {
  constructor(private readonly topicService: TopicService) {}

  @ApiOperation({ description: 'create a new Topic obj and push it on db' })
  @Post()
  create(@Body() createTopicDto: ModifyTopicDto): Promise<void> {
    return this.topicService.create(createTopicDto);
  }

  @ApiOperation({ description: 'get all Topic from db with filters' })
  @Get()
  findAll(
    @Query() filters: FilterRequest,
  ): Promise<BasePaginatedResult<TopicDocument>> {
    return this.topicService.findAll(filters);
  }

  @ApiOperation({ description: 'get a specific Topic from db' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.topicService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTopicDto: ModifyTopicDto) {
    return this.topicService.update(id, updateTopicDto);
  }

  @ApiOperation({ description: 'Delete one Topic from db' })
  @Delete(':id')
  delete(
    @Param('id') id: string,
  ): Promise<void | BadRequestException | NotFoundException> {
    return this.topicService.delete(id);
  }
}