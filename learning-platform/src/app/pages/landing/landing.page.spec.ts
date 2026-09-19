import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { BehaviorSubject } from 'rxjs';
import { LandingPage } from './landing.page';
import { AuthService } from '../../services/auth.service';
import { NavHistoryService } from '../../services/nav-history.service';
import { CodeExecutionService } from '../../services/code-execution.service';

describe('LandingPage', () => {
  let fixture: ComponentFixture<LandingPage>;
  let component: LandingPage;
  let authService: jasmine.SpyObj<AuthService>;
  let navHistory: jasmine.SpyObj<NavHistoryService>;
  let isLoggedInSubject: BehaviorSubject<boolean>;

  beforeEach(async () => {
    isLoggedInSubject = new BehaviorSubject<boolean>(false);
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['isAuthenticated'], {
      isLoggedIn$: isLoggedInSubject.asObservable()
    });
    navHistory = jasmine.createSpyObj<NavHistoryService>('NavHistoryService', ['back']);

    const codeExecutionSpy = jasmine.createSpyObj<CodeExecutionService>('CodeExecutionService', [
      'runInPage', 'getPendingTimerCount', 'stopCapture', 'buildWebMarkup', 'transpileTypeScript', 'runPython'
    ]);
    codeExecutionSpy.getPendingTimerCount.and.returnValue(0);
    const toastControllerSpy = jasmine.createSpyObj<ToastController>('ToastController', ['create']);
    toastControllerSpy.create.and.resolveTo({ present: jasmine.createSpy().and.resolveTo() } as any);

    spyOn(window, 'matchMedia').and.returnValue({
      matches: false, media: '', addEventListener: () => {}, removeEventListener: () => {}
    } as unknown as MediaQueryList);

    await TestBed.configureTestingModule({
      imports: [LandingPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: NavHistoryService, useValue: navHistory },
        { provide: CodeExecutionService, useValue: codeExecutionSpy },
        { provide: ToastController, useValue: toastControllerSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LandingPage);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture?.destroy());

  it('creates', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('exposes authService publicly for the header\'s signed-in/out template binding', () => {
    fixture.detectChanges();
    expect(component.authService).toBe(authService);
  });

  describe('goBack()', () => {
    it('defers to NavHistoryService with the root as fallback', () => {
      fixture.detectChanges();
      component.goBack();
      expect(navHistory.back).toHaveBeenCalledWith('/');
    });
  });
});
