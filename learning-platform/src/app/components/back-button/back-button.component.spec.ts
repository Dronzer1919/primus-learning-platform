import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BackButtonComponent } from './back-button.component';
import { NavHistoryService } from '../../services/nav-history.service';

describe('BackButtonComponent', () => {
  let fixture: ComponentFixture<BackButtonComponent>;
  let component: BackButtonComponent;
  let navHistory: jasmine.SpyObj<NavHistoryService>;

  beforeEach(async () => {
    navHistory = jasmine.createSpyObj<NavHistoryService>('NavHistoryService', ['back']);

    await TestBed.configureTestingModule({
      imports: [BackButtonComponent],
      providers: [{ provide: NavHistoryService, useValue: navHistory }]
    }).compileComponents();

    fixture = TestBed.createComponent(BackButtonComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture?.destroy());

  it('creates', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('rendering', () => {
    it('renders icon-only (no label span) by default', () => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('span')).toBeNull();
    });

    it('renders the label text when provided', () => {
      component.label = 'Back to notes';
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('span')?.textContent).toBe('Back to notes');
    });

    it('defaults the aria-label to "Go back"', () => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('button')?.getAttribute('aria-label')).toBe('Go back');
    });

    it('uses the label as the aria-label when one is set', () => {
      component.label = 'Back to notes';
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('button')?.getAttribute('aria-label')).toBe('Back to notes');
    });

    it('applies the always-show host class when alwaysShow is true', () => {
      component.alwaysShow = true;
      fixture.detectChanges();
      expect(fixture.nativeElement.classList.contains('always-show')).toBeTrue();
    });

    it('does not apply the always-show host class by default', () => {
      fixture.detectChanges();
      expect(fixture.nativeElement.classList.contains('always-show')).toBeFalse();
    });
  });

  describe('goBack()', () => {
    it('calls NavHistoryService.back() with the default href ("/")', () => {
      fixture.detectChanges();
      component.goBack();
      expect(navHistory.back).toHaveBeenCalledWith('/');
    });

    it('calls NavHistoryService.back() with a custom defaultHref', () => {
      component.defaultHref = '/user/home';
      fixture.detectChanges();
      component.goBack();
      expect(navHistory.back).toHaveBeenCalledWith('/user/home');
    });

    it('is triggered by clicking the button', () => {
      fixture.detectChanges();
      fixture.nativeElement.querySelector('button').click();
      expect(navHistory.back).toHaveBeenCalled();
    });
  });
});
