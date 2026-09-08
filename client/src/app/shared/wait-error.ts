/**
 * The wait a 429 asks for, in words somebody can act on.
 *
 * The server answers with the seconds left; the form has to say them as a
 * length of time, because "riprova tra 3540 secondi" is the same as saying
 * nothing. Rounded up: telling somebody to come back in "0 minuti" would send
 * them straight back into the same refusal.
 */
export interface WaitError {
  key: string;
  params: { minutes: number };
}

interface HttpErrorLike {
  status?: number;
  error?: { code?: string; retryAfter?: number };
}

export function waitErrorOf(error: unknown): WaitError | null {
  const failure = error as HttpErrorLike;
  if (failure?.status !== 429) return null;

  const code = failure.error?.code ?? 'tooFast';
  return {
    key: `auth.error.${code}`,
    params: { minutes: Math.max(1, Math.ceil((failure.error?.retryAfter ?? 60) / 60)) },
  };
}
