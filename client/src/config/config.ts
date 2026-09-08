export const baseUrlAPI = '/api/' 


// form data limits
export const charMinLength = 2;
export const titleMaxLength = 100;
export const questionMaxLength = 700;
export const answerMaxLength = 8000;
export const nameMaxLength = 30;
export const descMaxLength = 1000;
export const usernameMaxLength = 30;
export const passwordMinLength = 8;
// bcrypt only hashes the first 72 bytes, so the server refuses anything longer
export const passwordMaxLength = 72;
// 64 for the local part, one @, 255 for the domain: the standard's own limit
export const emailMaxLength = 254;

// how many entries a subject/topic dropdown loads at once
export const selectableListLimit = 50;