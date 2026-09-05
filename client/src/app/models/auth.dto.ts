/** The user as the server hands it back: never anything password related. */
export interface AuthUser {
  _id: string;
  username: string;
  /** Ministry code of the university, absent when the user skipped it. */
  universityCode?: string;
  course?: string;
  courseKind?: string;
}

export interface AuthResponse {
  access_token: string;
  user: AuthUser;
}

export interface Credentials {
  username: string;
  password: string;
}

/**
 * The study block, as both the registration and the profile send it. On the
 * profile it is a replacement: a field left out is a field cleared.
 */
export interface StudyFieldsPayload {
  universityCode?: string;
  course?: string;
  courseKind?: string;
}

/** What the registration form sends: the study fields are all optional. */
export interface RegistrationPayload extends Credentials, StudyFieldsPayload {}
