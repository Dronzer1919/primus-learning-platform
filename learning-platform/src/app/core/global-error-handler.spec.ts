import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { GlobalErrorHandler, scheduleStaleBuildFlagClear } from './global-error-handler';
import { NotificationService } from './notification.service';
import { recentLogs } from './logger';

// NOTE on verification strategy: logger.ts's logError() routes console output through a
// closure (`nativeConsole`) captured at module load time, which spyOn(console, 'error')
// cannot intercept after the fact (see the note in logger.spec.ts for the full
// explanation). So instead of spying on console.error, these tests verify what
// GlobalErrorHandler actually did via logger's own public recentLogs() — a more robust
// check anyway, since it asserts on the real observable side effect rather than a
// console call that could stop mattering if logError's internals ever change.

function lastLogMessage(): string | undefined {
  const logs = recentLogs();
  return logs[logs.length - 1]?.message;
}

describe('GlobalErrorHandler', () => {
  let handler: GlobalErrorHandler;
  let notifications: jasmine.SpyObj<NotificationService>;

  beforeEach(() => {
    notifications = jasmine.createSpyObj<NotificationService>('NotificationService', ['error', 'warn', 'success']);
    notifications.error.and.resolveTo();

    TestBed.configureTestingModule({
      providers: [GlobalErrorHandler, { provide: NotificationService, useValue: notifications }]
    });
    handler = TestBed.inject(GlobalErrorHandler);

    safeRemoveChunkFlag();
  });

  afterEach(() => safeRemoveChunkFlag());

  function safeRemoveChunkFlag(): void {
    try {
      sessionStorage.removeItem('app:chunk-reloaded');
    } catch {
      /* ignore — a spied removeItem from within a test may still be active during teardown */
    }
  }

  it('creates', () => {
    expect(handler).toBeTruthy();
  });

  describe('handleError()', () => {
    it('never throws, even for a completely malformed input', () => {
      expect(() => handler.handleError(undefined)).not.toThrow();
      expect(() => handler.handleError(null)).not.toThrow();
      expect(() => handler.handleError(42)).not.toThrow();
    });

    it('logs (without notifying) an HttpErrorResponse — errorInterceptor already told the user', () => {
      handler.handleError(new HttpErrorResponse({ status: 500, url: '/api/x' }));
      expect(lastLogMessage()).toContain('Unhandled HTTP error 500');
      expect(notifications.error).not.toHaveBeenCalled();
    });

    it('describes a plain Error as "Name: message"', () => {
      handler.handleError(new TypeError('cannot read x of undefined'));
      expect(lastLogMessage()).toBe('TypeError: cannot read x of undefined');
    });

    it('logs a plain string error as-is', () => {
      handler.handleError('a raw string error');
      expect(lastLogMessage()).toBe('a raw string error');
    });

    it('unwraps a rejected-promise-shaped error (event.rejection)', () => {
      handler.handleError({ rejection: new Error('the real cause') });
      expect(lastLogMessage()).toContain('the real cause');
    });

    it('unwraps a zone.js-wrapped error (ngOriginalError)', () => {
      handler.handleError({ ngOriginalError: new Error('the real cause') });
      expect(lastLogMessage()).toContain('the real cause');
    });

    it('falls back to "Unknown error" for an unstringifiable object (circular reference)', () => {
      const circular: any = {};
      circular.self = circular;
      handler.handleError(circular);
      expect(lastLogMessage()).toBe('Unknown error');
    });

    it('never shows a toast for an ordinary error (no user-facing message by design)', () => {
      handler.handleError(new Error('not-a-chunk-failure ' + Math.random()));
      expect(notifications.error).not.toHaveBeenCalled();
    });

    it('deduplicates identical errors within the dedupe window (logged once, not twice)', () => {
      const unique = `repeat-${Math.random()}`;
      handler.handleError(new Error(unique));
      const countAfterFirst = recentLogs().filter((e) => e.message.includes(unique)).length;
      handler.handleError(new Error(unique));
      const countAfterSecond = recentLogs().filter((e) => e.message.includes(unique)).length;
      expect(countAfterFirst).toBe(1);
      expect(countAfterSecond).toBe(1);
    });

    it('logs distinct errors independently (dedup keys on message, not on any call)', () => {
      const a = `error-A-${Math.random()}`;
      const b = `error-B-${Math.random()}`;
      handler.handleError(new Error(a));
      handler.handleError(new Error(b));
      const messages = recentLogs().map((e) => e.message);
      expect(messages.some((m) => m.includes(a))).toBeTrue();
      expect(messages.some((m) => m.includes(b))).toBeTrue();
    });
  });

  // KNOWN TEST-ENVIRONMENT LIMIT (not a product bug): window.location.reload is a
  // non-configurable own property on Location in real Chrome (confirmed empirically —
  // both spyOn() and Object.defineProperty() refuse to touch it: "not declared writable
  // or has no setter" / "Cannot redefine property"). That means the one branch that
  // actually calls window.location.reload() — the very first chunk-load failure — cannot
  // be safely exercised here: nothing can intercept the call, so running it for real
  // would navigate the Karma browser away mid-suite. Every other branch of
  // reloadOnceForStaleBuild() reaches its "notify instead" path *before* ever calling
  // reload(), so those are fully safe and covered below, including the message-shape
  // detection that would otherwise be the reload path's only unique logic.
  describe('chunk-load-failure recovery (safe branches only — see note above)', () => {
    it('does not reload a second time — notifies the user instead (avoids a refresh loop)', () => {
      sessionStorage.setItem('app:chunk-reloaded', '1');
      handler.handleError(new Error('Loading chunk 6 failed'));
      expect(notifications.error).toHaveBeenCalled();
      expect(sessionStorage.getItem('app:chunk-reloaded')).toBe('1');
    });

    it('recognizes the dynamic-import-failure phrasing too, not just webpack\'s ChunkLoadError', () => {
      sessionStorage.setItem('app:chunk-reloaded', '1'); // force the safe "already reloaded" branch
      handler.handleError(new Error('Failed to fetch dynamically imported module'));
      expect(notifications.error).toHaveBeenCalled();
    });

    it('treats a sessionStorage.getItem failure as "already reloaded" (fail safe, never loop)', () => {
      spyOn(sessionStorage, 'getItem').and.throwError('SecurityError');
      handler.handleError(new Error('Loading chunk 7 failed'));
      expect(notifications.error).toHaveBeenCalled();
    });

    it('does not notify or touch the chunk-reload flag for an ordinary (non-chunk) error', () => {
      handler.handleError(new Error('just a bug, not a chunk failure'));
      expect(notifications.error).not.toHaveBeenCalled();
      expect(sessionStorage.getItem('app:chunk-reloaded')).toBeNull();
    });
  });
});

