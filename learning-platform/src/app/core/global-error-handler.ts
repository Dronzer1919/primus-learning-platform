// The last line of defence: anything thrown anywhere in the app lands here.
//
// Angular's default ErrorHandler prints to the console and stops. That is fine
// in development and wrong in production: a TypeError inside a subscribe
// callback leaves the view half-rendered with no indication that anything went
// wrong, and the user is left clicking a button that will never respond. This
// handler keeps the app alive, tells the user in one sentence, and — for the
// one failure mode that genuinely cannot be recovered in place, a stale lazy
// chunk after a deploy — reloads once.
//
// It never rethrows. Whatever arrives here has already escaped every other
// guard, so the only outcomes worth having are "handled" or "handled loudly".

import { ErrorHandler, Injectable, NgZone, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NotificationService } from './notification.service';
import { logError } from './logger';
import { environment } from '../../environments/environment';

/** Marks that we have already reloaded for a chunk failure, so we cannot loop. */
const CHUNK_RELOAD_KEY = 'app:chunk-reloaded';

/** Identical errors inside this window are logged once, not once per occurrence. */
const DEDUPE_WINDOW_MS = 4000;

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly zone = inject(NgZone);
  private readonly notifier = inject(NotificationService);

  private readonly recent = new Map<string, number>();

  handleError(error: unknown): void {
    try {
      this.process(error);
    } catch (handlerFailure) {
      // If the handler itself throws, Angular has nowhere left to go. Fall back
      // to the raw console rather than letting the failure escape.
      // eslint-disable-next-line no-console
      console.error('Error handler failed:', handlerFailure, 'while handling:', error);
    }
  }

  private process(error: unknown): void {
    const unwrapped = this.unwrap(error);

    // HTTP failures are already translated, retried and reported by
    // errorInterceptor. They only reach here when a subscriber has no error
    // callback, so re-notifying would double up on a message the user has seen.
    if (unwrapped instanceof HttpErrorResponse) {
      logError(`Unhandled HTTP error ${unwrapped.status} for ${unwrapped.url}`, unwrapped.message);
      return;
    }

    const message = this.describe(unwrapped);
    if (this.isDuplicate(message)) return;

    logError(message, environment.production ? undefined : unwrapped);

    // A lazy route chunk that 404s means the browser is holding an index.html
    // from before the last deploy, so its hashed chunk names no longer exist.
    // Nothing in-page can fix that; a single reload fetches the current build.
    if (this.isChunkLoadFailure(unwrapped)) {
      this.reloadOnceForStaleBuild();
      return;
    }

    // No user-facing toast here by design: this handler catches *any* uncaught
    // error app-wide, including ones that don't visibly break anything the user
    // is looking at, and the generic "Something went wrong" message was firing
    // often enough to read as noise rather than signal. The error is still
    // captured above via logError for diagnosis.
  }

  /** Rejected promises and zone.js wrap the real error; report the cause, not the wrapper. */
  private unwrap(error: unknown): unknown {
    const candidate = error as { rejection?: unknown; ngOriginalError?: unknown } | null;
    return candidate?.rejection ?? candidate?.ngOriginalError ?? error;
  }

  private describe(error: unknown): string {
    if (error instanceof Error) return `${error.name}: ${error.message}`;
    if (typeof error === 'string') return error;
    try {
      return JSON.stringify(error) ?? 'Unknown error';
    } catch {
      return 'Unknown error';
    }
  }

  private isDuplicate(message: string): boolean {
    const now = Date.now();
    for (const [key, expiry] of this.recent) {
      if (expiry <= now) this.recent.delete(key);
    }
    if ((this.recent.get(message) ?? 0) > now) return true;
    this.recent.set(message, now + DEDUPE_WINDOW_MS);
    return false;
  }

  private isChunkLoadFailure(error: unknown): boolean {
    const message = error instanceof Error ? `${error.name} ${error.message}` : String(error);
    return /ChunkLoadError|Loading chunk .* failed|Failed to fetch dynamically imported module|error loading dynamically imported module/i
      .test(message);
  }

  private reloadOnceForStaleBuild(): void {
    let alreadyReloaded = false;
    try {
      alreadyReloaded = sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1';
      sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
    } catch {
      // Private-browsing modes can throw on sessionStorage. Without the flag we
      // cannot prove this is the first attempt, so decline to reload rather than
      // risk an endless refresh loop.
      alreadyReloaded = true;
    }

    if (alreadyReloaded) {
      this.zone.run(() => {
        void this.notifier.error('This page could not finish loading. Please refresh.');
      });
      return;
    }
    window.location.reload();
  }
}

/**
 * Releases the one-reload guard, but only after the app has stayed up for a
 * while.
 *
 * Clearing it immediately at bootstrap would defeat the guard: if index.html
 * itself is being served from cache, the reload changes nothing and the app
 * would refresh forever. A chunk failure minutes into a healthy session is a
 * different event — a real deploy — and deserves its own reload, so the flag is
 * released on a delay long enough that no loop can fit inside it.
 */
export function scheduleStaleBuildFlagClear(delayMs = 30000): void {
  setTimeout(() => {
    try {
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    } catch {
      /* storage unavailable — nothing to clear */
    }
  }, delayMs);
}
