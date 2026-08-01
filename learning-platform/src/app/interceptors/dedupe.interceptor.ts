// Collapses identical GETs that are in flight at the same moment into one call.
//
// This app fans out easily. ContentService is root-provided and loads tabs and
// topics in its constructor; the user page, the topic list and the admin
// dashboard all read the same endpoints; the dashboard polls every 30s; and a
// route change can remount a component before its previous request has settled.
// Each of those on its own is one request — together, and on a slow connection,
// they arrive as a burst of duplicates. That is what pushes a client into the
// API's global limiter (300/min in rateLimiters.js) and turns a slow page into
// a 429.
//
// The fix is simple: while a GET for a given URL is outstanding, every later
// subscriber to that same URL shares its response instead of issuing a second
// one. Writes are never shared — two saves are two distinct intents even when
// their payloads match.

import { HttpEvent, HttpInterceptorFn } from '@angular/common/http';
import { Observable, ReplaySubject } from 'rxjs';
import { finalize, share } from 'rxjs/operators';

/** url -> the in-flight response stream for it. */
const inFlight = new Map<string, Observable<HttpEvent<unknown>>>();

export const dedupeInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'GET') return next(req);

  const key = req.urlWithParams;
  const existing = inFlight.get(key);
  if (existing) return existing;

  const shared = next(req).pipe(
    // Upstream of share, so this fires when the underlying request settles or is
    // torn down. Without it a finished entry would linger in the map and every
    // later call to that URL would attach to a dead observable and hang.
    finalize(() => inFlight.delete(key)),
    share({
      // ReplaySubject(1), not a plain Subject: a caller that subscribes a tick
      // after the response arrived must still receive it rather than nothing.
      connector: () => new ReplaySubject<HttpEvent<unknown>>(1),
      resetOnError: true,
      resetOnComplete: true,
      // If every caller walks away — navigating off a page mid-load — the real
      // request is cancelled instead of being left to run to completion.
      resetOnRefCountZero: true
    })
  );

  inFlight.set(key, shared);
  return shared;
};

/** Diagnostic hook: how many distinct GETs are currently outstanding. */
export function inFlightCount(): number {
  return inFlight.size;
}
