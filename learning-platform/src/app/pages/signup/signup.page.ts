import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { OtpService } from '../../services/otp.service';
import { SignupData } from '../../models/user.model';
import { ThemeSelectorComponent } from '../../components/theme-selector/theme-selector.component';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.page.html',
  styleUrls: ['./signup.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, ThemeSelectorComponent]
})
export class SignupPage {
  // 'details' -> fill in the form, 'otp' -> verify code, 'done' -> success screen
  step: 'details' | 'otp' | 'done' = 'details';

  form = {
    name: '',
    phone: '',
    email: '',
    country: '',
    city: '',
    address: '',
    password: '',
    confirmPassword: ''
  };

  otpCode = '';
  demoOtp = '';          // revealed in the UI since there is no real SMS/email gateway
  resendCooldown = 0;    // seconds remaining before "Resend" is allowed again
  private cooldownTimer: any = null;

  showPassword = false;
  showConfirm = false;
  isLoading = false;
  errorMessage = '';

  constructor(
    private authService: AuthService,
    private otpService: OtpService,
    private router: Router
  ) {}

  private emailValid(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /** Step 1 -> validate the form, then generate + "send" the dummy OTP. */
  onSubmitDetails(): void {
    this.errorMessage = '';

    if (!this.form.name.trim()) {
      this.errorMessage = 'Please enter your full name';
      return;
    }
    if (!this.emailValid(this.form.email)) {
      this.errorMessage = 'Please enter a valid email address';
      return;
    }
    if (this.form.phone && !/^[0-9+\-\s()]{7,}$/.test(this.form.phone)) {
      this.errorMessage = 'Please enter a valid phone number';
      return;
    }
    if (this.form.password.length < 6) {
      this.errorMessage = 'Password must be at least 6 characters';
      return;
    }
    if (this.form.password !== this.form.confirmPassword) {
      this.errorMessage = 'Passwords do not match';
      return;
    }

    this.sendOtp();
    this.step = 'otp';
  }

  private sendOtp(): void {
    const target = this.form.phone || this.form.email;
    this.demoOtp = this.otpService.send(target);
    this.otpCode = '';
    this.startCooldown(30);
  }

  resendOtp(): void {
    if (this.resendCooldown > 0) return;
    this.sendOtp();
  }

  private startCooldown(seconds: number): void {
    this.resendCooldown = seconds;
    clearInterval(this.cooldownTimer);
    this.cooldownTimer = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0) clearInterval(this.cooldownTimer);
    }, 1000);
  }

  onlyDigits(event: any): void {
    this.otpCode = (event.detail.value || '').replace(/\D/g, '').slice(0, 6);
  }

  /** Step 2 -> verify OTP, then create the account. */
  verifyOtp(): void {
    this.errorMessage = '';
    if (this.otpCode.length !== 6) {
      this.errorMessage = 'Enter the 6-digit code';
      return;
    }
    if (!this.otpService.verify(this.otpCode)) {
      this.errorMessage = 'Invalid or expired code. Please try again.';
      return;
    }

    this.isLoading = true;
    const username = this.form.email.split('@')[0] + Math.floor(Math.random() * 1000);
    const payload: SignupData = {
      email: this.form.email.trim(),
      username,
      password: this.form.password,
      displayName: this.form.name.trim(),
      phone: this.form.phone.trim() || undefined,
      country: this.form.country.trim() || undefined,
      city: this.form.city.trim() || undefined,
      address: this.form.address.trim() || undefined
    };

    this.authService.signup(payload).subscribe({
      next: () => {
        this.isLoading = false;
        this.otpService.reset();
        clearInterval(this.cooldownTimer);
        this.step = 'done';
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.error?.message || 'Signup failed. Please try again.';
      }
    });
  }

  editDetails(): void {
    this.errorMessage = '';
    this.step = 'details';
  }

  goToApp(): void {
    this.router.navigate(['/user']);
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
