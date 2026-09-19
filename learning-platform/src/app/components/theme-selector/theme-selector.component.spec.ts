import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ThemeSelectorComponent } from './theme-selector.component';
import { ThemeService, Theme } from '../../services/theme.service';

describe('ThemeSelectorComponent', () => {
  let fixture: ComponentFixture<ThemeSelectorComponent>;
  let component: ThemeSelectorComponent;
  let themeService: jasmine.SpyObj<ThemeService>;

  beforeEach(async () => {
    themeService = jasmine.createSpyObj<ThemeService>('ThemeService', ['setTheme', 'getCurrentTheme'], {
      availableThemes: [
        { name: 'default', label: 'Default Light', description: '', icon: 'sunny-outline' },
        { name: 'dark', label: 'Dark Mode', description: '', icon: 'moon-outline' }
      ] as any
    });
    themeService.getCurrentTheme.and.returnValue('default');

    await TestBed.configureTestingModule({
      imports: [ThemeSelectorComponent],
      providers: [{ provide: ThemeService, useValue: themeService }]
    }).compileComponents();

    fixture = TestBed.createComponent(ThemeSelectorComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture?.destroy());

  it('creates', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('starts with the popover closed', () => {
    fixture.detectChanges();
    expect(component.isOpen).toBeFalse();
  });

  describe('presentPopover()', () => {
    it('opens the popover and records the triggering event', () => {
      fixture.detectChanges();
      const event = new Event('click');
      component.presentPopover(event);
      expect(component.isOpen).toBeTrue();
      expect(component.event).toBe(event);
    });
  });

  describe('selectTheme()', () => {
    it('applies the chosen theme via ThemeService', () => {
      fixture.detectChanges();
      component.selectTheme('ocean' as Theme);
      expect(themeService.setTheme).toHaveBeenCalledWith('ocean');
    });

    it('closes the popover after selecting', () => {
      fixture.detectChanges();
      component.presentPopover(new Event('click'));
      component.selectTheme('dark' as Theme);
      expect(component.isOpen).toBeFalse();
    });
  });

  describe('isCurrentTheme()', () => {
    it('reflects the service\'s current theme', () => {
      fixture.detectChanges();
      themeService.getCurrentTheme.and.returnValue('dark');
      expect(component.isCurrentTheme('dark' as Theme)).toBeTrue();
      expect(component.isCurrentTheme('default' as Theme)).toBeFalse();
    });
  });
});
