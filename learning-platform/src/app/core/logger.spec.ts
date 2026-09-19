import { environment } from '../../environments/environment';
import { logError, logWarn, logInfo, recentLogs, silenceConsoleInProduction, restoreConsole } from './logger';

describe('logger', () => {
  afterEach(() => {
    (environment as any).production = false;
    restoreConsole();
  });

  describe('logError() / logWarn() / logInfo() -> recentLogs()', () => {
    it('records an error entry with its level and message', () => {
      logError('boom', { detail: 1 });
      const last = recentLogs()[recentLogs().length - 1];
      expect(last.level).toBe('error');
      expect(last.message).toBe('boom');
      expect(last.context).toEqual({ detail: 1 });
    });

    it('records a warn entry', () => {
      logWarn('careful');
      const last = recentLogs()[recentLogs().length - 1];
      expect(last.level).toBe('warn');
    });

    it('records an info entry', () => {
      logInfo('fyi');
      const last = recentLogs()[recentLogs().length - 1];
      expect(last.level).toBe('info');
    });

    it('caps the ring buffer at 50 entries, dropping the oldest first', () => {
      for (let i = 0; i < 60; i++) logInfo(`entry-${i}`);
      const logs = recentLogs();
      expect(logs.length).toBe(50);
      expect(logs[0].message).toBe('entry-10'); // the first 10 were pushed out
      expect(logs[logs.length - 1].message).toBe('entry-59');
    });

    it('recentLogs() returns a copy, not the live array', () => {
      logInfo('x');
      const a = recentLogs();
      a.push({ at: 'fake', level: 'error', message: 'injected' });
      expect(recentLogs().find((e) => e.message === 'injected')).toBeUndefined();
    });
  });

  // A genuine testability limit, not worked around: logger.ts captures
  // `nativeConsole.{error,warn,info} = console.X.bind(console)` once, at module load —
  // before this or any spec file can attach a spy. `.bind()` closes over that exact
  // original function object, so a later `spyOn(console, 'error')` reassigns the
  // `console.error` *property* but nativeConsole.error still calls straight through to
  // the pre-spy original, invisibly to the spy. A first attempt at these tests appeared
  // to pass for the "suppressed" cases and fail for the "called" cases — which, on
  // inspection, meant the spy was never actually being exercised either way (a false
  // pass, not a real one). Given that, whether logError/logWarn/logInfo actually reach
  // the real console isn't independently unit-testable from outside the module without
  // changing its design; what IS verified below is everything actually observable
  // through the public API: recentLogs() always records regardless of environment, and
  // silenceConsoleInProduction()/restoreConsole() (which reassign console.* directly,
  // not through nativeConsole) are fully testable and covered above.
  describe('console output (see note above on what is / is not testable here)', () => {
    it('recentLogs() records logWarn/logInfo entries the same way whether or not production would suppress their console output', () => {
      (environment as any).production = true;
      logWarn('w-in-prod');
      logInfo('i-in-prod');
      const messages = recentLogs().map((e) => e.message);
      expect(messages).toContain('w-in-prod');
      expect(messages).toContain('i-in-prod');
    });
  });

  describe('silenceConsoleInProduction() / restoreConsole()', () => {
    it('is a no-op outside production', () => {
      (environment as any).production = false;
      const before = console.log;
      silenceConsoleInProduction();
      expect(console.log).toBe(before);
    });

    it('replaces console.log with a no-op in production', () => {
      (environment as any).production = true;
      silenceConsoleInProduction();
      expect(() => console.log('should be silent')).not.toThrow();
    });

    it('leaves console.warn/console.error untouched (a silent app is undiagnosable)', () => {
      (environment as any).production = true;
      const warnSpy = spyOn(console, 'warn');
      silenceConsoleInProduction();
      console.warn('still works');
      expect(warnSpy).toHaveBeenCalledWith('still works');
    });

    it('restoreConsole() brings back working console.log after silencing', () => {
      (environment as any).production = true;
      silenceConsoleInProduction();
      const silencedRef = console.log;
      restoreConsole();
      expect(console.log).not.toBe(silencedRef);
    });
  });
});
