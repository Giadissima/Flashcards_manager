import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { CourseRecord, UniversityRecord } from './university.data';

import { ApiOperation } from '@nestjs/swagger';
import { Public } from 'src/auth/public.decorator';
import { UniversityService } from './university.service';

/**
 * Public on purpose: the registration form fills its two dropdowns from here,
 * and there is no token yet at that point. What it exposes is a published open
 * data list, so nothing is given away by leaving it open.
 */
@Controller('university')
export class UniversityController {
  constructor(private readonly universityService: UniversityService) {}

  @ApiOperation({ description: 'list the active Italian universities' })
  @Public()
  @Get()
  findAll(): UniversityRecord[] {
    return this.universityService.findAll();
  }

  @ApiOperation({
    description:
      'list the degree courses of one university; empty for post-graduate institutions',
  })
  @Public()
  @Get(':code/courses')
  findCourses(@Param('code') code: string): CourseRecord[] {
    // Told apart from "a real university that simply has no courses", which is
    // an empty list and not an error.
    if (!this.universityService.exists(code)) {
      throw new NotFoundException(`Unknown university code ${code}`);
    }
    return this.universityService.findCourses(code);
  }
}
