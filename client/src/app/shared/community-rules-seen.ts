const storageKey = 'communityRulesSeen';

/** Whether the reader has already had the community rules modal shown to them. */
export function hasSeenCommunityRules(): boolean {
  return localStorage.getItem(storageKey) === 'true';
}

export function markCommunityRulesSeen(): void {
  localStorage.setItem(storageKey, 'true');
}
