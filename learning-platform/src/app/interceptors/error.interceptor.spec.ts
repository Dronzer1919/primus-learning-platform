import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import {
  errorInterceptor,
  friendlyMessage,
  withoutRetry,
  withRequestTimeout
} from './error.interceptor';
import { NotificationService } from '../core/notification.service';
import { SESSION_EXPIRED_EVENT } from '../services/auth.service';

describe('friendlyMessage()', () => {
  function err(status: number, apiMessage?: string): HttpErrorResponse {
    return new HttpErrorResponse({ status, error: apiMessage ? { message: apiMessage } : null });
  }

  it('prefers the API\'s own message when present', () => {
    expect(friendlyMessage(err(400, 'Custom validation failure'))).toBe('Custom validation failure');
  });

  it('ignores a blank/whitespace-only API message and falls back to the generic text', () => {
    expect(friendlyMessage(err(400, '   '))).not.toBe('   ');
  });

  it('maps every known status to a distinct, human sentence', () => {
    const known = [0, 400, 401, 403, 404, 408, 409, 413, 429];
    const messages = known.map((s) => friendlyMessage(err(s)));
    expect(new Set(messages).size).toBe(known.length);
    for (const m of messages) expect(m.length).toBeGreaterThan(0);
  });

  it('gives a server-side sentence for an unlisted 5xx', () => {
    expect(friendlyMessage(err(502))).toContain('server ran into a problem');
  });

  it('gives a generic sentence for an unlisted 4xx', () => {
    expect(friendlyMessage(err(418))).toBe('Something went wrong. Please try again.');
  });
});

