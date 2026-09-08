/**
 * The sentence to show when the server says an account may not do something.
 *
 * The three refusals all look the same on the way back - a 403 carrying which
 * privilege and until when - so turning one into words belongs in one place
 * rather than in every catch block that might meet one.
 *
 * An address that was never confirmed comes back the same way and is read
 * here too: it stops the same three things, and every place that already
 * shows a block gets the sentence for it without being touched.
 */
export interface RestrictionError {
  key: string;
  params: { until: string };
}

interface HttpErrorLike {
  status?: number;
  error?: { code?: string; privilege?: string; until?: string | null };
}

/**
 * Reads a failed call, and says what to tell the user - or null when the call
 * failed for any of the ordinary reasons, which the caller words itself.
 */
export function restrictionOf(error: unknown): RestrictionError | null {
  const failure = error as HttpErrorLike;
  if (failure?.status !== 403) return null;

  // No date on this one, and nothing to wait for: it ends when the reader
  // opens the mail, which is what the sentence says.
  if (failure.error?.code === 'emailNotVerified') {
    return { key: 'auth.verify.blocked', params: { until: '' } };
  }

  if (failure.error?.code !== 'restricted') return null;

  const until = failure.error.until;
  const privilege = failure.error.privilege ?? 'publish';

  return {
    // A block with no end reads differently from one with a date on it, and
    // "until Invalid Date" is the worst of both.
    key: until
      ? `moderation.blocked.${privilege}`
      : `moderation.blockedForever.${privilege}`,
    params: {
      until: until
        ? new Date(until).toLocaleDateString(undefined, {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })
        : '',
    },
  };
}
