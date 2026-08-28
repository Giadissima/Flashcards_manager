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