describe('errorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let router: Router;
  let notifications: jasmine.SpyObj<NotificationService>;

  beforeEach(() => {
    notifications = jasmine.createSpyObj<NotificationService>('NotificationService', ['error', 'warn', 'success']);
    notifications.error.and.resolveTo();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: NotificationService, useValue: notifications }
      ]
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
  });

  describe('retry behavior', () => {
    it('does not retry a non-retryable status (404)', fakeAsync(() => {
      let errorSeen: HttpErrorResponse | undefined;
      http.get('/api/x').subscribe({ error: (e) => (errorSeen = e) });
      httpMock.expectOne('/api/x').flush({}, { status: 404, statusText: 'Not Found' });
      tick(5000);
      expect(errorSeen?.status).toBe(404);
      httpMock.verify();
    }));

    it('retries a retryable GET (500) up to MAX_RETRIES times, then fails', fakeAsync(() => {
      let errorSeen: HttpErrorResponse | undefined;
      http.get('/api/y').subscribe({ error: (e) => (errorSeen = e) });

      // Initial attempt + 2 retries = 3 requests total.
      for (let i = 0; i < 3; i++) {
        httpMock.expectOne('/api/y').flush({}, { status: 500, statusText: 'Server Error' });
        tick(5000); // clear the backoff delay before the next attempt fires
      }

      expect(errorSeen?.status).toBe(500);
      httpMock.verify();
    }));

    it('never retries a non-idempotent method (POST) even on a retryable status', fakeAsync(() => {
      let errorSeen: HttpErrorResponse | undefined;
      http.post('/api/z', {}).subscribe({ error: (e) => (errorSeen = e) });
      httpMock.expectOne('/api/z').flush({}, { status: 500, statusText: 'Server Error' });
      tick(5000);
      expect(errorSeen?.status).toBe(500);
      httpMock.verify(); // only one request ever made
    }));

    it('honours withoutRetry() even on an idempotent GET', fakeAsync(() => {
      let errorSeen: HttpErrorResponse | undefined;
      http.get('/api/w', { context: withoutRetry() }).subscribe({ error: (e) => (errorSeen = e) });
      httpMock.expectOne('/api/w').flush({}, { status: 500, statusText: 'Server Error' });
      tick(5000);
      expect(errorSeen?.status).toBe(500);
      httpMock.verify();
    }));

    it('retries after Retry-After when it is within the cap', fakeAsync(() => {
      let succeeded = false;
      http.get('/api/limited').subscribe({ next: () => (succeeded = true) });

      httpMock
        .expectOne('/api/limited')
        .flush({}, { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '2' } });
      tick(2000);
      httpMock.expectOne('/api/limited').flush({ ok: true });

      expect(succeeded).toBeTrue();
    }));

    it('gives up immediately on a 429 whose Retry-After exceeds the cap (no endless wait)', fakeAsync(() => {
      let errorSeen: HttpErrorResponse | undefined;
      http.get('/api/limited-too-long').subscribe({ error: (e) => (errorSeen = e) });

      httpMock
        .expectOne('/api/limited-too-long')
        .flush({}, { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '9999' } });
      tick(1);

      expect(errorSeen?.status).toBe(429);
      httpMock.verify();
    }));

    it('converts a timeout into a 408 HttpErrorResponse', (done) => {
      // Real timers rather than fakeAsync: RxJS's timeout() operator unsubscribing from
      // an un-flushed TestRequest and retry()'s own timer() interact in a way that left
      // requests "open" under tick()-driven virtual time in practice. A very short real
      // timeout keeps this fast (well under a second including both retries' backoff)
      // while exercising the genuine timeout -> retry -> give-up path end to end.
      http.get('/api/slow', { context: withRequestTimeout(5) }).subscribe({
        error: (e: HttpErrorResponse) => {
          expect(e.status).toBe(408);
          // The 3 attempts' underlying TestRequests are abandoned (timed out), not
          // flushed or auto-marked cancelled by HttpTestingController's bookkeeping —
          // drain them explicitly so the afterEach's verify() doesn't flag them.
          httpMock.match(() => true).forEach((req) => {
            try {
              req.flush(null, { status: 0, statusText: 'abandoned (timed out)' });
            } catch {
              /* already torn down — fine */
            }
          });
          done();
        }
      });
    }, 10000);
  });

  describe('401 handling', () => {
    it('clears the local session and dispatches SESSION_EXPIRED_EVENT on a 401 from a non-auth endpoint', fakeAsync(() => {
      localStorage.setItem('token', 'sometoken');
      localStorage.setItem('currentUser', JSON.stringify({ id: '1' }));
      const eventSpy = jasmine.createSpy('sessionExpired');
      window.addEventListener(SESSION_EXPIRED_EVENT, eventSpy);

      http.get('/api/protected').subscribe({ error: () => {} });
      httpMock.expectOne('/api/protected').flush({}, { status: 401, statusText: 'Unauthorized' });

      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('currentUser')).toBeNull();
      expect(eventSpy).toHaveBeenCalled();
      window.removeEventListener(SESSION_EXPIRED_EVENT, eventSpy);
    }));

    it('does NOT clear the session for a 401 from the login endpoint itself (wrong credentials, not an expired session)', fakeAsync(() => {
      localStorage.setItem('token', 'sometoken');
      http.post('/api/auth/login', {}).subscribe({ error: () => {} });
      httpMock.expectOne('/api/auth/login').flush({}, { status: 401, statusText: 'Unauthorized' });
      expect(localStorage.getItem('token')).toBe('sometoken');
    }));

    it('navigates to /login on session expiry when not already on a public page', fakeAsync(() => {
      spyOn(router, 'navigate').and.resolveTo(true);
      spyOnProperty(router, 'url').and.returnValue('/user/notes');

      http.get('/api/protected').subscribe({ error: () => {} });
      httpMock.expectOne('/api/protected').flush({}, { status: 401, statusText: 'Unauthorized' });

      expect(router.navigate).toHaveBeenCalledWith(['/login']);
    }));

    it('does not navigate again when already on a public page', fakeAsync(() => {
      spyOn(router, 'navigate').and.resolveTo(true);
      spyOnProperty(router, 'url').and.returnValue('/login');

      http.get('/api/protected').subscribe({ error: () => {} });
      httpMock.expectOne('/api/protected').flush({}, { status: 401, statusText: 'Unauthorized' });

      expect(router.navigate).not.toHaveBeenCalled();
    }));
  });

  describe('centralized notification (429 / offline)', () => {
    it('notifies once for a 429 (interceptor-level, so callers do not have to)', fakeAsync(() => {
      http.get('/api/limited-notify').subscribe({ error: () => {} });
      httpMock
        .expectOne('/api/limited-notify')
        .flush({}, { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '99999' } });
      expect(notifications.error).toHaveBeenCalled();
    }));

    it('notifies "you appear to be offline" for a status-0 failure while navigator.onLine is false', fakeAsync(() => {
      spyOnProperty(navigator, 'onLine').and.returnValue(false);
      http.get('/api/offline-test', { context: withoutRetry() }).subscribe({ error: () => {} });
      httpMock.expectOne('/api/offline-test').error(new ProgressEvent('network'), { status: 0 });
      expect(notifications.error).toHaveBeenCalledWith(jasmine.stringMatching(/offline/i));
    }));

    it('does not notify for a plain 404 (left to the caller)', fakeAsync(() => {
      http.get('/api/not-found-test').subscribe({ error: () => {} });
      httpMock.expectOne('/api/not-found-test').flush({}, { status: 404, statusText: 'Not Found' });
      expect(notifications.error).not.toHaveBeenCalled();
    }));
  });
});
