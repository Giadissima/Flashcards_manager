/** The user as the server hands it back: never anything password related. */
export interface AuthUser {
  _id: string;
  username: string;
  /** Where the account can be reached. Absent on the accounts made before the
      field existed, which is also why they count as confirmed. */
  email?: string;
  /** False only while a confirmation link is still unopened - and only that
      stands between the account and the Community section. */
  emailVerified: boolean;
  /** Ministry code of the university, absent when the user skipped it. */
  universityCode?: string;
  course?: string;
  courseKind?: string;
  /** Id of the uploaded picture; absent means the default drawing. */
  avatar?: string;
  avatarColor?: string;
  /** Whether the Community rules modal has already been shown to this account. */
  communityRulesSeen: boolean;
  /** Present only while reporting is blocked. `until` is null for good. */
  reportBlocked?: { until: string | null };
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

/** What the registration form sends: only the study fields are optional. */
export interface RegistrationPayload extends Credentials, StudyFieldsPayload {
  email: string;
}
