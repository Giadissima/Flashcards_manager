import { Flashcard } from '../models/flashcard.dto';
import { Subject } from '../models/subject.dto';
import { Topic } from '../models/topic.dto';
import { getSubjectIconUrl } from '../subject/subject-icon.util';

/**
 * Rendering helpers for a flashcard "card", shared by the home grid and the
 * test runner.
 *
 * Both endpoints these cards come from populate topic_id and subject_id (see
 * POPULATE in flashcards.service.ts), so a reference is either the whole object
 * or null when the referenced document was deleted - never a bare id string.
 */

const fallbackCardColor = 'blue';

/** Narrows a reference to the populated object, or undefined when there is none. */
function populated<T>(ref: string | T | undefined): T | undefined {
  return ref && typeof ref !== 'string' ? ref : undefined;
}

/** Colour of the strip on top of the card, taken from its topic. */
export function getCardColor(card: Flashcard): string {
  return populated<Topic>(card.topic_id)?.color || fallbackCardColor;
}

export function getCardSubjectIconUrl(card: Flashcard): string {
  return getSubjectIconUrl(populated<Subject>(card.subject_id));
}

export function getCardSubjectName(card: Flashcard): string {
  return populated<Subject>(card.subject_id)?.name ?? '';
}

export function getCardTopicName(card: Flashcard): string {
  return populated<Topic>(card.topic_id)?.name ?? '';
}

/**
 * Matches a body that already opens with a block element, as anything saved
 * through the rich-text editor does.
 */
const startsWithBlock = /^\s*<(p|div|ul|ol|h[1-6]|blockquote|pre|table|figure|img)\b/i;

/** Question or answer, wrapped in a paragraph so it always renders as a block. */
export function getCardBody(card: Flashcard, showAnswer: boolean): string {
  if (!card._id) return card.question;
  const body = showAnswer ? card.answer : card.question;

  // Only bare text gets the wrapper. A body that is already block markup must
  // not: <p> cannot nest, so <p><p>text</p></p> is parsed as an empty
  // paragraph, the real one, and another empty paragraph - two blank lines
  // around the text, which push it down and eat into the clamp on the home
  // grid.
  return startsWithBlock.test(body) ? body : '<p>' + body + '</p>';
}
