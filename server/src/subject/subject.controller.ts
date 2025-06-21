import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { SubjectService } from './subject.service';
import { CreateSubjectDto } from './subject.dto';
import { ApiOperation } from '@nestjs/swagger';
import { BasePaginatedResult, FilterRequest } from 'src/common.dto';
import { SubjectDocument } from './subject.schema';

@Controller('subject')
export class SubjectController {
  constructor(private readonly subjectService: SubjectService) {}

  @Post()
  create(@Body() createSubjectDto: CreateSubjectDto) {
    return this.subjectService.create(createSubjectDto);
  }

  @ApiOperation({ description: 'get all email from database' })
  @Get('all')
  async findAll(
    @Query() filters: FilterRequest,
  ): Promise<BasePaginatedResult<SubjectDocument>> {
    return this.subjectService.findAll(filters);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.subjectService.findOne(id);
  }

  // @Patch(':id')
  // update(@Param('id') id: string, @Body() updateSubjectDto: UpdateSubjectDto) {
  //   return this.subjectService.update(+id, updateSubjectDto);
  // }

  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.subjectService.remove(+id);
  // }
}
