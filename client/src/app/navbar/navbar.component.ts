import { AuthService } from '../auth/auth.service';
import { Observable, map } from 'rxjs';
import { getAvatarUrl } from '../shared/avatar/avatar.util';
import { ClickOutsideDirective } from '../shared/click-outside.directive';
import { CommonModule } from '@angular/common';
import { Component, HostListener } from '@angular/core';
import { ImportExportModalComponent } from '../import-export-modal/import-export-modal.component';
import { NotificationPanelComponent } from '../notification/notification-panel.component';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { SettingsModalComponent } from '../settings-modal/settings-modal.component';
import { ToastService } from '../shared/toast/toast.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { TutorialModalComponent } from '../shared/tutorial/tutorial-modal.component';

type NavbarDropdown = 'flashcards' | 'topics' | 'subjects' | 'test' | 'account' | 'accountDrawer';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule, ImportExportModalComponent, SettingsModalComponent, ClickOutsideDirective, TranslocoModule, NotificationPanelComponent, TutorialModalComponent],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent {
  isSettingsOpen = false;
  isImportExportOpen = false;
  // Which of the "topics" / "subjects" / "test" menus is currently open
  openDropdown: NavbarDropdown | null = null;
  isMobileMenuOpen = false;
  // Temporarily disables the sidebar transition while the window is resized:
  // crossing the mobile breakpoint would otherwise make it flash open for a moment
  isResizing = false;
  private resizeTimeoutId: ReturnType<typeof setTimeout> | null = null;

  /**
   * Derived from the stream rather than read in the template: the URL is a
   * generated data URI when no picture is uploaded, and a plain call would
   * rebuild it on every change detection run.
   */
  readonly avatarUrl$: Observable<string>;

  constructor(
    protected authService: AuthService,
    private toastService: ToastService,
    private transloco: TranslocoService,
  ) {
    this.avatarUrl$ = this.authService.user$.pipe(map((user) => getAvatarUrl(user)));
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.isResizing = true;
    if (this.resizeTimeoutId) {
      clearTimeout(this.resizeTimeoutId);
    }
    this.resizeTimeoutId = setTimeout(() => {
      this.isResizing = false;
    }, 150);
  }

  toggleDropdown(name: NavbarDropdown): void {
    this.openDropdown = this.openDropdown === name ? null : name;
  }

  closeDropdown(name: NavbarDropdown): void {
    if (this.openDropdown === name) {
      this.openDropdown = null;
    }
  }

  // Toggles the hamburger menu used on mobile devices
  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    if (!this.isMobileMenuOpen) {
      this.openDropdown = null; // also collapse any open dropdown
    }
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
    this.openDropdown = null;
  }

  // A route was clicked: navigate there, closing the menu and the dropdown
  onNavigate(name: NavbarDropdown): void {
    this.closeDropdown(name);
    this.closeMobileMenu();
  }

  logout(): void {
    this.closeMobileMenu();
    this.authService.logout();
    this.toastService.show(this.transloco.translate('auth.toast.loggedOut'), 'info');
  }

  openSettings(): void {
    this.isSettingsOpen = true;
  }

  // The mobile stand-in for the standalone settings button, folded into the
  // profile dropdown once the bar has no room for it on its own.
  openSettingsFromAccount(): void {
    this.closeMobileMenu(); // also closes the dropdown, being inside the drawer
    this.openSettings();
  }

  onOpenImportExportFromSettings(): void {
    this.isSettingsOpen = false;
    this.isImportExportOpen = true;
  }

  onImportExportBack(): void {
    this.isImportExportOpen = false;
    this.isSettingsOpen = true;
  }
}
