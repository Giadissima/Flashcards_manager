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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { SubjectService } from './subject.service';
import { ModifySubjectDto } from './subject.dto';
import { ApiBody, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { BasePaginatedResult, FilterRequest } from 'src/common.dto';
import { SubjectDocument } from './subject.schema';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('subject')
export class SubjectController {
  constructor(private readonly subjectService: SubjectService) {}

  @ApiOperation({ description: 'create a new subject obj and push it on db' })
  @Post()
  @UseInterceptors(FileInterceptor('icon'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Matematica' },
        desc: { type: 'string', example: 'Materia scientifica di base' },
        icon: {
          type: 'string',
          format: 'binary',
          description: 'Image file for the subject icon',
        },
      },
      required: ['name'],
    },
  })
  create(
    @Body() createSubjectDto: ModifySubjectDto,
    @UploadedFile() icon?: Express.Multer.File,
  ): Promise<void> {
    return this.subjectService.create(createSubjectDto, icon);
  }

  @ApiOperation({ description: 'get all subject from db with filters' })
  @Get('all')
  findAll(
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
  update(@Param('id') id: string, @Body() updateSubjectDto: ModifySubjectDto) {
    return this.subjectService.update(id, updateSubjectDto);
  }

  @ApiOperation({ description: 'Delete one subject from db' })
  @Delete(':id')
  delete(
    @Param('id') id: string,
  ): Promise<void | BadRequestException | NotFoundException> {
    return this.subjectService.delete(id);
  }
}
