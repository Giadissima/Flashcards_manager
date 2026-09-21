import { Test } from '../models/test.dto';
import { TranslocoService } from '@jsverse/transloco';

export interface TestScore {
  correct: number;
  wrong: number;
  blank: number;
}

/**
 * How a test went, counted from its questions: right, wrong, and never
 * answered - the tail of a run still in progress, or what a test ended early
 * left blank. Shared by the history rows and the result page, which state the
 * same three numbers and must not count them differently.
 */
export function getTestScore(test: Pick<Test, 'questions'>): TestScore {
  return test.questions.reduce<TestScore>(
    (score, question) => {
      if (question.is_correct === true) score.correct++;
      else if (question.is_correct === false) score.wrong++;
      else score.blank++;
      return score;
    },
    { correct: 0, wrong: 0, blank: 0 }
  );
}

/**
 * "Subject · Topic" - what a test was about, the same line a flashcard carries
 * under its title. A test spanning several subjects or topics (e.g. a daily
 * review drawing cards from more than one) has no single name that would be
 * true of it, so each states how many instead of naming one of them; both are
 * missing on a test whose flashcards were all deleted, and then what is known
 * is shown and nothing else.
 */
export function getTestSubjectLabel(
  test: Test,
  transloco: TranslocoService,
): string {
  const subjects = test.subject_names ?? [];
  if (!subjects.length) return '';

  const subject =
    subjects.length === 1
      ? subjects[0]
      : transloco.translate('test.subjectCount', { count: subjects.length });

  const topics = test.topic_names ?? [];
  if (!topics.length) return subject;

  const topic =
    topics.length === 1
      ? topics[0]
      : transloco.translate('test.topicCount', { count: topics.length });
  return `${subject} · ${topic}`;
}

/**
 * What "N materie" stands for, listed out - so a test spanning several
 * subjects can be hovered to see which ones, instead of just how many.
 * Undefined on a single-subject test: the name is already stated in full,
 * nothing more to add.
 */
export function getTestSubjectTooltip(test: Test): string | undefined {
  const subjects = test.subject_names ?? [];
  return subjects.length > 1 ? subjects.join(', ') : undefined;
}
