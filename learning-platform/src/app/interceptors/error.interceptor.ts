// Every HTTP failure in the app passes through here.
//
// Before this existed, each caller invented its own handling: some showed
// "Check that the backend is running", some logged to the console, some had no
// error callback at all — and a request with no error callback becomes an
// unhandled rejection that Angular reports as a crash. This interceptor gives
// all of them one behaviour:
//
//   * a timeout, so a hung connection cannot leave a spinner running forever;
//   * bounded retries with exponential backoff + jitter, for the failures that
//     are genuinely transient (network blips, 502/503 during a redeploy);
//   * respect for the API's 429 + Retry-After, so a rate-limited client backs
//     off instead of hammering the endpoint that just told it to stop —
//     retrying into backend/src/middleware/rateLimiters.js is what escalates a
//     throttle into a 15-minute IP block;
//   * a single place where an expired session logs the user out.
//
// Only idempotent methods are retried. Replaying a POST that may already have
// been applied server-side would duplicate notes and playground sessions.

import {
  HttpContext,
  HttpContextToken,
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest
} from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { Router } from '@angular/router';
import { throwError, timer } from 'rxjs';
import { catchError, retry, timeout } from 'rxjs/operators';
import { NotificationService } from '../core/notification.service';
import { SESSION_EXPIRED_EVENT } from '../services/auth.service';
import { logWarn } from '../core/logger';

/** Per-request overrides, e.g. `http.get(url, { context: withRequestTimeout(120000) })`. */
export const REQUEST_TIMEOUT = new HttpContextToken<number>(() => 30000);
export const SKIP_RETRY = new HttpContextToken<boolean>(() => false);

/** Raises the timeout for a request known to be slow (a large import, say). */
export function withRequestTimeout(ms: number, context = new HttpContext()): HttpContext {
  return context.set(REQUEST_TIMEOUT, ms);
}

/** Opts a request out of retries — for a GET whose side effects are not free. */
export function withoutRetry(context = new HttpContext()): HttpContext {
  return context.set(SKIP_RETRY, true);
}

const MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 600;

/** Transient by nature: worth one more attempt. Everything else is not. */
const RETRYABLE_STATUSES = new Set([0, 408, 429, 500, 502, 503, 504]);
const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Waiting longer than this for a rate limit clears nothing useful — the API's
 * auth limiter blocks for 15 minutes, and holding a request open that long is
 * indistinguishable from a hang. Past this, fail fast and tell the user.
 */
const MAX_RETRY_AFTER_MS = 5000;

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const injector = inject(Injector);

  return next(req).pipe(
    // Inside the retry below, so the timer restarts for each attempt rather than
    // capping the total elapsed time across all of them.
    timeout({ each: req.context.get(REQUEST_TIMEOUT) }),
    retry({
      count: MAX_RETRIES,
      delay: (error, attempt) => {
        const wait = retryDelay(req, error, attempt);
        if (wait === null) throw error;
        logWarn(`Retrying ${req.method} ${req.urlWithParams} in ${wait}ms (attempt ${attempt})`);
        return timer(wait);
      }
    }),
    catchError((error: unknown) => {
      const failure = asHttpError(error);
      report(injector, req, failure);
      return throwError(() => failure);
    })
  );
};

/** Milliseconds to wait before the next attempt, or null to give up now. */
function retryDelay(req: HttpRequest<unknown>, error: unknown, attempt: number): number | null {
  if (req.context.get(SKIP_RETRY)) return null;
  if (!IDEMPOTENT_METHODS.has(req.method)) return null;

  // A timeout produces a TimeoutError, not an HttpErrorResponse — a slow server
  // is exactly the case retrying is for, so treat it as retryable.
  const isTimeout = (error as { name?: string })?.name === 'TimeoutError';
  if (!isTimeout) {
    if (!(error instanceof HttpErrorResponse)) return null;
    if (!RETRYABLE_STATUSES.has(error.status)) return null;

    // Never retry into a block: the server has already told us how long to wait.
    if (error.status === 429) {
      const after = retryAfterMs(error);
      if (after === null || after > MAX_RETRY_AFTER_MS) return null;
      return after;
    }
  }

  // Exponential backoff with jitter. The jitter matters when the whole page
  // fails at once — without it, every request retries in the same instant and
  // arrives at the recovering server as a synchronised burst.
  const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
  return backoff + Math.floor(Math.random() * BASE_BACKOFF_MS);
}

