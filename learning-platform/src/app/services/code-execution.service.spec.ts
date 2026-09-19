import { TestBed } from '@angular/core/testing';
import { CodeExecutionService } from './code-execution.service';

describe('CodeExecutionService', () => {
  let service: CodeExecutionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CodeExecutionService);
  });

  afterEach(() => {
    service.stopCapture();
    delete (window as any).loadPyodide;
  });

  it('creates', () => {
    expect(service).toBeTruthy();
  });

  // ---------- runInPage() ----------
  describe('runInPage()', () => {
    it('captures console.log with a "> " prefix', () => {
      const logs = service.runInPage("console.log('hello');");
      expect(logs).toEqual(['> hello']);
    });

    it('captures console.info/warn with the same "> " prefix as log', () => {
      expect(service.runInPage("console.info('a');")).toEqual(['> a']);
      expect(service.runInPage("console.warn('b');")).toEqual(['> b']);
    });

    it('captures console.error with an "ERROR: " prefix', () => {
      const logs = service.runInPage("console.error('bad');");
      expect(logs).toEqual(['ERROR: bad']);
    });

    it('joins multiple console.log arguments with a space', () => {
      const logs = service.runInPage("console.log('a', 1, true);");
      expect(logs).toEqual(['> a 1 true']);
    });

    it('formats an object argument as JSON', () => {
      const logs = service.runInPage('console.log({ a: 1 });');
      expect(logs).toEqual(['> {"a":1}']);
    });

    it('formats null and undefined explicitly rather than as empty strings', () => {
      expect(service.runInPage('console.log(null);')).toEqual(['> null']);
      expect(service.runInPage('console.log(undefined);')).toEqual(['> undefined']);
    });

    it('formats an Error argument as its message', () => {
      const logs = service.runInPage("console.log(new Error('oops'));");
      expect(logs).toEqual(['> oops']);
    });

    it('falls back to String() when JSON.stringify would throw (circular reference)', () => {
      const logs = service.runInPage(
        'const a = {}; a.self = a; console.log(a);'
      );
      expect(logs[0]).toMatch(/^> /);
      expect(logs.length).toBe(1);
    });

    it('captures a thrown synchronous error as an ERROR line instead of throwing out of runInPage', () => {
      const logs = service.runInPage('throw new Error("kaboom");');
      expect(logs).toEqual(['ERROR: kaboom']);
    });

    it('captures a reference error from invalid code', () => {
      const logs = service.runInPage('undefinedVariable.doSomething();');
      expect(logs[0]).toContain('ERROR:');
    });

    it('runs empty code without producing any output', () => {
      expect(service.runInPage('')).toEqual([]);
    });

    it('does not patch the real window.setTimeout (sandboxing is via parameter shadowing, not monkeypatching)', () => {
      const realSetTimeout = window.setTimeout;
      service.runInPage('setTimeout(function(){}, 1000);');
      expect(window.setTimeout).toBe(realSetTimeout);
    });

    it('calls onActivity once per pushed console line', () => {
      const onActivity = jasmine.createSpy('onActivity');
      service.runInPage("console.log('a'); console.log('b');", onActivity);
      expect(onActivity).toHaveBeenCalledTimes(2);
    });

    it('auto-stops the previous run\'s capture when called again', () => {
      service.runInPage('setTimeout(function(){}, 5000);');
      expect(service.getPendingTimerCount()).toBe(1);
      service.runInPage("console.log('fresh run');");
      // stopCapture() at the top of the new call clears the old bookkeeping,
      // and this run scheduled no timers of its own.
      expect(service.getPendingTimerCount()).toBe(0);
    });
  });

  // ---------- pending timer tracking ----------
  describe('getPendingTimerCount() / sandboxed setTimeout', () => {
    beforeEach(() => jasmine.clock().install());
    afterEach(() => jasmine.clock().uninstall());

    it('is 0 when no timers were scheduled', () => {
      service.runInPage('let x = 1;');
      expect(service.getPendingTimerCount()).toBe(0);
    });

    it('increments while a scheduled timer is still pending', () => {
      service.runInPage('setTimeout(function(){}, 1000);');
      expect(service.getPendingTimerCount()).toBe(1);
    });

    it('decrements once the scheduled timer fires', () => {
      service.runInPage('setTimeout(function(){}, 1000);');
      jasmine.clock().tick(1000);
      expect(service.getPendingTimerCount()).toBe(0);
    });

    it('decrements when clearTimeout cancels the pending timer', () => {
      service.runInPage('var id = setTimeout(function(){}, 5000); clearTimeout(id);');
      expect(service.getPendingTimerCount()).toBe(0);
    });

    it('tracks multiple simultaneously pending timers', () => {
      service.runInPage('setTimeout(function(){}, 1000); setTimeout(function(){}, 2000);');
      expect(service.getPendingTimerCount()).toBe(2);
    });

    it('a fired timer still runs its handler and any console output inside it', () => {
      const logs = service.runInPage("setTimeout(function(){ console.log('later'); }, 1000);");
      jasmine.clock().tick(1000);
      expect(logs).toContain('> later');
    });
  });

  describe('stopCapture()', () => {
    it('resets pending timer count to 0', () => {
      service.runInPage('setTimeout(function(){}, 5000);');
      service.stopCapture();
      expect(service.getPendingTimerCount()).toBe(0);
    });

    it('is safe to call when nothing is active', () => {
      expect(() => service.stopCapture()).not.toThrow();
      expect(() => service.stopCapture()).not.toThrow();
    });
  });

  // ---------- buildWebMarkup() ----------
  describe('buildWebMarkup()', () => {
    it('extracts only the <body> content and wraps the CSS in a <style> tag', () => {
      const html = '<html><head><title>x</title></head><body><h1>Hi</h1></body></html>';
      const result: any = service.buildWebMarkup(html, 'h1 { color: red; }');
      // SafeHtml doesn't expose its string directly in the public type, but bypassSecurityTrustHtml's
      // internal value is inspectable via the known ɵhtml wrapper in this Angular version.
      const raw = (result as any).changingThisBreaksApplicationSecurity ?? String(result);
      expect(raw).toContain('<style>h1 { color: red; }</style>');
      expect(raw).toContain('<h1>Hi</h1>');
      expect(raw).not.toContain('<title>x</title>');
    });

    it('falls back to the whole input when there is no <body> tag', () => {
      const result: any = service.buildWebMarkup('<h1>No body wrapper</h1>', '');
      const raw = (result as any).changingThisBreaksApplicationSecurity ?? String(result);
      expect(raw).toContain('<h1>No body wrapper</h1>');
    });

    it('handles empty html/css without throwing', () => {
      expect(() => service.buildWebMarkup('', '')).not.toThrow();
    });
  });

  // ---------- transpileTypeScript() ----------
  describe('transpileTypeScript()', () => {
    it('transpiles a typed TS snippet to plain JS', async () => {
      const js = await service.transpileTypeScript('const x: number = 5;\nconsole.log(x);');
      expect(js).toContain('console.log(x)');
      expect(js).not.toContain(': number');
    });

    it('strips an interface declaration (type-only, no JS output for it)', async () => {
      const js = await service.transpileTypeScript('interface Foo { a: number }\nconst x = 1;');
      expect(js).not.toContain('interface');
    });

    it('resolves (does not reject) even for malformed input — transpileModule does single-file, best-effort transforms with no full type-checking', async () => {
      // ts.transpileModule intentionally skips program-wide diagnostics for speed, so it
      // does not throw on invalid TypeScript the way a full `tsc` compile would.
      await expectAsync(service.transpileTypeScript('const x: = = = ;;;{{{')).toBeResolved();
    });
  });

  // ---------- runPython() ----------
  // Pyodide loads a real WASM runtime from a CDN — not something to hit in a unit test.
  // `loadPyodide` is set as a global before each of these tests to short-circuit the
  // CDN script-injection path entirely (see loadPyodide()/initPyodide() in the service).
  describe('runPython()', () => {
    let fakePyodideState: { stdout: (s: string) => void; stderr: (s: string) => void };

    beforeEach(() => {
      fakePyodideState = { stdout: () => {}, stderr: () => {} };
    });

    function installFakePyodide(pyodide: any): jasmine.Spy {
      const spy = jasmine.createSpy('loadPyodide').and.resolveTo(pyodide);
      (window as any).loadPyodide = spy;
      return spy;
    }

    it('returns captured stdout', async () => {
      installFakePyodide({
        setStdout: ({ batched }: any) => (fakePyodideState.stdout = batched),
        setStderr: ({ batched }: any) => (fakePyodideState.stderr = batched),
        runPythonAsync: async () => fakePyodideState.stdout('Hello from Python')
      });

      const result = await service.runPython('print("Hello from Python")');
      expect(result.stdout).toContain('Hello from Python');
      expect(result.stderr).toBe('');
    });

    it('returns captured stderr', async () => {
      installFakePyodide({
        setStdout: ({ batched }: any) => (fakePyodideState.stdout = batched),
        setStderr: ({ batched }: any) => (fakePyodideState.stderr = batched),
        runPythonAsync: async () => fakePyodideState.stderr('warning: something')
      });

      const result = await service.runPython('...');
      expect(result.stderr).toContain('warning: something');
    });

    it('captures a Python exception message into stderr instead of rejecting', async () => {
      installFakePyodide({
        setStdout: () => {},
        setStderr: () => {},
        runPythonAsync: async () => {
          throw new Error('NameError: name x is not defined');
        }
      });

      const result = await service.runPython('print(x)');
      expect(result.stderr).toContain('NameError');
    });

    it('reuses the same Pyodide instance across multiple runs (loads only once)', async () => {
      const loadSpy = installFakePyodide({
        setStdout: () => {},
        setStderr: () => {},
        runPythonAsync: async () => {}
      });

      await service.runPython('print(1)');
      await service.runPython('print(2)');

      expect(loadSpy).toHaveBeenCalledTimes(1);
    });
  });
});
