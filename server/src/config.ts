export const charMinLength = 2;
export const titleMaxLength = 100;
export const questionMaxLength = 700;
export const answerMaxLength = 8000;
export const idLength = 24;
export const nameMaxLength = 30;
export const descMaxLength = 1000;
export const usernameMaxLength = 30;
export const passwordMinLength = 8;
// bcrypt only hashes the first 72 bytes, so anything longer is silently truncated
export const passwordMaxLength = 72;
export const bcryptSaltRounds = 10;
// The longest course name the ministry publishes is 234 characters
export const courseMaxLength = 250;

// ------------------------------------------------------------- moderation

/**
 * How many different people have to report a post before it steps out of the
 * feed on its own, until somebody looks at it.
 *
 * Three, not one: one report is one person's opinion, and letting it hide a
 * post would hand every account a veto over everybody else's work.
 */
export const autoHideReports = 3;

/** How long the address of a banned account cannot open a new one. */
export const signupBlockHours = 24;

/**
 * How many banned accounts have to have come from one address before it is
 * held shut.
 *
 * One is not enough, and this is the number that decides whether the rule is
 * fair: a whole faculty shares the university's wifi, so the first ban from
 * there says something about a person and nothing about the address. Three
 * says something about the address.
 */
export const signupBlockAfterBans = 3;

/**
 * How much one address may ask for, per minute.
 *
 * Nothing here is per account on purpose: an account is free, so a limit on
 * one is a limit on nothing. The address is the only thing that costs
 * something to change, and these numbers are what one person browsing needs
 * with room to spare - a page of the feed pulls a picture per post.
 */
export const rateLimits = {
  /** Everything, to catch a script hammering any endpoint at all. */
  all: { ttl: 60_000, limit: 300 },
  /**
   * Making an account. High on purpose: a lecture hall on the university wifi
   * is one address, and thirty people signing up during a class is a good
   * afternoon - while a farm wants thousands and is stopped either way.
   */
  register: { ttl: 60 * 60_000, limit: 30 },
  /** Trying passwords. */
  login: { ttl: 10 * 60_000, limit: 20 },
  /** Anything that puts words in front of other people. */
  write: { ttl: 60_000, limit: 20 },
} as const;

export const Filters = {
  skipMinLength: 0,
  limitMinLength: 1,
  limitMaxLength: 50,
} as const;
