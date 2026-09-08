import { AuthResponse, AuthUser, Credentials, RegistrationPayload } from '../models/auth.dto';

import { BehaviorSubject } from 'rxjs';
import { Injectable } from '@angular/core';
import { RestClientService } from '../api/rest-api.service';
import { Router } from '@angular/router';

const tokenStorageKey = 'auth_token';
const userStorageKey = 'auth_user';

/**
 * Holds the session: the token every request is signed with, and who it belongs
 * to. Both are kept in localStorage so a reload, or a second tab, finds the user
 * still logged in - the token is the only thing that proves anything, and the
 * server checks it on every call.
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private baseUrl = 'auth';

  private _user = new BehaviorSubject<AuthUser | null>(this.readStoredUser());
  user$ = this._user.asObservable();

  constructor(
    private restClient: RestClientService,
    private router: Router,
  ) {}

  get token(): string | null {
    return localStorage.getItem(tokenStorageKey);
  }

  get user(): AuthUser | null {
    return this._user.value;
  }

  /**
   * Only says that a token is on hand, not that it is still valid: an expired
   * one is found out on the first call that comes back 401, and the interceptor
   * ends the session there.
   */
  get isLoggedIn(): boolean {
    return !!this.token && !!this.user;
  }

  async login(credentials: Credentials): Promise<void> {
    const response: AuthResponse = await this.restClient.post(this.baseUrl + '/login', credentials);
    this.storeSession(response);
  }

  async register(payload: RegistrationPayload): Promise<void> {
    const response: AuthResponse = await this.restClient.post(this.baseUrl + '/register', payload);
    this.storeSession(response);
  }

  /**
   * Spends the token out of a confirmation mail.
   *
   * Reachable logged out, because the link is opened from an inbox and that
   * may well be a browser this site has never seen. When somebody is logged in
   * the stored copy of the user is refreshed straight after, so the notice
   * about the unconfirmed address goes away without a reload.
   */
  async verifyEmail(token: string): Promise<void> {
    await this.restClient.post(this.baseUrl + '/verify-email', { token });
    if (this.isLoggedIn) await this.fetchMe();
  }

  /** Asks for the confirmation mail again, for whoever is logged in. */
  async resendVerification(): Promise<void> {
    await this.restClient.post(this.baseUrl + '/verify-email/resend', {});
  }

  /**
   * The user as the server has them now. The copy in storage is only there to
   * show a name without waiting for a round trip, so a page that edits the
   * profile asks for the real thing.
   */
  async fetchMe(): Promise<AuthUser> {
    const user = await this.restClient.get<AuthUser>(this.baseUrl + '/me');
    this.storeUser(user);
    return user;
  }

  /**
   * Replaces the profile: what is left out of the form is cleared, not kept.
   * Sent as multipart because it can carry the avatar picture.
   */
  async updateProfile(profile: FormData): Promise<AuthUser> {
    const user: AuthUser = await this.restClient.patch(this.baseUrl + '/me', profile);
    this.storeUser(user);
    return user;
  }

  /** Clears the session and sends the browser back to the login page. */
  logout(): void {
    localStorage.removeItem(tokenStorageKey);
    localStorage.removeItem(userStorageKey);
    this._user.next(null);
    this.router.navigate(['/login']);
  }

  private storeSession(response: AuthResponse): void {
    localStorage.setItem(tokenStorageKey, response.access_token);
    this.storeUser(response.user);
  }

  private storeUser(user: AuthUser): void {
    localStorage.setItem(userStorageKey, JSON.stringify(user));
    this._user.next(user);
  }

  // The stored user is only there to show a name without waiting for a round
  // trip, so anything unreadable is dropped instead of breaking the startup.
  private readStoredUser(): AuthUser | null {
    const raw = localStorage.getItem(userStorageKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      localStorage.removeItem(userStorageKey);
      return null;
    }
  }
}
