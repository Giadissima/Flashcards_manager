import { CourseRecord, UniversityRecord, courses, universities } from './university.data';

import { Injectable } from '@nestjs/common';

/**
 * Serves the Italian university reference data, and is the single place that
 * decides whether a university code or a course name is a real one.
 *
 * The lists are generated files held in memory rather than documents in Mongo:
 * nothing in the application ever writes them, they are replaced wholesale by
 * the update script, and keeping them out of the database saves a seeding step
 * on every new environment and a migration on every refresh.
 */
@Injectable()
export class UniversityService {
  // Built once at startup: the lookups below run on every registration.
  private readonly byCode = new Map<string, UniversityRecord>(
    universities.map((university) => [university.code, university]),
  );

  private readonly coursesByCode = new Map<string, CourseRecord[]>();

  constructor() {
    for (const course of courses) {
      const list = this.coursesByCode.get(course.universityCode);
      if (list) list.push(course);
      else this.coursesByCode.set(course.universityCode, [course]);
    }
  }

  findAll(): UniversityRecord[] {
    return universities;
  }

  /**
   * The courses of one university. Empty for the post-graduate institutions
   * (Normale, Sant'Anna, SISSA and the like), which have no degree courses in
   * the ministry's list at all - the caller has to expect nothing back.
   */
  findCourses(universityCode: string): CourseRecord[] {
    return this.coursesByCode.get(universityCode) ?? [];
  }

  exists(universityCode: string): boolean {
    return this.byCode.has(universityCode);
  }

  /**
   * A course is identified by its name *and* its level: 272 of them run as both
   * a Laurea and a Laurea Magistrale under the very same name, so the name on
   * its own would accept a degree the university does not offer at that level.
   */
  hasCourse(universityCode: string, name: string, kind: string): boolean {
    return this.findCourses(universityCode).some(
      (course) =>
        course.name.toLowerCase() === name.toLowerCase() &&
        course.kind.toLowerCase() === kind.toLowerCase(),
    );
  }
}
