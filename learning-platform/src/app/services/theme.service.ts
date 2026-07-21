import { Injectable, computed, effect, signal } from '@angular/core';

export type Theme = 'default' | 'dark' | 'luminous' | 'cyan' | 'ocean' | 'forest' | 'sunset' | 'purple';

// Themes built on a dark canvas: these need Ionic's dark palette so its own
// components (popovers, alerts, inputs) don't render light-on-light.
const DARK_THEMES: readonly Theme[] = ['dark', 'luminous', 'cyan'];

export interface ThemeOption {
  name: Theme;
  label: string;
  description: string;
  icon: string;
}

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  // Kept as 'app-theme' so the pre-hydration script in index.html (which sets .ion-palette-dark
  // based on this key) stays in sync with the persisted theme.
  private readonly STORAGE_KEY = 'app-theme';

  readonly availableThemes: ThemeOption[] = [
    { name: 'default', label: 'Default Light', description: 'Clean and bright default theme', icon: 'sunny-outline' },
    { name: 'dark', label: 'Dark Mode', description: 'Easy on the eyes dark theme', icon: 'moon-outline' },
    { name: 'luminous', label: 'Luminous Dark', description: 'Deep black with glowing green accents', icon: 'sparkles-outline' },
    { name: 'cyan', label: 'Cyan Dark', description: 'Deep black with glowing cyan accents', icon: 'flash-outline' },
    { name: 'ocean', label: 'Ocean', description: 'Cool blue and teal colors', icon: 'water-outline' },
    { name: 'forest', label: 'Forest', description: 'Natural green and brown tones', icon: 'leaf-outline' },
    { name: 'sunset', label: 'Sunset', description: 'Warm orange and pink hues', icon: 'partly-sunny-outline' },
    { name: 'purple', label: 'Purple Dream', description: 'Royal purple theme', icon: 'color-palette-outline' }
  ];

  private themeSignal = signal<Theme>(this.resolveInitialTheme());

  readonly theme = this.themeSignal.asReadonly();
  readonly currentTheme = this.themeSignal.asReadonly();
  readonly isDark = computed(() => DARK_THEMES.includes(this.themeSignal()));

  constructor() {
    effect(() => this.applyTheme(this.themeSignal()));
  }

  getCurrentTheme(): Theme {
    return this.themeSignal();
  }

  setTheme(theme: Theme): void {
    this.themeSignal.set(theme);
    localStorage.setItem(this.STORAGE_KEY, theme);
  }

  // Quick light/dark switch, used by any remaining simple toggle.
  toggleTheme(): void {
    this.setTheme(this.isDark() ? 'default' : 'dark');
  }

  private resolveInitialTheme(): Theme {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored && this.availableThemes.some((t) => t.name === stored)) {
      return stored as Theme;
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'default';
  }

  private applyTheme(theme: Theme): void {
    const body = document.body;
    this.availableThemes.forEach((t) => body.classList.remove(`theme-${t.name}`));
    body.classList.add(`theme-${theme}`);

    // Keep the Ionic dark palette + playground dark surfaces in sync with dark themes.
    document.documentElement.classList.toggle('ion-palette-dark', DARK_THEMES.includes(theme));

    this.updateMetaThemeColor(theme);
  }

  private updateMetaThemeColor(theme: Theme): void {
    const colors: Record<Theme, string> = {
      default: '#7860f4',
      dark: '#121212',
      luminous: '#080c0a',
      cyan: '#070c0e',
      ocean: '#006994',
      forest: '#2e7d32',
      sunset: '#ff6f00',
      purple: '#7b1fa2'
    };

    let metaTag = document.querySelector('meta[name="theme-color"]');
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.setAttribute('name', 'theme-color');
      document.head.appendChild(metaTag);
    }
    metaTag.setAttribute('content', colors[theme]);
  }
}
