/**
 * A search term as a literal piece of a regular expression.
 *
 * Everything a user types goes into a $regex, and the characters that mean
 * something to a regex engine mean nothing to the person typing them: an
 * unescaped "C++" is a syntax error, and a lone "(" would fail the query
 * rather than find nothing.
 */
export function escapeRegex(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
