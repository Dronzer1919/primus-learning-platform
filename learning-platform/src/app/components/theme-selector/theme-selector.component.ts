import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ThemeService, Theme } from '../../services/theme.service';

@Component({
  selector: 'app-theme-selector',
  templateUrl: './theme-selector.component.html',
  styleUrls: ['./theme-selector.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class ThemeSelectorComponent {
  isOpen = false;
  event?: Event;

  constructor(public themeService: ThemeService) {}

  presentPopover(event: Event): void {
    this.event = event;
    this.isOpen = true;
  }

  selectTheme(theme: Theme): void {
    this.themeService.setTheme(theme);
    this.isOpen = false;
  }

  isCurrentTheme(theme: Theme): boolean {
    return this.themeService.getCurrentTheme() === theme;
  }
}
