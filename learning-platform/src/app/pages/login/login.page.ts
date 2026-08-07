import { Component, AfterViewInit, NgZone, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { IonicModule } from '@ionic/angular';
import { friendlyMessage } from '../../interceptors/error.interceptor';
import { NotificationService } from '../../core/notification.service';
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
  @ViewChild('googleBtnContainer') googleBtnContainer?: ElementRef<HTMLDivElement>;

  // 'login' -> normal sign in, 'forgot' -> password recovery flow
  mode: 'login' | 'forgot' = 'login';

  // `email` is a legacy field name — auth.service.ts sends its value as `username`,
  // which is what the API matches on.
  //
  // Prefilled with the guest account so a first-time visitor can sign in without
  // hunting for credentials. Both fields stay editable: typing over them is how
  // you sign in as anyone else, including admin.
  credentials: LoginCredentials = {
    email: environment.demoLogin.username,
    password: environment.demoLogin.password
  };
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

  /** True once the button has actually been drawn into the container at least once. */
  private googleButtonRendered = false;
  /** True once initialize() has succeeded — lets a later return-to-login render the button. */
  private googleReady = false;
  /**
   * Set once the GSI script never showed up within the timeout — an ad blocker
   * or privacy extension blocking accounts.google.com/gsi/client is common
   * enough that this needs its own message rather than leaving a silent empty
   * box where the button should be.
   */
  googleUnavailable = false;
  private googleInitTimer?: ReturnType<typeof setTimeout>;
  private destroyed = false;

  constructor(
    private authService: AuthService,
    private notifications: NotificationService,
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
   * Renders Google's own interactive button rather than driving the passive
   * One Tap prompt: prompt() only auto-signs-in when the browser already has
   * exactly one obvious Google session, and otherwise either shows nothing
   * (Incognito, no session — the prompt has no popup fallback of its own) or a
   * small floating card. renderButton's popup, by contrast, always opens
   * Google's real "Choose an account" chooser — the same page for one account,
   * multiple accounts, or none — so the experience doesn't depend on prior
   * session state and never needs a second click to recover from a miss.
   *
   * The previous version rescheduled itself every 300ms with no exit: if the
   * GSI script is blocked — an ad blocker, a corporate proxy, or simply being
   * offline — that timer ran for as long as the tab was open, surviving even a
   * navigation away from this page since nothing cancelled it. Ten seconds is
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
            // Without this, Google can render the button in its "personalized"
            // form — "Continue as Name — email@…" with an avatar — for a
            // session it already recognizes. That copy is wider than a plain
            // "Continue with Google" button and is what was overflowing the
            // card on the right edge.
            auto_select: false
          });
          this.googleReady = true;
          this.ngZone.run(() => this.renderGoogleButton());
        } catch {
          // Third-party script failing to initialise is not this app's problem
          // to crash over — username/password sign-in is unaffected.
          this.ngZone.run(() => (this.googleUnavailable = true));
        }
        return;
      }

      if (Date.now() >= deadline) {
        // The script never showed up — most likely an ad blocker or privacy
        // extension blocking accounts.google.com/gsi/client. Say so instead of
        // leaving an empty box where the button should be; username/password
        // sign-in still works either way.
        this.ngZone.run(() => (this.googleUnavailable = true));
        return;
      }
      this.googleInitTimer = setTimeout(tryInit, 300);
    };

    tryInit();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.googleInitTimer) clearTimeout(this.googleInitTimer);
  }

  /**
   * Safe to call more than once — it's the only way to recover the button
   * after the "Forgot password?" flow. That flow swaps out the whole login
   * card (including this container) behind *ngIf, so if initialize() finishes
   * while the user is on that screen, there's nothing to render into yet; the
   * container only comes back once they return to the login form.
   */
  private renderGoogleButton(): void {
    const el = this.googleBtnContainer?.nativeElement;
    if (!el || typeof google === 'undefined' || !google?.accounts?.id) return;

    // Deferred a frame: called right as initialize() resolves, which can land
    // mid-layout (e.g. an Ionic page-transition just starting) and read the
    // container at 0 width. A fallback of Google's 400px max — the widest it
    // can go — then overflows a mobile card that's often only ~300px wide;
    // 280 is a safe width that fits comfortably even there.
    requestAnimationFrame(() => {
      google.accounts.id.renderButton(el, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: Math.max(200, Math.min(el.offsetWidth || 280, 400))
      });
      this.googleButtonRendered = true;
    });
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
        error: (error: HttpErrorResponse) => {
          this.isLoading = false;
          // Same treatment as onLogin()'s error branch: the API's own message
          // (rate limit, expired token, etc.) beats one generic string for
          // every possible failure.
          this.errorMessage = friendlyMessage(error);
          this.toastOnce(error, this.errorMessage);
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
        this.toastOnce(error, this.errorMessage);
      }
    });
  }

  /**
   * Toasts a login failure alongside the inline message, so a submit that fails
   * is noticed even when the error line is scrolled out of view.
   *
   * The interceptor's `report()` already announces two cases itself — a 429 and
   * an offline status 0. Repeating them here would stack two toasts for one
   * submit, so those are left to it.
   */
  private toastOnce(error: HttpErrorResponse, message: string): void {
    const alreadyAnnounced =
      error?.status === 429 ||
      (error?.status === 0 && typeof navigator !== 'undefined' && navigator.onLine === false);
    if (alreadyAnnounced) return;

    void this.notifications.error(message);
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

    // The login card (and the Google button container inside it) was just
    // torn down by *ngIf while on the forgot-password screen. If Google
    // finished initializing while it was hidden, the button never got drawn —
    // catch that here now that the container exists again. A no-op the rest
    // of the time (already rendered, or Google still isn't ready).
    if (this.googleReady && !this.googleButtonRendered) {
      setTimeout(() => this.renderGoogleButton());
    }
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
