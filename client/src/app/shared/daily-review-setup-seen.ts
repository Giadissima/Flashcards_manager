const storageKey = 'dailyReviewSetupSeen';

/** Whether the reader has already had the spaced-repetition manager opened for them once. */
export function hasSeenDailyReviewSetup(): boolean {
  return localStorage.getItem(storageKey) === 'true';
}

export function markDailyReviewSetupSeen(): void {
  localStorage.setItem(storageKey, 'true');
}
