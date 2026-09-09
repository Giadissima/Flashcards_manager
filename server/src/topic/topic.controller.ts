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
import { JwtPayload } from 'src/auth/auth.dto';
import { TopicService } from './topic.service';
import { ModifyTopicDto } from './topic.dto';
import { ApiOperation } from '@nestjs/swagger';
import {
  BasePaginatedResult,
  ListFilterRequest,
  SetSpacedRepetitionDto,
  SetVisibilityDto,
} from '../common.dto';
import { TopicDocument } from './topic.schema';
import { SpacedRepetitionStatusFilter } from './topic.dto';

@Controller('topic')
export class TopicController {
  constructor(private readonly topicService: TopicService) {}

  @ApiOperation({ description: 'create a new Topic obj and push it on db' })
  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body() createTopicDto: ModifyTopicDto,
  ): Promise<void> {
    return this.topicService.create(user.sub, createTopicDto);
  }

  @ApiOperation({ description: 'get all Topic from db with filters' })
  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query() filters: ListFilterRequest,
  ): Promise<BasePaginatedResult<TopicDocument>> {
    return this.topicService.findAll(user.sub, filters);
  }

  @ApiOperation({
    description:
      'report, for each given subject, whether every one of its topics is in spaced repetition',
  })
  @Get('spaced-repetition-status')
  spacedRepetitionStatus(
    @CurrentUser() user: JwtPayload,
    @Query() filter: SpacedRepetitionStatusFilter,
  ): Promise<Record<string, boolean>> {
    return this.topicService.spacedRepetitionStatus(
      user.sub,
      filter.subject_ids,
    );
  }

  @ApiOperation({ description: 'get a specific Topic from db' })
  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.topicService.findOne(user.sub, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() updateTopicDto: ModifyTopicDto,
  ) {
    return this.topicService.update(user.sub, id, updateTopicDto);
  }

  @ApiOperation({ description: 'Delete one Topic from db' })
  @Delete(':id')
  delete(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<void | BadRequestException | NotFoundException> {
    return this.topicService.delete(user.sub, id);
  }

  @ApiOperation({
    description: 'set only the visibility, for the quick toggle in the lists',
  })
  @Patch(':id/visibility')
  setVisibility(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SetVisibilityDto,
  ): Promise<void> {
    return this.topicService.setVisibility(user.sub, id, dto.visibility);
  }

  @ApiOperation({
    description:
      'turn spaced repetition on or off for this topic, for the quick toggle in the lists',
  })
  @Patch(':id/spaced-repetition')
  setSpacedRepetition(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SetSpacedRepetitionDto,
  ): Promise<void> {
    return this.topicService.setSpacedRepetition(user.sub, id, dto.enabled);
  }

}