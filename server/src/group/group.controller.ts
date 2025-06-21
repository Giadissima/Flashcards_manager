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

import { GroupService } from './group.service';
import { CreateGroupDto, UpdateGroupDto } from './group.dto';
import { ApiOperation } from '@nestjs/swagger';
import { FilterRequest, BasePaginatedResult } from '../common.dto';
import { GroupDocument } from './group.schema';

@Controller('group')
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @ApiOperation({ description: 'create a new Group obj and push it on db' })
  @Post()
  create(@Body() createGroupDto: CreateGroupDto) {
    return this.groupService.create(createGroupDto);
  }

  @ApiOperation({ description: 'get all Group from db with filters' })
  @Get('all')
  async findAll(
    @Query() filters: FilterRequest,
  ): Promise<BasePaginatedResult<GroupDocument>> {
    return this.groupService.findAll(filters);
  }

  @ApiOperation({ description: 'get a specific Group from db' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.groupService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateGroupDto: UpdateGroupDto) {
    return this.groupService.update(id, updateGroupDto);
  }

  @ApiOperation({ description: 'Delete one Group from db' })
  @Delete(':id')
  async delete(
    @Param('id') id: string,
  ): Promise<void | BadRequestException | NotFoundException> {
    await this.groupService.delete(id);
  }
}
