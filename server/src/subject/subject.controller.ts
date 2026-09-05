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
import { CurrentUser } from 'src/auth/current-user.decorator';
import { JwtPayload } from 'src/auth/auth.dto';
import { SubjectService } from './subject.service';
import { ModifySubjectDto } from './subject.dto';
import { ApiBody, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { BasePaginatedResult, ListFilterRequest } from 'src/common.dto';
import { SubjectDocument } from './subject.schema';
import { FileInterceptor } from '@nestjs/platform-express';

// Shared by create and update; the icon differs, so it stays at each call site.
const subjectPayloadFields = {
  name: { type: 'string', example: 'Matematica' },
  desc: { type: 'string', example: 'Materia scientifica di base' },
  color: { type: 'string', example: '#7fa8d9' },
} as const;

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
        ...subjectPayloadFields,
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
    @CurrentUser() user: JwtPayload,
    @Body() createSubjectDto: ModifySubjectDto,
    @UploadedFile() icon?: Express.Multer.File,
  ): Promise<void> {
    return this.subjectService.create(user.sub, createSubjectDto, icon);
  }

  @ApiOperation({ description: 'get all subject from db with filters' })
  @Get('all')
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query() filters: ListFilterRequest,
  ): Promise<BasePaginatedResult<SubjectDocument>> {
    return this.subjectService.findAll(user.sub, filters);
  }

  @ApiOperation({ description: 'get a specific subject from db' })
  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.subjectService.findOne(user.sub, id);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('icon'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        ...subjectPayloadFields,
        icon: {
          type: 'string',
          format: 'binary',
          description: 'New image file for the subject icon (optional)',
        },
      },
    },
  })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() updateSubjectDto: ModifySubjectDto,
    @UploadedFile() icon?: Express.Multer.File,
  ) {
    return this.subjectService.update(user.sub, id, updateSubjectDto, icon);
  }

  @ApiOperation({ description: 'Delete one subject from db' })
  @Delete(':id')
  delete(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<void | BadRequestException | NotFoundException> {
    return this.subjectService.delete(user.sub, id);
  }

}
