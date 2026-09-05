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

export const Filters = {
  skipMinLength: 0,
  limitMinLength: 1,
  limitMaxLength: 50,
} as const;
