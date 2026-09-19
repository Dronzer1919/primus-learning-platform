import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter, Router, ActivatedRoute, convertToParamMap } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError, Subject } from 'rxjs';
import { LoginPage } from './login.page';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../core/notification.service';
import { OtpService } from '../../services/otp.service';
import { NavHistoryService } from '../../services/nav-history.service';
import { environment } from '../../../environments/environment';
import { User } from '../../models/user.model';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: '1',
    email: 'alice@example.com',
    username: 'alice',
    role: 'user',
    createdAt: new Date(),
    ...overrides
  };
}

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  let component: LoginPage;
  let authService: jasmine.SpyObj<AuthService>;
  let notifications: jasmine.SpyObj<NotificationService>;
  let otpService: jasmine.SpyObj<OtpService>;
  let navHistory: jasmine.SpyObj<NavHistoryService>;
  let router: Router;
  let queryParams: Record<string, string>;

  beforeEach(async () => {
    queryParams = {};
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['login', 'loginWithGoogle']);
    notifications = jasmine.createSpyObj<NotificationService>('NotificationService', ['error', 'warn', 'success']);
    otpService = jasmine.createSpyObj<OtpService>('OtpService', ['send', 'verify', 'reset']);
    navHistory = jasmine.createSpyObj<NavHistoryService>('NavHistoryService', ['back']);
    notifications.error.and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: NotificationService, useValue: notifications },
        { provide: OtpService, useValue: otpService },
        { provide: NavHistoryService, useValue: navHistory },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } }
        }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    spyOn(router, 'navigate').and.resolveTo(true);

    fixture = TestBed.createComponent(LoginPage);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    delete (window as any).google;
    fixture?.destroy();
  });

  // ---------- Rendering ----------
  describe('rendering', () => {
    it('creates the component', () => {
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('prefills credentials with the demo login from environment (never hardcode real creds in tests)', () => {
      fixture.detectChanges();
      expect(component.credentials.email).toBe(environment.demoLogin.username);
      expect(component.credentials.password).toBe(environment.demoLogin.password);
    });

    it('does not render an error message initially', () => {
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.error')).toBeNull();
    });

    it('renders an error message once errorMessage is set', () => {
      fixture.detectChanges();
      component.errorMessage = 'Something went wrong';
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.error')?.textContent).toContain('Something went wrong');
    });

    it('shows the login form by default (mode = login)', () => {
      fixture.detectChanges();
      expect(component.mode).toBe('login');
    });

    it('switches to the forgot-password view when openForgot() is called', () => {
      fixture.detectChanges();
      component.openForgot();
      fixture.detectChanges();
      expect(component.mode).toBe('forgot');
      expect(component.forgotStep).toBe('email');
    });

    it('renders the back-arrow with an accessible label', () => {
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector('ion-button[aria-label="Go back"]');
      expect(btn).toBeTruthy();
    });
  });

  // ---------- UI interactions ----------
  describe('password visibility toggle', () => {
    it('starts masked and flips when toggled', () => {
      fixture.detectChanges();
      expect(component.showPassword).toBeFalse();
      component.showPassword = !component.showPassword;
      expect(component.showPassword).toBeTrue();
    });
  });

  describe('onLogin()', () => {
    beforeEach(() => fixture.detectChanges());

    it('shows an error and does not call the service when username is empty', () => {
      component.credentials.email = '';
      component.credentials.password = 'x';
      component.onLogin();
      expect(component.errorMessage).toContain('username');
      expect(authService.login).not.toHaveBeenCalled();
    });

    it('shows an error and does not call the service when password is empty', () => {
      component.credentials.email = 'user';
      component.credentials.password = '';
      component.onLogin();
      expect(authService.login).not.toHaveBeenCalled();
    });

    it('sets isLoading true while the request is in flight, then false once it resolves', () => {
      const subject = new Subject<User>();
      authService.login.and.returnValue(subject.asObservable());

      component.onLogin();
      expect(component.isLoading).toBeTrue();

      subject.next(makeUser());
      subject.complete();
      expect(component.isLoading).toBeFalse();
    });

    it('clears isLoading even when the request fails', () => {
      const subject = new Subject<User>();
      authService.login.and.returnValue(subject.asObservable());

      component.onLogin();
      expect(component.isLoading).toBeTrue();

      subject.error(new HttpErrorResponse({ status: 500 }));
      expect(component.isLoading).toBeFalse();
    });

    it('navigates to /user on success for a regular user', () => {
      authService.login.and.returnValue(of(makeUser({ role: 'user' })));
      component.onLogin();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/user');
    });

    it('navigates to /admin on success for an admin user', () => {
      authService.login.and.returnValue(of(makeUser({ role: 'admin' })));
      component.onLogin();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/admin');
    });

    it('honours a safe returnUrl over the role default', () => {
      (TestBed.inject(ActivatedRoute).snapshot as any).queryParamMap = convertToParamMap({ returnUrl: '/user/notes' });
      authService.login.and.returnValue(of(makeUser({ role: 'user' })));
      component.onLogin();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/user/notes');
    });

    it('rejects an open-redirect returnUrl (protocol-relative //) and falls back to role default', () => {
      (TestBed.inject(ActivatedRoute).snapshot as any).queryParamMap = convertToParamMap({ returnUrl: '//evil.com' });
      authService.login.and.returnValue(of(makeUser({ role: 'user' })));
      component.onLogin();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/user');
    });

    it('rejects a returnUrl not starting with / and falls back to role default', () => {
      (TestBed.inject(ActivatedRoute).snapshot as any).queryParamMap = convertToParamMap({ returnUrl: 'evil.com' });
      authService.login.and.returnValue(of(makeUser({ role: 'user' })));
      component.onLogin();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/user');
    });

    it('sets errorMessage from the API on failure and clears isLoading', () => {
      authService.login.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 400, error: { message: 'Bad creds' } }))
      );
      component.onLogin();
      expect(component.errorMessage).toBe('Bad creds');
      expect(component.isLoading).toBeFalse();
    });

    it('toasts the error for a normal failure (e.g. 400)', () => {
      authService.login.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 400, error: { message: 'Bad creds' } }))
      );
      component.onLogin();
      expect(notifications.error).toHaveBeenCalledWith('Bad creds');
    });

    it('does NOT toast twice for a 429 (interceptor already announced it)', () => {
      authService.login.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 429, error: { message: 'Too many requests' } }))
      );
      component.onLogin();
      expect(notifications.error).not.toHaveBeenCalled();
    });

    it('does NOT toast twice for an offline 0-status failure', () => {
      spyOnProperty(navigator, 'onLine').and.returnValue(false);
      authService.login.and.returnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
      component.onLogin();
      expect(notifications.error).not.toHaveBeenCalled();
    });
  });

  describe('loginAsDevAdmin()', () => {
    beforeEach(() => fixture.detectChanges());

    it('is inert when devAdminLogin is not set', () => {
      component.devAdminLogin = null;
      component.loginAsDevAdmin();
      expect(authService.login).not.toHaveBeenCalled();
    });

    it('is inert while a request is already loading', () => {
      component.devAdminLogin = { username: 'devadmin', password: 'x' };
      component.isLoading = true;
      component.loginAsDevAdmin();
      expect(authService.login).not.toHaveBeenCalled();
    });

    it('logs in with the configured dev-admin credentials and redirects to /admin', () => {
      component.devAdminLogin = { username: 'devadmin', password: 'x' };
      authService.login.and.returnValue(of(makeUser({ role: 'admin' })));
      component.loginAsDevAdmin();
      expect(authService.login).toHaveBeenCalledWith({ email: 'devadmin', password: 'x' });
      expect(router.navigateByUrl).toHaveBeenCalledWith('/admin');
    });

    it('shows a specific setup hint when the dev-admin account does not exist yet', () => {
      component.devAdminLogin = { username: 'devadmin', password: 'x' };
      authService.login.and.returnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
      component.loginAsDevAdmin();
      expect(component.errorMessage).toContain('ensure-dev-admin');
    });
  });

  describe('navigation helpers', () => {
    beforeEach(() => fixture.detectChanges());

    it('goToSignup() navigates to /signup', () => {
      component.goToSignup();
      expect(router.navigate).toHaveBeenCalledWith(['/signup']);
    });

    it('goBack() defers to backToLogin() while in forgot mode', () => {
      component.mode = 'forgot';
      spyOn(component, 'backToLogin');
      component.goBack();
      expect(component.backToLogin).toHaveBeenCalled();
      expect(navHistory.back).not.toHaveBeenCalled();
    });

    it('goBack() defers to NavHistoryService while in login mode', () => {
      component.mode = 'login';
      component.goBack();
      expect(navHistory.back).toHaveBeenCalledWith('/');
    });
  });

  // ---------- Forgot-password (OTP) flow ----------
  describe('forgot-password flow', () => {
    beforeEach(() => {
      fixture.detectChanges();
      component.openForgot();
    });

    it('rejects an invalid email', () => {
      component.forgotEmail = 'not-an-email';
      component.sendResetCode();
      expect(component.errorMessage).toContain('valid email');
      expect(otpService.send).not.toHaveBeenCalled();
    });

    it('sends a code for a valid email and advances to the otp step', () => {
      otpService.send.and.returnValue('123456');
      component.forgotEmail = 'user@example.com';
      component.sendResetCode();
      expect(otpService.send).toHaveBeenCalledWith('user@example.com');
      expect(component.demoOtp).toBe('123456');
      expect(component.forgotStep).toBe('otp');
    });

    it('onlyDigits() strips non-numeric characters and caps at 6', () => {
      component.onlyDigits({ detail: { value: 'a1b2c3d4e5f6g7' } });
      expect(component.forgotOtp).toBe('123456');
    });

    it('onlyDigits() handles an empty event value', () => {
      component.onlyDigits({ detail: { value: '' } });
      expect(component.forgotOtp).toBe('');
    });

    it('verifyResetCode() rejects a code shorter than 6 digits', () => {
      component.forgotOtp = '123';
      component.verifyResetCode();
      expect(component.errorMessage).toContain('6-digit');
      expect(otpService.verify).not.toHaveBeenCalled();
    });

    it('verifyResetCode() rejects an invalid/expired code', () => {
      otpService.verify.and.returnValue(false);
      component.forgotOtp = '111111';
      component.verifyResetCode();
      expect(component.errorMessage).toContain('Invalid or expired');
      expect(component.forgotStep).toBe('email');
    });

    it('verifyResetCode() advances to reset step on a valid code', () => {
      otpService.verify.and.returnValue(true);
      component.forgotOtp = '111111';
      component.verifyResetCode();
      expect(component.forgotStep).toBe('reset');
    });

    it('resendResetCode() requests a fresh code and clears the entered digits', () => {
      otpService.send.and.returnValue('654321');
      component.forgotOtp = '111111';
      component.resendResetCode();
      expect(otpService.send).toHaveBeenCalled();
      expect(component.forgotOtp).toBe('');
      expect(component.demoOtp).toBe('654321');
    });

    it('submitNewPassword() rejects a password shorter than 6 characters', () => {
      component.newPassword = '123';
      component.confirmNewPassword = '123';
      component.submitNewPassword();
      expect(component.errorMessage).toContain('6 characters');
    });

    it('submitNewPassword() rejects mismatched confirmation', () => {
      component.newPassword = 'abcdef';
      component.confirmNewPassword = 'abcdeg';
      component.submitNewPassword();
      expect(component.errorMessage).toContain('do not match');
    });

    it('submitNewPassword() succeeds and resets OTP state', () => {
      component.newPassword = 'abcdef';
      component.confirmNewPassword = 'abcdef';
      component.submitNewPassword();
      expect(otpService.reset).toHaveBeenCalled();
      expect(component.forgotStep).toBe('success');
    });

    it('backToLogin() returns to login mode and resets the OTP service', () => {
      component.backToLogin();
      expect(component.mode).toBe('login');
      expect(otpService.reset).toHaveBeenCalled();
    });
  });

  // ---------- Google Sign-In ----------
  describe('Google Sign-In', () => {
    it('initializes immediately when the Google script is already available', () => {
      const initialize = jasmine.createSpy('initialize');
      const renderButton = jasmine.createSpy('renderButton');
      (window as any).google = { accounts: { id: { initialize, renderButton } } };

      fixture.detectChanges(); // ngAfterViewInit -> initializeGoogle()

      expect(initialize).toHaveBeenCalled();
      const call = initialize.calls.mostRecent().args[0];
      expect(call.client_id).toBe(environment.googleClientId);
      expect(call.auto_select).toBeFalse();
    });

    it('shows the "couldn\'t load" fallback once the 10s init deadline passes without the script', fakeAsync(() => {
      let now = 1_000_000;
      spyOn(Date, 'now').and.callFake(() => now);

      fixture.detectChanges(); // starts polling for `google` every 300ms

      for (let i = 0; i < 35 && !component.googleUnavailable; i++) {
        now += 300;
        tick(300);
      }

      expect(component.googleUnavailable).toBeTrue();
    }));

    it('handles a successful Google callback by logging in and redirecting', () => {
      fixture.detectChanges();
      authService.loginWithGoogle.and.returnValue(of(makeUser({ role: 'user' })));

      (component as any).handleGoogleCallback({ credential: 'id-token' });

      expect(authService.loginWithGoogle).toHaveBeenCalledWith('id-token');
      expect(router.navigateByUrl).toHaveBeenCalledWith('/user');
    });

    it('shows an error when the Google callback has no credential', () => {
      fixture.detectChanges();
      (component as any).handleGoogleCallback({});
      expect(component.errorMessage).toContain('Google sign-in failed');
      expect(authService.loginWithGoogle).not.toHaveBeenCalled();
    });

    it('shows the API error message when Google login fails server-side', () => {
      fixture.detectChanges();
      authService.loginWithGoogle.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 401, error: { message: 'Google auth rejected' } }))
      );
      (component as any).handleGoogleCallback({ credential: 'id-token' });
      expect(component.errorMessage).toBe('Google auth rejected');
    });
  });

  // ---------- Memory leak / lifecycle ----------
  describe('ngOnDestroy()', () => {
    it('marks the component destroyed and clears any pending Google init timer', () => {
      fixture.detectChanges();
      const clearSpy = spyOn(window, 'clearTimeout').and.callThrough();
      component.ngOnDestroy();
      expect((component as any).destroyed).toBeTrue();
      // A timer was scheduled (google undefined in the test env) so clearTimeout should run.
      expect(clearSpy).toHaveBeenCalled();
    });

    it('does not throw when destroyed before any Google timer was scheduled', () => {
      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });
});