describe('scheduleStaleBuildFlagClear()', () => {
  afterEach(() => {
    try {
      sessionStorage.removeItem('app:chunk-reloaded');
    } catch {
      /* a spied removeItem from within a test may still be active during teardown */
    }
  });

  it('removes the chunk-reload flag after the given delay', fakeAsync(() => {
    sessionStorage.setItem('app:chunk-reloaded', '1');
    scheduleStaleBuildFlagClear(1000);
    expect(sessionStorage.getItem('app:chunk-reloaded')).toBe('1');
    tick(1000);
    expect(sessionStorage.getItem('app:chunk-reloaded')).toBeNull();
  }));

  it('does not clear it before the delay has elapsed', fakeAsync(() => {
    sessionStorage.setItem('app:chunk-reloaded', '1');
    scheduleStaleBuildFlagClear(30000);
    tick(29999);
    expect(sessionStorage.getItem('app:chunk-reloaded')).toBe('1');
    tick(1);
  }));

  it('swallows a sessionStorage failure instead of throwing', fakeAsync(() => {
    const spy = spyOn(sessionStorage, 'removeItem').and.throwError('SecurityError');
    scheduleStaleBuildFlagClear(100);
    expect(() => tick(100)).not.toThrow();
    spy.and.callThrough(); // restore real behavior before this test's own afterEach runs
  }));
});
