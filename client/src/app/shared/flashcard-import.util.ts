/** A parsed flashcard, ready to fill the create form. */
export interface ParsedFlashcard {
  title: string;
  question: string;
  answer: string;
}

// Mirrors the format "copia card" builds in home.ts: title, then a
// "Question: " line, then an "Answer: " line, each carrying everything up to
// the next marker (question/answer can themselves hold several lines, since
// they are the HTML the rich text editor produced).
const importPattern = /^([\s\S]*?)\r?\nQuestion:\s*([\s\S]*?)\r?\nAnswer:\s*([\s\S]*)$/;

export function parseFlashcardText(text: string): ParsedFlashcard | null {
  const match = text.trim().match(importPattern);
  if (!match) return null;

  const [, title, question, answer] = match;
  if (!title.trim() || !question.trim() || !answer.trim()) return null;

  return { title: title.trim(), question: question.trim(), answer: answer.trim() };
}
