import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { baseUrlAPI } from '../../config/config';

/** One card of a reported post, with its pictures already inside it. */
export interface AdminCard {
  _id: string;
  title: string;
  question: string;
  answer: string;
  topic?: string;
}

export interface AdminReport {
  reportId: string;
  target: 'post' | 'comment' | 'feedback';
  postId: string;
  /** Set only when target is 'comment'. */
  commentId?: string;
  commentText?: string;
  /** Set only when target is 'feedback': the text of the message reported. */
  feedbackText?: string;
  authorId: string;
  author: string;
  reporterId: string;
  reporter: string;
  reporterStrikes: number;
  reporterBanned: boolean;
  subject: string;
  reason: string;
  note?: string;
  reports: number;
  strikes: number;
  hidden: boolean;
  banned: boolean;
  state: 'open' | 'kept' | 'removed';
  createdAt: string;
  cards: AdminCard[];
}

export type ModerationAction = 'keep' | 'remove' | 'warn' | 'ban' | 'restore';
/** Who an action is aimed at: the author of the content, or whoever reported it. */
export type ModerationSubject = 'author' | 'reporter';

/** Where the token is kept: this tab, this session, and nowhere else. */
const tokenKey = 'moderation-token';

/**
 * The moderation page's own way in.
 *
 * Deliberately apart from AuthService: this is not somebody's account, it is a
 * password that belongs to the server, and mixing the two would mean a
 * moderation token sitting in the same drawer as an ordinary login - and an
 * expired one logging the reader out of the app.
 */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly baseUrl = `${baseUrlAPI.replace(/\/+$/, '')}/admin`;

  constructor(private http: HttpClient) {}

  get token(): string | null {
    try {
      return sessionStorage.getItem(tokenKey);
    } catch {
      // A browser that refuses storage still works, one page at a time
      return null;
    }
  }

  get isIn(): boolean {
    return !!this.token;
  }

  async login(password: string): Promise<void> {
    const { token } = await firstValueFrom(
      this.http.post<{ token: string }>(`${this.baseUrl}/login`, { password }),
    );
    try {
      sessionStorage.setItem(tokenKey, token);
    } catch {
      // Nothing to do about it: the page keeps working until it is reloaded
    }
  }

  logout(): void {
    try {
      sessionStorage.removeItem(tokenKey);
    } catch {
      // Already gone as far as anybody can tell
    }
  }

  reports(): Promise<AdminReport[]> {
    return firstValueFrom(
      this.http.get<AdminReport[]>(`${this.baseUrl}/reports`, this.signed()),
    );
  }

  report(reportId: string): Promise<AdminReport> {
    return firstValueFrom(
      this.http.get<AdminReport>(
        `${this.baseUrl}/reports/${reportId}`,
        this.signed(),
      ),
    );
  }

  act(
    reportId: string,
    action: ModerationAction,
    against: ModerationSubject = 'author',
  ): Promise<{ done: string }> {
    return firstValueFrom(
      this.http.post<{ done: string }>(
        `${this.baseUrl}/reports/${reportId}/act`,
        { action, against },
        this.signed(),
      ),
    );
  }

  pardon(username: string): Promise<{ done: string }> {
    return firstValueFrom(
      this.http.post<{ done: string }>(
        `${this.baseUrl}/users/${username}/pardon`,
        {},
        this.signed(),
      ),
    );
  }

  private signed(): { headers: HttpHeaders } {
    return {
      headers: new HttpHeaders({ Authorization: `Bearer ${this.token ?? ''}` }),
    };
  }
}
