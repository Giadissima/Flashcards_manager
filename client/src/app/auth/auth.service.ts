import { AuthResponse, AuthUser, Credentials } from '../models/auth.dto';

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

  async register(credentials: Credentials): Promise<void> {
    const response: AuthResponse = await this.restClient.post(this.baseUrl + '/register', credentials);
    this.storeSession(response);
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
    localStorage.setItem(userStorageKey, JSON.stringify(response.user));
    this._user.next(response.user);
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
