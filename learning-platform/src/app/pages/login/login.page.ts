import { Component, AfterViewInit, NgZone, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
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
export class LoginPage implements AfterViewInit {
  @ViewChild('googleBtnContainer', { static: false }) googleBtnContainer!: ElementRef;

  // 'login' -> normal sign in, 'forgot' -> password recovery flow
  mode: 'login' | 'forgot' = 'login';

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

  constructor(
    private authService: AuthService,
    private otpService: OtpService,
    private router: Router,
    private ngZone: NgZone
  ) {}

  ngAfterViewInit(): void {
    if (!this.googleConfigured) return;
    this.renderGoogleButton();
  }

  private renderGoogleButton(): void {
    const tryRender = () => {
      if (typeof google !== 'undefined' && google?.accounts?.id && this.googleBtnContainer?.nativeElement) {
        google.accounts.id.initialize({
          client_id: environment.googleClientId,
          callback: (response: any) => this.handleGoogleCallback(response)
        });
        google.accounts.id.renderButton(this.googleBtnContainer.nativeElement, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          width: this.googleBtnContainer.nativeElement.offsetWidth || 340
        });
      } else {
        setTimeout(tryRender, 300);
      }
    };
    tryRender();
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
          this.router.navigate([user.role === 'admin' ? '/admin' : '/user']);
        },
        error: () => {
          this.isLoading = false;
          this.errorMessage = 'Google login failed. Please try again.';
        }
      });
    });
  }

  fillCredentials(username: string, password: string): void {
    this.credentials.email = username;
    this.credentials.password = password;
    this.errorMessage = '';
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
        this.router.navigate([user.role === 'admin' ? '/admin' : '/user']);
      },
      error: () => {
        this.isLoading = false;
        this.errorMessage = 'Login failed. Please check your credentials.';
      }
    });
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
