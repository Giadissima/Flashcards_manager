import { BehaviorSubject } from 'rxjs';
import { Injectable } from '@angular/core';

export type AppTheme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private _theme = new BehaviorSubject<AppTheme>(this.detectInitialTheme());
  theme$ = this._theme.asObservable();

  constructor() {
    this.applyTheme(this._theme.value);
  }

  get theme(): AppTheme {
    return this._theme.value;
  }

  // Applies the theme right away as a preview, without saving it (see persist())
  setTheme(theme: AppTheme): void {
    this._theme.next(theme);
    this.applyTheme(theme);
  }

  persist(): void {
    localStorage.setItem(STORAGE_KEY, this._theme.value);
  }

  private applyTheme(theme: AppTheme): void {
    document.documentElement.setAttribute('data-theme', theme);
  }

  private detectInitialTheme(): AppTheme {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}
