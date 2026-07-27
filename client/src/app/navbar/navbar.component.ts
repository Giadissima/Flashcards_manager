import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TranslocoModule } from '@jsverse/transloco';
import { ImportExportModalComponent } from '../import-export-modal/import-export-modal.component';
import { SettingsModalComponent } from '../settings-modal/settings-modal.component';
import { ClickOutsideDirective } from '../shared/click-outside.directive';

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
  openDropdown: NavbarDropdown | null = null;

  toggleDropdown(name: NavbarDropdown): void {
    this.openDropdown = this.openDropdown === name ? null : name;
  }

  closeDropdown(name: NavbarDropdown): void {
    if (this.openDropdown === name) {
      this.openDropdown = null;
    }
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
