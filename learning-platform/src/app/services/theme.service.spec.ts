import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    localStorage.removeItem('app-theme');
    document.body.className = '';
    document.documentElement.classList.remove('ion-palette-dark');
    document.querySelector('meta[name="theme-color"]')?.remove();
  });

  afterEach(() => {
    localStorage.removeItem('app-theme');
    document.body.className = '';
    document.documentElement.classList.remove('ion-palette-dark');
    document.querySelector('meta[name="theme-color"]')?.remove();
  });

  function create(): ThemeService {
    TestBed.configureTestingModule({});
    return TestBed.inject(ThemeService);
  }

  describe('initial theme resolution', () => {
    it('uses a validly-stored theme', () => {
      localStorage.setItem('app-theme', 'ocean');
      service = create();
      expect(service.getCurrentTheme()).toBe('ocean');
    });

    it('ignores an invalid stored value and falls back to matchMedia/default', () => {
      localStorage.setItem('app-theme', 'not-a-real-theme');
      spyOn(window, 'matchMedia').and.returnValue({ matches: false } as MediaQueryList);
      service = create();
      expect(service.getCurrentTheme()).toBe('default');
    });

    it('defaults to dark when no theme is stored and the OS prefers dark', () => {
      spyOn(window, 'matchMedia').and.returnValue({ matches: true } as MediaQueryList);
      service = create();
      expect(service.getCurrentTheme()).toBe('dark');
    });

    it('defaults to "default" (light) when no theme is stored and the OS has no preference', () => {
      spyOn(window, 'matchMedia').and.returnValue({ matches: false } as MediaQueryList);
      service = create();
      expect(service.getCurrentTheme()).toBe('default');
    });
  });

  describe('setTheme() / getCurrentTheme() / currentTheme signal', () => {
    beforeEach(() => (service = create()));

    it('updates getCurrentTheme() and the currentTheme signal', () => {
      service.setTheme('forest');
      expect(service.getCurrentTheme()).toBe('forest');
      expect(service.currentTheme()).toBe('forest');
    });

    it('persists the choice to localStorage', () => {
      service.setTheme('purple');
      expect(localStorage.getItem('app-theme')).toBe('purple');
    });
  });

  describe('isDark computed', () => {
    beforeEach(() => (service = create()));

    it('is true for a theme in the dark set (dark, luminous, cyan)', () => {
      service.setTheme('dark');
      expect(service.isDark()).toBeTrue();
      service.setTheme('luminous');
      expect(service.isDark()).toBeTrue();
      service.setTheme('cyan');
      expect(service.isDark()).toBeTrue();
    });

    it('is false for a light theme (default, ocean, forest, sunset, purple)', () => {
      service.setTheme('ocean');
      expect(service.isDark()).toBeFalse();
    });
  });

  describe('toggleTheme()', () => {
    beforeEach(() => (service = create()));

    it('switches from a non-dark theme to dark', () => {
      service.setTheme('ocean');
      service.toggleTheme();
      expect(service.getCurrentTheme()).toBe('dark');
    });

    it('switches from a dark theme back to default', () => {
      service.setTheme('dark');
      service.toggleTheme();
      expect(service.getCurrentTheme()).toBe('default');
    });
  });

  describe('applyTheme() side effects (via setTheme, run through the constructor\'s effect)', () => {
    beforeEach(() => (service = create()));

    it('adds a theme-<name> class to <body> and removes the previous one', () => {
      service.setTheme('ocean');
      TestBed.flushEffects();
      expect(document.body.classList.contains('theme-ocean')).toBeTrue();

      service.setTheme('forest');
      TestBed.flushEffects();
      expect(document.body.classList.contains('theme-ocean')).toBeFalse();
      expect(document.body.classList.contains('theme-forest')).toBeTrue();
    });

    it('toggles ion-palette-dark on <html> for a dark theme', () => {
      service.setTheme('dark');
      TestBed.flushEffects();
      expect(document.documentElement.classList.contains('ion-palette-dark')).toBeTrue();

      service.setTheme('default');
      TestBed.flushEffects();
      expect(document.documentElement.classList.contains('ion-palette-dark')).toBeFalse();
    });

    it('creates the meta[name=theme-color] tag if absent, and updates its content', () => {
      expect(document.querySelector('meta[name="theme-color"]')).toBeNull();
      service.setTheme('sunset');
      TestBed.flushEffects();
      const meta = document.querySelector('meta[name="theme-color"]');
      expect(meta).toBeTruthy();
      expect(meta?.getAttribute('content')).toBe('#ff6f00');
    });

    it('reuses the existing meta tag on a later theme change rather than creating a second one', () => {
      service.setTheme('sunset');
      TestBed.flushEffects();
      service.setTheme('forest');
      TestBed.flushEffects();
      expect(document.querySelectorAll('meta[name="theme-color"]').length).toBe(1);
      expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#2e7d32');
    });
  });

  describe('availableThemes', () => {
    it('lists 8 themes, each with a name/label/description/icon', () => {
      service = create();
      expect(service.availableThemes.length).toBe(8);
      for (const t of service.availableThemes) {
        expect(t.name).toBeTruthy();
        expect(t.label).toBeTruthy();
        expect(t.icon).toBeTruthy();
      }
    });
  });
});