/** Parses Retry-After, which the API sends in seconds. */
function retryAfterMs(error: HttpErrorResponse): number | null {
  const header = error.headers?.get('Retry-After');
  if (!header) return null;
  const seconds = Number(header);
  return Number.isFinite(seconds) ? Math.max(0, seconds) * 1000 : null;
}

/** Normalises anything the pipeline may emit into an HttpErrorResponse. */
function asHttpError(error: unknown): HttpErrorResponse {
  if (error instanceof HttpErrorResponse) return error;
  if ((error as { name?: string })?.name === 'TimeoutError') {
    return new HttpErrorResponse({
      status: 408,
      statusText: 'Request Timeout',
      error: { message: 'The request took too long to complete.' }
    });
  }
  return new HttpErrorResponse({
    status: 0,
    statusText: 'Unknown Error',
    error
  });
}

function report(injector: Injector, req: HttpRequest<unknown>, error: HttpErrorResponse): void {
  logWarn(`${req.method} ${req.urlWithParams} failed with ${error.status}`, error.error);

  if (error.status === 401 && !isAuthEndpoint(req.url)) {
    endSession(injector);
    return;
  }

  // Only the failures no individual caller can explain are announced here.
  // Everything else is left to the component, which knows what the user was
  // doing — announcing both would show two toasts for one action.
  if (error.status === 429) {
    notify(injector, friendlyMessage(error));
  } else if (error.status === 0 && typeof navigator !== 'undefined' && navigator.onLine === false) {
    notify(injector, 'You appear to be offline. Check your connection and try again.');
  }
}

/** Login/register/google 401s mean "wrong credentials", not "session expired". */
function isAuthEndpoint(url: string): boolean {
  return /\/auth\/(login|register|google)$/.test(url);
}

function endSession(injector: Injector): void {
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
  } catch {
    /* storage unavailable */
  }
  // AuthService listens for this and drops its in-memory user. A DOM event
  // rather than an injected dependency: this interceptor is part of what
  // HttpClient is built from, and AuthService is built from HttpClient.
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));

  const router = injector.get(Router);
  // Already on a public page: no session to expire from, so stay put.
  if (['/', '/login', '/signup', '/landing'].includes(router.url.split('?')[0])) return;

  notify(injector, 'Your session has expired. Please sign in again.');
  void router.navigate(['/login']);
}

function notify(injector: Injector, message: string): void {
  // Resolved lazily: NotificationService pulls in Ionic's ToastController, and
  // nothing should be constructed on the happy path just to sit unused.
  void injector.get(NotificationService).error(message);
}

/**
 * A sentence fit to show a user, derived from a failed response.
 *
 * The API's own message is preferred when there is one — errorHandler.js on the
 * backend already decides what is safe to surface for each status, and repeats
 * a generic string for genuine 500s.
 */
export function friendlyMessage(error: HttpErrorResponse): string {
  const fromApi = (error.error as { message?: string } | null)?.message;
  if (typeof fromApi === 'string' && fromApi.trim()) return fromApi;

  switch (error.status) {
    case 0:
      return 'Could not reach the server. Check your connection and try again.';
    case 400:
      return 'That request was not valid. Please check what you entered.';
    case 401:
      return 'Please sign in to continue.';
    case 403:
      return 'You do not have permission to do that.';
    case 404:
      return 'That item no longer exists.';
    case 408:
      return 'The server took too long to respond. Please try again.';
    case 409:
      return 'That conflicts with something that already exists.';
    case 413:
      return 'That is too large to save.';
    case 429:
      return 'Too many requests. Please wait a moment before trying again.';
    default:
      return error.status >= 500
        ? 'The server ran into a problem. Please try again shortly.'
        : 'Something went wrong. Please try again.';
  }
}
