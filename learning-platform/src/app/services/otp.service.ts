import { Injectable } from '@angular/core';

/**
 * Dummy OTP service for demo purposes.
 *
 * Generates a 6-digit one-time code and "sends" it. Since there is no SMS/email
 * gateway wired up, the code is returned so the UI can display it as a hint and
 * the whole flow is testable end-to-end without any external provider.
 */
@Injectable({ providedIn: 'root' })
export class OtpService {
  private currentCode: string | null = null;
  private target: string | null = null;
  private expiresAt = 0;

  /** How long a generated code stays valid (5 minutes). */
  private readonly ttlMs = 5 * 60 * 1000;

  /**
   * Generate + "send" a code to the given target (email or phone).
   * Returns the code so the demo UI can reveal it.
   */
  send(target: string): string {
    this.currentCode = Math.floor(100000 + Math.random() * 900000).toString();
    this.target = target;
    this.expiresAt = Date.now() + this.ttlMs;
    return this.currentCode;
  }

  /** Validate an entered code against the last one sent. */
  verify(code: string): boolean {
    if (!this.currentCode) return false;
    if (Date.now() > this.expiresAt) return false;
    return code.trim() === this.currentCode;
  }

  get isExpired(): boolean {
    return !this.currentCode || Date.now() > this.expiresAt;
  }

  reset(): void {
    this.currentCode = null;
    this.target = null;
    this.expiresAt = 0;
  }
}
