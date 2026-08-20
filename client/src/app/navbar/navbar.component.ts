import { ClickOutsideDirective } from '../shared/click-outside.directive';
import { CommonModule } from '@angular/common';
import { Component, HostListener } from '@angular/core';
import { ImportExportModalComponent } from '../import-export-modal/import-export-modal.component';
import { RouterLink } from '@angular/router';
import { SettingsModalComponent } from '../settings-modal/settings-modal.component';
import { TranslocoModule } from '@jsverse/transloco';

type NavbarDropdown = 'topics' | 'subjects' | 'test';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, CommonModule, ImportExportModalComponent, SettingsModalComponent, ClickOutsideDirective, TranslocoModule],
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

  openSettings(): void {
    this.isSettingsOpen = true;
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
