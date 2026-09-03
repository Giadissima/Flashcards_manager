import { Test } from '../models/test.dto';

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
 * under its title. The topic is only sent by the server when the whole test
 * shares one, and the subject is missing on a test whose flashcards were all
 * deleted: either way what is known is shown, and nothing else.
 */
export function getTestSubjectLabel(test: Test): string {
  if (!test.subject_name) return '';
  return test.topic_name ? `${test.subject_name} · ${test.topic_name}` : test.subject_name;
}
