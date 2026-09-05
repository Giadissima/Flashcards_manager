/** The user as the server hands it back: never anything password related. */
export interface AuthUser {
  _id: string;
  username: string;
}

export interface AuthResponse {
  access_token: string;
  user: AuthUser;
}

export interface Credentials {
  username: string;
  password: string;
}
