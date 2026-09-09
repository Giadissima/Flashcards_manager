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
// What an address is allowed to be, by the standard: 64 for the local part,
// one @, 255 for the domain - refusing anything longer costs nobody a mailbox
export const emailMaxLength = 254;

// ---------------------------------------------------------------- addresses

/**
 * How long a confirmation link stays good for.
 *
 * A day: long enough that a mail read the next morning still works, short
 * enough that a link forwarded, or left in an inbox somebody else later opens,
 * is spent by the time it is found.
 */
export const verificationTokenHours = 24;

// ------------------------------------------------------------- moderation

/**
 * How many different people have to report a post before it steps out of the
 * feed on its own, until somebody looks at it.
 *
 * Three, not one: one report is one person's opinion, and letting it hide a
 * post would hand every account a veto over everybody else's work.
 */
export const autoHideReports = 3;

/** Same idea, for one comment instead of a whole post - cheap enough to take
 * down on the same three-strangers rule rather than a blunter one. */
export const autoHideCommentReports = 3;

/**
 * How many comments the same person may leave under the same post inside the
 * window below before a cool-down kicks in.
 *
 * Checked in the service itself and not only through the generic write limit
 * further down: that budget is shared with every other write the account
 * makes, so a script pointed only at this one endpoint would otherwise still
 * be free to bury a single post in messages nobody but its author will ever
 * read.
 */
export const commentFloodLimit = { windowMinutes: 10, max: 5 };

/** Same idea, for feedback threads opened against the same author. */
export const feedbackFloodLimit = { windowMinutes: 10, max: 5 };

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
 * How many cards of a reported post the moderation page shows.
 *
 * All of them that the carousel would: the page exists to be looked at before
 * deciding, and a set whose fortieth card is the problem is exactly the set
 * somebody would report.
 */
export const allCards = 200;

/** How long a session on the moderation page lasts before asking again. */
export const adminSessionHours = 8;

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
  /**
   * Asking for the confirmation mail again. Low, and per address: every one of
   * these is a mail somebody's server has to deliver, and a button that can be
   * held down is how an account ends up in a spam folder for good.
   */
  resendVerification: { ttl: 60 * 60_000, limit: 5 },
  /** Anything that puts words in front of other people. */
  write: { ttl: 60_000, limit: 20 },
} as const;

export const Filters = {
  skipMinLength: 0,
  limitMinLength: 1,
  limitMaxLength: 50,
} as const;
