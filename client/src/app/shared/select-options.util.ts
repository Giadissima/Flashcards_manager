import { Course, University } from '../models/university.dto';

import { SelectOption } from './searchable-select/searchable-select.component';
import { Subject } from '../models/subject.dto';
import { Topic } from '../models/topic.dto';
import { getSubjectIconUrl } from '../subject/subject-icon.util';

/**
 * Subjects and topics are offered in an <app-searchable-select> on almost every
 * page, always with the same shape: the icon for a subject, the colour dot for
 * a topic. The mapping lives here instead of being a getter on each component.
 */

export function toSubjectOptions(subjects: Subject[]): SelectOption[] {
  return subjects.map((subject) => ({
    value: subject._id!,
    label: subject.name,
    iconUrl: getSubjectIconUrl(subject),
  }));
}

export function toTopicOptions(topics: Topic[]): SelectOption[] {
  return topics.map((topic) => ({
    value: topic._id!,
    label: topic.name,
    color: topic.color,
  }));
}

export function toUniversityOptions(universities: University[]): SelectOption[] {
  return universities.map((university) => ({
    value: university.code,
    label: university.name,
  }));
}

/**
 * The value carries the level as well as the name: 272 courses run as both a
 * Laurea and a Laurea Magistrale under the same name, so the name alone would
 * give two options that cannot be told apart - or selected apart.
 */
export const courseOptionValue = (course: Course): string =>
  `${course.kind}|${course.name}`;

export function toCourseOptions(courses: Course[]): SelectOption[] {
  return courses.map((course) => ({
    value: courseOptionValue(course),
    label: `${course.name} (${course.kind})`,
  }));
}
