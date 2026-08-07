import { Component, AfterViewInit, NgZone, OnDestroy } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { IonicModule } from '@ionic/angular';
import { friendlyMessage } from '../../interceptors/error.interceptor';
import { AuthService } from '../../services/auth.service';
import { OtpService } from '../../services/otp.service';
import { LoginCredentials } from '../../models/user.model';
import { ThemeSelectorComponent } from '../../components/theme-selector/theme-selector.component';
import { environment } from '../../../environments/environment';

declare const google: any;

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, ThemeSelectorComponent]
})
export class LoginPage implements AfterViewInit, OnDestroy {
  // 'login' -> normal sign in, 'forgot' -> password recovery flow
  mode: 'login' | 'forgot' = 'login';

  // `email` is a legacy field name — auth.service.ts sends its value as `username`,
  // which is what the API matches on.
  credentials: LoginCredentials = { email: '', password: '' };
  showPassword = false;

  // Forgot-password flow state
  forgotStep: 'email' | 'otp' | 'reset' | 'success' = 'email';
  forgotEmail = '';
  forgotOtp = '';
  demoOtp = '';
  newPassword = '';
  confirmNewPassword = '';
  showNewPassword = false;

  isLoading = false;
  errorMessage = '';
  googleConfigured = environment.googleClientId !== 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

  /** Set once Google's client has initialised; until then the button does nothing. */
  private googleReady = false;
  private googleInitTimer?: ReturnType<typeof setTimeout>;
  private destroyed = false;

  constructor(
    private authService: AuthService,
    private otpService: OtpService,
    private router: Router,
    private route: ActivatedRoute,
    private ngZone: NgZone,
    private location: Location
  ) {}

  // Back arrow: leave the forgot-password flow first, otherwise go to the previous page.
  goBack(): void {
    if (this.mode === 'forgot') {
      this.backToLogin();
      return;
    }
    this.location.back();
  }


  ngAfterViewInit(): void {
    if (!this.googleConfigured) return;
    this.initializeGoogle();
  }

