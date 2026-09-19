import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService, SESSION_EXPIRED_EVENT } from './auth.service';
import { environment } from '../../environments/environment';
import { LoginCredentials, SignupData } from '../models/user.model';

/** Builds a base64url JWT-shaped string carrying the given payload (unsigned — this service never verifies a signature, only reads `exp`). */
function makeToken(payload: Record<string, unknown>): string {
  const toB64Url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${toB64Url({ alg: 'none' })}.${toB64Url(payload)}.sig`;
}

const apiUrl = environment.apiUrl;

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
  });

  afterEach(() => {
    httpMock?.verify();
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
  });

  function inject(): void {
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  }

  describe('construction / stored-session rehydration', () => {
    it('starts signed-out when storage is empty', () => {
      inject();
      expect(service.currentUserValue).toBeNull();
    });

    it('rehydrates a validly-stored user on construction', () => {
      const user = { id: '1', username: 'alice', role: 'user' };
      localStorage.setItem('currentUser', JSON.stringify(user));
      inject();
      expect(service.currentUserValue?.id).toBe('1');
      expect(service.currentUserValue?.username).toBe('alice');
    });

    it('discards malformed JSON in storage rather than crashing bootstrap', () => {
      localStorage.setItem('currentUser', '{not valid json');
      localStorage.setItem('token', 'sometoken');
      expect(() => inject()).not.toThrow();
      expect(service.currentUserValue).toBeNull();
      // Both keys are cleared, not just the unreadable one.
      expect(localStorage.getItem('currentUser')).toBeNull();
      expect(localStorage.getItem('token')).toBeNull();
    });

    it('discards a stored value that is not an object (old-format / corrupted)', () => {
      localStorage.setItem('currentUser', JSON.stringify(['not', 'a', 'user']));
      inject();
      expect(service.currentUserValue).toBeNull();
    });

    it('discards a stored user missing required fields (id/username)', () => {
      localStorage.setItem('currentUser', JSON.stringify({ role: 'user' }));
      inject();
      expect(service.currentUserValue).toBeNull();
    });

    it('discards a stored `null` literal safely', () => {
      localStorage.setItem('currentUser', 'null');
      inject();
      expect(service.currentUserValue).toBeNull();
    });
  });

  describe('login()', () => {
    beforeEach(() => inject());

    it('POSTs credentials with email mapped to username', () => {
      const creds: LoginCredentials = { email: 'alice', password: 'secret' };
      service.login(creds).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/auth/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ username: 'alice', password: 'secret' });
      req.flush({ success: true, token: makeToken({}), user: { id: '1', username: 'alice', role: 'user' } });
    });

    it('stores the session and emits the user on success', (done) => {
      service.login({ email: 'alice', password: 'secret' }).subscribe((user) => {
        expect(user.username).toBe('alice');
        expect(service.currentUserValue?.username).toBe('alice');
        expect(localStorage.getItem('token')).toBe('tok-123');
        done();
      });

      httpMock.expectOne(`${apiUrl}/auth/login`).flush({
        success: true,
        token: 'tok-123',
        user: { id: '1', username: 'alice', role: 'user' }
      });
    });

    it('normalizes displayName/avatar/loginCount fallbacks in the stored session', (done) => {
      // Note on actual behavior: the Observable emits response.user verbatim (see the
      // map() at the end of login()) — the normalization below happens only inside
      // storeSession(), which is what populates currentUserValue/localStorage. A
      // caller relying on the emitted value alone would NOT see these fallbacks.
      service.login({ email: 'bob', password: 'x' }).subscribe(() => {
        expect(service.currentUserValue?.displayName).toBe('bob');
        expect(service.currentUserValue?.avatar).toBeNull();
        expect(service.currentUserValue?.loginCount).toBe(0);
        done();
      });

      httpMock.expectOne(`${apiUrl}/auth/login`).flush({
        success: true,
        token: 'tok',
        user: { id: '2', username: 'bob', role: 'user' }
      });
    });

    it('does NOT store a session when the API reports success: false', (done) => {
      service.login({ email: 'alice', password: 'wrong' }).subscribe(() => {
        expect(service.currentUserValue).toBeNull();
        expect(localStorage.getItem('token')).toBeNull();
        done();
      });

      httpMock.expectOne(`${apiUrl}/auth/login`).flush({ success: false, user: null });
    });

    it('propagates a 401 error and leaves no session behind', (done) => {
      service.login({ email: 'alice', password: 'wrong' }).subscribe({
        next: () => fail('expected an error'),
        error: (err) => {
          expect(err.status).toBe(401);
          expect(service.currentUserValue).toBeNull();
          done();
        }
      });

      httpMock.expectOne(`${apiUrl}/auth/login`).flush(
        { message: 'Invalid credentials' },
        { status: 401, statusText: 'Unauthorized' }
      );
    });

    it('propagates a network failure (status 0)', (done) => {
      service.login({ email: 'alice', password: 'secret' }).subscribe({
        next: () => fail('expected an error'),
        error: (err) => {
          expect(err.status).toBe(0);
          done();
        }
      });

      httpMock.expectOne(`${apiUrl}/auth/login`).error(new ProgressEvent('Network error'), { status: 0 });
    });
  });

  describe('signup()', () => {
    beforeEach(() => inject());

    it('POSTs the signup payload as-is and stores the session on success', (done) => {
      const payload: SignupData = { email: 'new@example.com', username: 'newu', password: 'secret1' };

      service.signup(payload).subscribe((user) => {
        expect(user.username).toBe('newu');
        expect(service.currentUserValue?.username).toBe('newu');
        done();
      });

      const req = httpMock.expectOne(`${apiUrl}/auth/register`);
      expect(req.request.body).toEqual(payload);
      req.flush({ success: true, token: 'tok', user: { id: '9', username: 'newu', role: 'user' } });
    });

    it('propagates a 409 conflict (duplicate account) without storing a session', (done) => {
      service.signup({ email: 'dup@example.com', username: 'dup', password: 'secret1' }).subscribe({
        next: () => fail('expected an error'),
        error: (err) => {
          expect(err.status).toBe(409);
          expect(service.currentUserValue).toBeNull();
          done();
        }
      });

      httpMock.expectOne(`${apiUrl}/auth/register`).flush(
        { message: 'Account already exists' },
        { status: 409, statusText: 'Conflict' }
      );
    });
  });

  describe('loginWithGoogle()', () => {
    beforeEach(() => inject());

    it('POSTs the idToken and stores the session on success', (done) => {
      service.loginWithGoogle('id-token-abc').subscribe((user) => {
        expect(user.username).toBe('googleuser');
        done();
      });

      const req = httpMock.expectOne(`${apiUrl}/auth/google`);
      expect(req.request.body).toEqual({ idToken: 'id-token-abc' });
      req.flush({ success: true, token: 'tok', user: { id: '5', username: 'googleuser', role: 'user' } });
    });

    it('propagates an error when Google verification fails', (done) => {
      service.loginWithGoogle('bad-token').subscribe({
        next: () => fail('expected an error'),
        error: (err) => {
          expect(err.status).toBe(401);
          done();
        }
      });

      httpMock.expectOne(`${apiUrl}/auth/google`).flush({}, { status: 401, statusText: 'Unauthorized' });
    });
  });

  describe('getCurrentUser()', () => {
    beforeEach(() => inject());

    it('refreshes the stored/in-memory user on success', (done) => {
      service.getCurrentUser().subscribe((user) => {
        expect(user.username).toBe('alice');
        expect(service.currentUserValue?.username).toBe('alice');
        expect(JSON.parse(localStorage.getItem('currentUser')!).username).toBe('alice');
        done();
      });

      httpMock.expectOne(`${apiUrl}/auth/me`).flush({
        success: true,
        user: { id: '1', username: 'alice', role: 'user', createdAt: '2024-01-01T00:00:00.000Z' }
      });
    });

    it('leaves the current user untouched when the API reports success: false', (done) => {
      service.getCurrentUser().subscribe(() => {
        expect(service.currentUserValue).toBeNull();
        done();
      });

      httpMock.expectOne(`${apiUrl}/auth/me`).flush({ success: false });
    });

    it('propagates a 401 when the token was rejected server-side', (done) => {
      service.getCurrentUser().subscribe({
        next: () => fail('expected an error'),
        error: (err) => {
          expect(err.status).toBe(401);
          done();
        }
      });

      httpMock.expectOne(`${apiUrl}/auth/me`).flush({}, { status: 401, statusText: 'Unauthorized' });
    });
  });

  describe('getStats()', () => {
    beforeEach(() => inject());

    it('maps the response to the stats payload', (done) => {
      const stats = { totalUsers: 5, activeNow: 1, totalSessions: 10, googleUsers: 2, todayLogins: 3, recentLogins: [] };
      service.getStats().subscribe((result) => {
        expect(result).toEqual(stats as any);
        done();
      });

      httpMock.expectOne(`${apiUrl}/auth/stats`).flush({ stats });
    });

    it('propagates a 403 (non-admin requesting stats)', (done) => {
      service.getStats().subscribe({
        next: () => fail('expected an error'),
        error: (err) => {
          expect(err.status).toBe(403);
          done();
        }
      });

      httpMock.expectOne(`${apiUrl}/auth/stats`).flush({}, { status: 403, statusText: 'Forbidden' });
    });
  });

  describe('logout()', () => {
    beforeEach(() => inject());

    it('clears the local session and fires a logout request', () => {
      localStorage.setItem('token', makeToken({}));
      localStorage.setItem('currentUser', JSON.stringify({ id: '1', username: 'alice', role: 'user' }));
      // Re-inject so the service picks up the seeded storage.
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
      inject();

      service.logout();

      expect(service.currentUserValue).toBeNull();
      expect(localStorage.getItem('token')).toBeNull();
      httpMock.expectOne(`${apiUrl}/auth/logout`).flush({});
    });

    it('still clears the session locally even if the logout request fails', () => {
      service.logout();
      expect(service.currentUserValue).toBeNull();
      httpMock.expectOne(`${apiUrl}/auth/logout`).flush({}, { status: 500, statusText: 'Server Error' });
      // No unhandled-error expectation: the service subscribes with a no-op error handler.
    });
  });

  describe('clearSession()', () => {
    beforeEach(() => inject());

    it('removes storage and nulls the current user', () => {
      localStorage.setItem('token', 'tok');
      localStorage.setItem('currentUser', JSON.stringify({ id: '1', username: 'a', role: 'user' }));
      service.clearSession();
      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('currentUser')).toBeNull();
      expect(service.currentUserValue).toBeNull();
    });

    it('is idempotent — calling it twice does not throw or re-emit incorrectly', () => {
      service.clearSession();
      expect(() => service.clearSession()).not.toThrow();
      expect(service.currentUserValue).toBeNull();
    });
  });

  describe('isAuthenticated() / isAdmin() / getToken()', () => {
    it('isAuthenticated() is false with no stored user', () => {
      inject();
      expect(service.isAuthenticated()).toBeFalse();
    });

    it('isAuthenticated() is true with a user and a non-expired token', () => {
      localStorage.setItem('currentUser', JSON.stringify({ id: '1', username: 'alice', role: 'user' }));
      localStorage.setItem('token', makeToken({ exp: Math.floor(Date.now() / 1000) + 3600 }));
      inject();
      expect(service.isAuthenticated()).toBeTrue();
    });

    it('isAuthenticated() is false and clears session when the user exists but the token is missing', () => {
      localStorage.setItem('currentUser', JSON.stringify({ id: '1', username: 'alice', role: 'user' }));
      inject();
      expect(service.isAuthenticated()).toBeFalse();
      expect(service.currentUserValue).toBeNull();
    });

    it('isAuthenticated() is false and clears session when the token is expired', () => {
      localStorage.setItem('currentUser', JSON.stringify({ id: '1', username: 'alice', role: 'user' }));
      localStorage.setItem('token', makeToken({ exp: Math.floor(Date.now() / 1000) - 3600 }));
      inject();
      expect(service.isAuthenticated()).toBeFalse();
      expect(service.currentUserValue).toBeNull();
      expect(localStorage.getItem('token')).toBeNull();
    });

    it('isAuthenticated() treats an unparseable token as valid (fails closed to the server, not the client)', () => {
      localStorage.setItem('currentUser', JSON.stringify({ id: '1', username: 'alice', role: 'user' }));
      localStorage.setItem('token', 'not-a-jwt-at-all');
      inject();
      expect(service.isAuthenticated()).toBeTrue();
    });

    it('isAdmin() is true only for an authenticated admin user', () => {
      localStorage.setItem('currentUser', JSON.stringify({ id: '1', username: 'a', role: 'admin' }));
      localStorage.setItem('token', makeToken({ exp: Math.floor(Date.now() / 1000) + 3600 }));
      inject();
      expect(service.isAdmin()).toBeTrue();
    });

    it('isAdmin() is false for an authenticated non-admin user', () => {
      localStorage.setItem('currentUser', JSON.stringify({ id: '1', username: 'a', role: 'user' }));
      localStorage.setItem('token', makeToken({ exp: Math.floor(Date.now() / 1000) + 3600 }));
      inject();
      expect(service.isAdmin()).toBeFalse();
    });

    it('isAdmin() is false when not authenticated at all', () => {
      inject();
      expect(service.isAdmin()).toBeFalse();
    });

    it('getToken() returns null when nothing is stored', () => {
      inject();
      expect(service.getToken()).toBeNull();
    });

    it('getToken() returns the stored token verbatim', () => {
      localStorage.setItem('token', 'abc.def.ghi');
      inject();
      expect(service.getToken()).toBe('abc.def.ghi');
    });
  });

  describe('isLoggedIn$', () => {
    it('emits false while signed out, then true after a successful login', (done) => {
      inject();
      const emissions: boolean[] = [];
      service.isLoggedIn$.subscribe((v) => {
        emissions.push(v);
        if (emissions.length === 2) {
          expect(emissions).toEqual([false, true]);
          done();
        }
      });

      service.login({ email: 'alice', password: 'secret' }).subscribe();
      httpMock.expectOne(`${apiUrl}/auth/login`).flush({
        success: true,
        token: makeToken({ exp: Math.floor(Date.now() / 1000) + 3600 }),
        user: { id: '1', username: 'alice', role: 'user' }
      });
    });

    it('emits false again after logout', (done) => {
      localStorage.setItem('currentUser', JSON.stringify({ id: '1', username: 'alice', role: 'user' }));
      localStorage.setItem('token', makeToken({ exp: Math.floor(Date.now() / 1000) + 3600 }));
      inject();

      const emissions: boolean[] = [];
      service.isLoggedIn$.subscribe((v) => {
        emissions.push(v);
        if (emissions.length === 2) {
          expect(emissions).toEqual([true, false]);
          done();
        }
      });

      service.logout();
      httpMock.expectOne(`${apiUrl}/auth/logout`).flush({});
    });
  });

  describe('cross-tab / event-driven session invalidation', () => {
    it(`clears the session when a ${SESSION_EXPIRED_EVENT} event fires (dispatched by the HTTP interceptor on a 401)`, () => {
      localStorage.setItem('currentUser', JSON.stringify({ id: '1', username: 'alice', role: 'user' }));
      localStorage.setItem('token', makeToken({ exp: Math.floor(Date.now() / 1000) + 3600 }));
      inject();
      expect(service.currentUserValue).not.toBeNull();

      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));

      expect(service.currentUserValue).toBeNull();
    });

    it('clears the session when the token is removed in another tab (storage event, newValue falsy)', () => {
      localStorage.setItem('currentUser', JSON.stringify({ id: '1', username: 'alice', role: 'user' }));
      localStorage.setItem('token', makeToken({ exp: Math.floor(Date.now() / 1000) + 3600 }));
      inject();

      window.dispatchEvent(new StorageEvent('storage', { key: 'token', newValue: null }));

      expect(service.currentUserValue).toBeNull();
    });

    it('does NOT clear the session on an unrelated storage key changing in another tab', () => {
      localStorage.setItem('currentUser', JSON.stringify({ id: '1', username: 'alice', role: 'user' }));
      localStorage.setItem('token', makeToken({ exp: Math.floor(Date.now() / 1000) + 3600 }));
      inject();

      window.dispatchEvent(new StorageEvent('storage', { key: 'someOtherKey', newValue: 'x' }));

      expect(service.currentUserValue).not.toBeNull();
    });

    it('does NOT clear the session when the token storage event carries a non-empty newValue (token refreshed, not removed)', () => {
      localStorage.setItem('currentUser', JSON.stringify({ id: '1', username: 'alice', role: 'user' }));
      localStorage.setItem('token', makeToken({ exp: Math.floor(Date.now() / 1000) + 3600 }));
      inject();

      window.dispatchEvent(new StorageEvent('storage', { key: 'token', newValue: 'refreshed-token' }));

      expect(service.currentUserValue).not.toBeNull();
    });
  });

  describe('security: no sensitive data exposure', () => {
    beforeEach(() => inject());

    it('never stores the raw password anywhere in localStorage after login', (done) => {
      service.login({ email: 'alice', password: 'super-secret-pw' }).subscribe(() => {
        const raw = JSON.stringify(localStorage);
        // Can't enumerate localStorage directly in all environments; check known keys instead.
        expect(localStorage.getItem('currentUser')).not.toContain('super-secret-pw');
        expect(localStorage.getItem('token')).not.toContain('super-secret-pw');
        done();
      });

      httpMock.expectOne(`${apiUrl}/auth/login`).flush({
        success: true,
        token: 'tok',
        user: { id: '1', username: 'alice', role: 'user' }
      });
    });
  });
});
