import { OtpService } from './otp.service';

describe('OtpService', () => {
  let service: OtpService;

  beforeEach(() => {
    service = new OtpService();
  });

  it('creates', () => {
    expect(service).toBeTruthy();
  });

  describe('send()', () => {
    it('generates a 6-digit numeric code and returns it', () => {
      const code = service.send('user@example.com');
      expect(code).toMatch(/^\d{6}$/);
    });

    it('does not throw on an empty-string target', () => {
      expect(() => service.send('')).not.toThrow();
    });

    it('marks the code as not expired immediately after sending', () => {
      service.send('user@example.com');
      expect(service.isExpired).toBeFalse();
    });

    it('overwrites a previously sent code — only the newest one verifies', () => {
      const first = service.send('a@example.com');
      const second = service.send('b@example.com');
      if (first !== second) {
        expect(service.verify(first)).toBeFalse();
      }
      expect(service.verify(second)).toBeTrue();
    });
  });

  describe('verify()', () => {
    it('returns false when no code has ever been sent', () => {
      expect(service.verify('123456')).toBeFalse();
    });

    it('returns true for the exact code that was sent', () => {
      const code = service.send('user@example.com');
      expect(service.verify(code)).toBeTrue();
    });

    it('returns false for an incorrect code', () => {
      const code = service.send('user@example.com');
      const wrong = code === '000000' ? '111111' : '000000';
      expect(service.verify(wrong)).toBeFalse();
    });

    it('returns false for empty/undefined input', () => {
      service.send('user@example.com');
      expect(service.verify('')).toBeFalse();
    });

    it('trims surrounding whitespace before comparing', () => {
      const code = service.send('user@example.com');
      expect(service.verify(`  ${code}  `)).toBeTrue();
    });

    it('returns false once the code has expired (past the 5-minute TTL)', () => {
      const now = Date.now();
      const dateSpy = spyOn(Date, 'now').and.returnValue(now);
      const code = service.send('user@example.com');
      dateSpy.and.returnValue(now + 5 * 60 * 1000 + 1);
      expect(service.verify(code)).toBeFalse();
    });

    it('still accepts the code just before the TTL boundary', () => {
      const now = Date.now();
      const dateSpy = spyOn(Date, 'now').and.returnValue(now);
      const code = service.send('user@example.com');
      dateSpy.and.returnValue(now + 5 * 60 * 1000 - 1);
      expect(service.verify(code)).toBeTrue();
    });

    it('rejects a code from a previous send() after a new one was issued', () => {
      const oldCode = service.send('user@example.com');
      service.send('user@example.com');
      // Extremely small chance the RNG repeats the same code; guard against a flaky failure.
      if (oldCode !== service['currentCode']) {
        expect(service.verify(oldCode)).toBeFalse();
      }
    });
  });

  describe('isExpired', () => {
    it('is true before any code has been sent', () => {
      expect(service.isExpired).toBeTrue();
    });

    it('is false right after sending', () => {
      service.send('user@example.com');
      expect(service.isExpired).toBeFalse();
    });

    it('becomes true once the TTL elapses', () => {
      const now = Date.now();
      const dateSpy = spyOn(Date, 'now').and.returnValue(now);
      service.send('user@example.com');
      dateSpy.and.returnValue(now + 5 * 60 * 1000 + 1);
      expect(service.isExpired).toBeTrue();
    });
  });

  describe('reset()', () => {
    it('clears the current code so verify() fails afterwards', () => {
      const code = service.send('user@example.com');
      service.reset();
      expect(service.verify(code)).toBeFalse();
    });

    it('makes isExpired true again', () => {
      service.send('user@example.com');
      service.reset();
      expect(service.isExpired).toBeTrue();
    });

    it('is safe to call when nothing was ever sent (idempotent)', () => {
      expect(() => service.reset()).not.toThrow();
      expect(() => service.reset()).not.toThrow();
    });
  });
});