  /**
   * Waits for Google's script to appear, but not forever.
   *
   * The previous version rescheduled itself every 300ms with no exit: if the
   * GSI script is blocked — an ad blocker, a corporate proxy, or simply being
   * offline — that timer runs for as long as the tab is open, and it survives
   * navigating away from this page because nothing cancels it. Ten seconds is
   * far longer than the script needs and short enough to give up cleanly.
   */
  private initializeGoogle(): void {
    const deadline = Date.now() + 10000;

    const tryInit = () => {
      if (this.destroyed) return;

      if (typeof google !== 'undefined' && google?.accounts?.id) {
        try {
          google.accounts.id.initialize({
            client_id: environment.googleClientId,
            callback: (response: any) => this.handleGoogleCallback(response),
            use_fedcm_for_prompt: false,
            auto_select: false,
            cancel_on_tap_outside: true
          });
          this.googleReady = true;
        } catch {
          // Third-party script failing to initialise is not this app's problem
          // to crash over — username/password sign-in is unaffected.
          this.googleReady = false;
        }
        return;
      }

      if (Date.now() >= deadline) return;
      this.googleInitTimer = setTimeout(tryInit, 300);
    };

    tryInit();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.googleInitTimer) clearTimeout(this.googleInitTimer);
  }

  triggerGoogleLogin(): void {
    // Only after initialize() has run: prompt() on an uninitialised client
    // throws, and that throw would surface as an app error for what is really
    // just a third-party script that has not loaded.
    if (!this.googleReady) {
      this.errorMessage = 'Google sign-in is still loading. Please try again in a moment.';
      return;
    }
    try {
      google.accounts.id.prompt();
    } catch {
      this.errorMessage = 'Google sign-in is unavailable right now. Use your username and password.';
    }
  }

  private handleGoogleCallback(response: any): void {
    this.ngZone.run(() => {
      if (!response?.credential) {
        this.errorMessage = 'Google sign-in failed. Please try again.';
        return;
      }
      this.isLoading = true;
      this.errorMessage = '';
      this.authService.loginWithGoogle(response.credential).subscribe({
        next: (user) => {
          this.isLoading = false;
          this.goAfterLogin(user.role === 'admin' ? '/admin' : '/user');
        },
        error: () => {
          this.isLoading = false;
          this.errorMessage = 'Google login failed. Please try again.';
        }
      });
    });
  }

  onLogin(): void {
    if (!this.credentials.email || !this.credentials.password) {
      this.errorMessage = 'Please enter username and password';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.login(this.credentials).subscribe({
      next: (user) => {
        this.isLoading = false;
        this.goAfterLogin(user.role === 'admin' ? '/admin' : '/user');
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;
        // Defer to the API's own message. errorHandler.js already decides what is
        // safe to surface per status, so a 423 lockout ("try again in N minutes"),
        // a 429 IP block and a 400 validation failure each read as themselves
        // rather than all collapsing into "check your credentials" — which sends
        // people round a retry loop that can only make a block worse.
        this.errorMessage = friendlyMessage(error);
      }
    });
  }

  /**
   * Honours the ?returnUrl= the guards attach, falling back to the role's home.
   *
   * Only same-app paths are accepted. A returnUrl is attacker-controllable —
   * it arrives in a link anyone can send — so forwarding to it unchecked turns
   * this page into an open redirect: a convincing primuscodex.com/login link
   * that lands the user on someone else's copy of it after signing in.
   */
  private goAfterLogin(fallback: string): void {
    const requested = this.route.snapshot.queryParamMap.get('returnUrl');
    const safe = requested && requested.startsWith('/') && !requested.startsWith('//');
    void this.router.navigateByUrl(safe ? requested : fallback);
  }

  goToSignup(): void {
    this.router.navigate(['/signup']);
  }

  // ---------- Forgot password (dummy OTP) ----------
  openForgot(): void {
    this.mode = 'forgot';
    this.forgotStep = 'email';
    this.forgotEmail = this.credentials.email || '';
    this.forgotOtp = '';
    this.newPassword = '';
    this.confirmNewPassword = '';
    this.errorMessage = '';
  }

  backToLogin(): void {
    this.mode = 'login';
    this.errorMessage = '';
    this.otpService.reset();
  }

  private emailValid(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  sendResetCode(): void {
    this.errorMessage = '';
    if (!this.emailValid(this.forgotEmail)) {
      this.errorMessage = 'Please enter a valid email address';
      return;
    }
    this.demoOtp = this.otpService.send(this.forgotEmail);
    this.forgotOtp = '';
    this.forgotStep = 'otp';
  }

  onlyDigits(event: any): void {
    this.forgotOtp = (event.detail.value || '').replace(/\D/g, '').slice(0, 6);
  }

  verifyResetCode(): void {
    this.errorMessage = '';
    if (this.forgotOtp.length !== 6) {
      this.errorMessage = 'Enter the 6-digit code';
      return;
    }
    if (!this.otpService.verify(this.forgotOtp)) {
      this.errorMessage = 'Invalid or expired code. Please try again.';
      return;
    }
    this.forgotStep = 'reset';
  }

  resendResetCode(): void {
    this.demoOtp = this.otpService.send(this.forgotEmail);
    this.forgotOtp = '';
    this.errorMessage = '';
  }

  submitNewPassword(): void {
    this.errorMessage = '';
    if (this.newPassword.length < 6) {
      this.errorMessage = 'Password must be at least 6 characters';
      return;
    }
    if (this.newPassword !== this.confirmNewPassword) {
      this.errorMessage = 'Passwords do not match';
      return;
    }
    // No backend reset endpoint in this demo — the code has been verified,
    // so we surface a success screen. Wire this to a real API when available.
    this.otpService.reset();
    this.forgotStep = 'success';
  }
}
