import { ComponentFixture, TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { SignupPage } from './signup.page';
import { AuthService } from '../../services/auth.service';
import { OtpService } from '../../services/otp.service';
import { User } from '../../models/user.model';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: '1',
    email: 'jane@example.com',
    username: 'jane123',
    role: 'user',
    createdAt: new Date(),
    ...overrides
  };
}

describe('SignupPage', () => {
  let fixture: ComponentFixture<SignupPage>;
  let component: SignupPage;
  let authService: jasmine.SpyObj<AuthService>;
  let otpService: jasmine.SpyObj<OtpService>;
  let router: Router;

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['signup']);
    otpService = jasmine.createSpyObj<OtpService>('OtpService', ['send', 'verify', 'reset']);

    await TestBed.configureTestingModule({
      imports: [SignupPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: OtpService, useValue: otpService }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);

    fixture = TestBed.createComponent(SignupPage);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    // SignupPage has no ngOnDestroy of its own, so fixture.destroy() will NOT clear
    // a running cooldownTimer — see the dedicated "memory leak" test below. Clearing
    // it here directly is test-suite hygiene, not a stand-in for that missing hook.
    (component as any)?.cooldownTimer && clearInterval((component as any).cooldownTimer);
    fixture?.destroy();
  });

  function fillValidDetails(): void {
    component.form.name = 'Jane Doe';
    component.form.email = 'jane@example.com';
    component.form.phone = '';
    component.form.password = 'secret1';
    component.form.confirmPassword = 'secret1';
  }

  // ---------- Rendering ----------
  describe('rendering', () => {
    it('creates the component', () => {
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('starts on the details step', () => {
      fixture.detectChanges();
      expect(component.step).toBe('details');
    });

    it('renders the details form fields', () => {
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('input[name="name"]')).toBeTruthy();
      expect(el.querySelector('input[name="email"]')).toBeTruthy();
      expect(el.querySelector('input[name="password"]')).toBeTruthy();
      expect(el.querySelector('input[name="confirmPassword"]')).toBeTruthy();
    });

    it('does not render an error message initially', () => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.error')).toBeNull();
    });

    it('shows the progress steps until the flow is done', () => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.steps')).toBeTruthy();
      component.step = 'done';
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.steps')).toBeNull();
    });
  });

  // ---------- Step 1: details validation ----------
  describe('onSubmitDetails() validation', () => {
    beforeEach(() => fixture.detectChanges());

    it('rejects an empty name', () => {
      fillValidDetails();
      component.form.name = '   ';
      component.onSubmitDetails();
      expect(component.errorMessage).toContain('full name');
      expect(component.step).toBe('details');
    });

    it('rejects an invalid email', () => {
      fillValidDetails();
      component.form.email = 'not-an-email';
      component.onSubmitDetails();
      expect(component.errorMessage).toContain('valid email');
    });

    it('rejects a malformed phone number when one is provided', () => {
      fillValidDetails();
      component.form.phone = 'abc';
      component.onSubmitDetails();
      expect(component.errorMessage).toContain('valid phone');
    });

    it('allows an empty phone number (optional field)', () => {
      fillValidDetails();
      component.form.phone = '';
      otpService.send.and.returnValue('123456');
      component.onSubmitDetails();
      expect(component.errorMessage).toBe('');
    });

    it('rejects a password shorter than 6 characters', () => {
      fillValidDetails();
      component.form.password = '123';
      component.form.confirmPassword = '123';
      component.onSubmitDetails();
      expect(component.errorMessage).toContain('6 characters');
    });

    it('rejects mismatched password confirmation', () => {
      fillValidDetails();
      component.form.confirmPassword = 'different';
      component.onSubmitDetails();
      expect(component.errorMessage).toContain('do not match');
    });

    it('sends an OTP and advances to the otp step on valid details', () => {
      fillValidDetails();
      otpService.send.and.returnValue('654321');
      component.onSubmitDetails();
      expect(otpService.send).toHaveBeenCalledWith('jane@example.com');
      expect(component.demoOtp).toBe('654321');
      expect(component.step).toBe('otp');
    });

    it('sends the OTP to the phone number when one was provided, preferring it over email', () => {
      fillValidDetails();
      component.form.phone = '+1 555 123 4567';
      otpService.send.and.returnValue('654321');
      component.onSubmitDetails();
      expect(otpService.send).toHaveBeenCalledWith('+1 555 123 4567');
    });

    it('starts a 30s resend cooldown after sending', fakeAsync(() => {
      fillValidDetails();
      otpService.send.and.returnValue('654321');
      component.onSubmitDetails();
      expect(component.resendCooldown).toBe(30);
      discardPeriodicTasks();
    }));
  });

  // ---------- Resend / cooldown ----------
  // The countdown is driven by a real setInterval (see startCooldown()). fakeAsync only
  // virtualizes timers created *inside* its own zone, so every test here that needs tick()
  // to actually advance the countdown starts that interval from within the fakeAsync callback
  // itself — starting it in a plain (non-fakeAsync) beforeEach would leave a real timer running
  // that tick() cannot see, silently no-op'ing the assertions below.
  describe('resendOtp() / cooldown', () => {
    beforeEach(() => fixture.detectChanges());

    afterEach(() => {
      // Belt-and-braces: ensure no leaked interval survives into the next test.
      (component as any).cooldownTimer && clearInterval((component as any).cooldownTimer);
    });

    it('is a no-op while the cooldown is still active', () => {
      fillValidDetails();
      otpService.send.and.returnValue('111111');
      component.onSubmitDetails();
      otpService.send.calls.reset();

      component.resendOtp();

      expect(otpService.send).not.toHaveBeenCalled();
    });

    it('counts down to zero and stops once 30 seconds of fake time elapse', fakeAsync(() => {
      (component as any).startCooldown(30);
      expect(component.resendCooldown).toBe(30);

      tick(30_000);

      expect(component.resendCooldown).toBeLessThanOrEqual(0);
      discardPeriodicTasks();
    }));

    it('allows resend and sends a fresh code once the cooldown has fully elapsed', fakeAsync(() => {
      fillValidDetails();
      otpService.send.and.returnValue('111111');
      component.onSubmitDetails(); // starts the interval inside this fakeAsync zone
      otpService.send.calls.reset();

      tick(30_000);

      otpService.send.and.returnValue('222222');
      component.resendOtp();

      expect(otpService.send).toHaveBeenCalledTimes(1);
      expect(component.demoOtp).toBe('222222');
      discardPeriodicTasks();
    }));
  });

  describe('onlyDigits()', () => {
    beforeEach(() => fixture.detectChanges());

    it('strips non-numeric characters and caps at 6 digits', () => {
      component.onlyDigits({ detail: { value: 'a1-b2 c3d4e5f6g7' } });
      expect(component.otpCode).toBe('123456');
    });

    it('handles a missing event value gracefully', () => {
      component.onlyDigits({ detail: {} });
      expect(component.otpCode).toBe('');
    });
  });

  // ---------- Step 2: OTP verification + signup ----------
  describe('verifyOtp()', () => {
    beforeEach(() => {
      fixture.detectChanges();
      fillValidDetails();
      otpService.send.and.returnValue('111111');
      component.onSubmitDetails();
    });

    it('rejects a code shorter than 6 digits without calling the service', () => {
      component.otpCode = '123';
      component.verifyOtp();
      expect(component.errorMessage).toContain('6-digit');
      expect(otpService.verify).not.toHaveBeenCalled();
    });

    it('rejects an invalid/expired code', () => {
      otpService.verify.and.returnValue(false);
      component.otpCode = '999999';
      component.verifyOtp();
      expect(component.errorMessage).toContain('Invalid or expired');
      expect(authService.signup).not.toHaveBeenCalled();
    });

    it('creates the account with a generated username derived from the email', () => {
      otpService.verify.and.returnValue(true);
      authService.signup.and.returnValue(of(makeUser()));
      component.otpCode = '111111';

      component.verifyOtp();

      const payload = authService.signup.calls.mostRecent().args[0];
      expect(payload.email).toBe('jane@example.com');
      expect(payload.username.startsWith('jane')).toBeTrue();
      expect(payload.displayName).toBe('Jane Doe');
    });

    it('sets isLoading true while the signup request is pending', () => {
      otpService.verify.and.returnValue(true);
      const subject = new Subject<User>();
      authService.signup.and.returnValue(subject.asObservable());
      component.otpCode = '111111';

      component.verifyOtp();
      expect(component.isLoading).toBeTrue();

      subject.next(makeUser());
      subject.complete();
      expect(component.isLoading).toBeFalse();
    });

    it('advances to the done step and resets OTP state on success', () => {
      otpService.verify.and.returnValue(true);
      authService.signup.and.returnValue(of(makeUser()));
      component.otpCode = '111111';

      component.verifyOtp();

      expect(component.step).toBe('done');
      expect(otpService.reset).toHaveBeenCalled();
    });

    it('shows the API error message and stays on the otp step on failure', () => {
      otpService.verify.and.returnValue(true);
      authService.signup.and.returnValue(
        throwError(() => ({ error: { message: 'Email already registered' } }))
      );
      component.otpCode = '111111';

      component.verifyOtp();

      expect(component.errorMessage).toBe('Email already registered');
      expect(component.step).toBe('otp');
      expect(component.isLoading).toBeFalse();
    });

    it('falls back to a generic message when the API gives none', () => {
      otpService.verify.and.returnValue(true);
      authService.signup.and.returnValue(throwError(() => ({})));
      component.otpCode = '111111';

      component.verifyOtp();

      expect(component.errorMessage).toBe('Signup failed. Please try again.');
    });
  });

  describe('editDetails()', () => {
    it('returns to the details step and clears any error', () => {
      fixture.detectChanges();
      component.step = 'otp';
      component.errorMessage = 'stale error';
      component.editDetails();
      expect(component.step).toBe('details');
      expect(component.errorMessage).toBe('');
    });
  });

  describe('navigation', () => {
    beforeEach(() => fixture.detectChanges());

    it('goToApp() navigates to /user', () => {
      component.goToApp();
      expect(router.navigate).toHaveBeenCalledWith(['/user']);
    });

    it('goToLogin() navigates to /login', () => {
      component.goToLogin();
      expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });
  });

  // ---------- Enterprise: memory-leak check ----------
  // KNOWN GAP (flagged, not silently fixed here): SignupPage starts a real setInterval
  // in startCooldown() but implements no ngOnDestroy to clear it. If a user opens Signup,
  // reaches the OTP step (starting the interval), and navigates away before it finishes,
  // the interval keeps firing against a destroyed component until it naturally counts out.
  // This test documents the current (leaky) behavior; flip it once ngOnDestroy is added.
  describe('lifecycle / memory leak', () => {
    it('KNOWN GAP — cooldownTimer keeps running after the component is destroyed (no ngOnDestroy)', fakeAsync(() => {
      fixture.detectChanges();
      fillValidDetails();
      otpService.send.and.returnValue('111111');
      component.onSubmitDetails();
      expect(component.resendCooldown).toBe(30);

      fixture.destroy(); // simulates navigating away mid-cooldown

      tick(1000);
      // If ngOnDestroy existed and cleared the interval, this decrement would not happen
      // on a destroyed component. Today it still does — that is the gap.
      expect(component.resendCooldown).toBe(29);

      clearInterval((component as any).cooldownTimer); // manual cleanup so the test suite doesn't leak
      discardPeriodicTasks();
    }));
  });
});
