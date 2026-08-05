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
  openDropdown: NavbarDropdown | null = null; // serve per dire se è stato fatto un click delle selezioni "topics", "subject",...
  isMobileMenuOpen = false;
  // disabilita temporaneamente la transizione della sidebar mentre si ridimensiona la finestra,
  // altrimenti attraversare il breakpoint mobile la fa "lampeggiare" aperta un istante
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

  // inverte lo stato (chiuso o aperto) del menù hamburger fatto per i dispositivi mobile
  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    if (!this.isMobileMenuOpen) {
      this.openDropdown = null; // azzera le scelte fatte sulle dropdown
    }
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
    this.openDropdown = null;
  }
  
  // se è stata cliccata una route, naviga a quella pagine chiudendo il menù e azzerando la scelta
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
