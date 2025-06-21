import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { SubjectService } from './subject.service';
import { CreateSubjectDto, UpdateSubjectDto } from './subject.dto';
import { ApiOperation } from '@nestjs/swagger';
import { BasePaginatedResult, FilterRequest } from 'src/common.dto';
import { SubjectDocument } from './subject.schema';

@Controller('subject')
export class SubjectController {
  constructor(private readonly subjectService: SubjectService) {}

  @ApiOperation({ description: 'create a new subject obj and push it on db' })
  @Post()
  create(@Body() createSubjectDto: CreateSubjectDto) {
    return this.subjectService.create(createSubjectDto);
  }

  @ApiOperation({ description: 'get all subject from db with filters' })
  @Get('all')
  async findAll(
    @Query() filters: FilterRequest,
  ): Promise<BasePaginatedResult<SubjectDocument>> {
    return this.subjectService.findAll(filters);
  }

  @ApiOperation({ description: 'get a specific subject from db' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.subjectService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSubjectDto: UpdateSubjectDto) {
    return this.subjectService.update(id, updateSubjectDto);
  }

  @ApiOperation({ description: 'Delete one subject from db' })
  @Delete(':id')
  async delete(
    @Param('id') id: string,
  ): Promise<void | BadRequestException | NotFoundException> {
    await this.subjectService.delete(id);
  }
}
