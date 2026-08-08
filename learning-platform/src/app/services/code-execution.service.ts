import { Injectable } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

export interface PythonRunResult {
  stdout: string;
  stderr: string;
}

declare const loadPyodide: any;

const PYODIDE_CDN_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';

@Injectable({
  providedIn: 'root'
})
export class CodeExecutionService {
  private pyodideInstance: any | null = null;
  private pyodideLoadingPromise: Promise<any> | null = null;

  // How long a run's pending-timer bookkeeping is kept around after its synchronous
  // portion finishes, so getPendingTimerCount() stays meaningful while its setTimeout/
  // promise chains are still in flight. Bounded so a snippet with a very long-lived timer
  // can't leave the "is this run still going" state pinned open forever.
  private static readonly ASYNC_CAPTURE_WINDOW_MS = 15000;

  private activeCapture: { timer: any; pendingTimers: number } | null = null;

  constructor(private sanitizer: DomSanitizer) {}

  // Runs JavaScript directly in the current page (no iframe, but sandboxed via parameter
  // shadowing — see below) and returns the captured console output as a live array: the
  // same array instance keeps receiving pushes from async callbacks (setTimeout, promises)
  // that log after this call returns. Normal logs are prefixed "> "; errors are prefixed
  // "ERROR: " so the console panel can style them.
  //
  // `console`, `setTimeout` and `clearTimeout` are passed as parameters of the executed
  // function rather than patched on `window`. Because JS scoping is lexical, every closure
  // the run creates — including ones that don't fire until long after this call returns,
  // like a setTimeout callback or an awaited promise — still resolves bare `console.log`/
  // `setTimeout` to these sandboxed versions, without ever touching the real globals. That
  // matters: patching `window.setTimeout` directly previously caused the app's OWN internal
  // timers (e.g. this component's success-banner debounce) to route through the patch too,
  // which even triggered infinite recursion once a callback of ours called `clearTimeout`.
  //
  // The sandboxed setTimeout/clearTimeout also count timers the run has scheduled but not
  // yet fired or cancelled (getPendingTimerCount()). Promise chains built on setTimeout (the
  // common `sleep` pattern) are covered transitively, since they call this same function.
  //
  // `onActivity`, if given, fires after every console line pushed and after every pending-
  // timer count change — so callers can tell "the run is still doing something" apart from
  // "nothing left is scheduled", which the returned array alone can't distinguish.
  runInPage(js: string, onActivity?: () => void): string[] {
    this.stopCapture();

    const logs: string[] = [];
    const format = (args: any) =>
      Array.prototype.map.call(args, (arg: any) => this.formatArg(arg)).join(' ');
    const push = (line: string) => {
      logs.push(line);
      onActivity?.();
    };

    const sandboxConsole = {
      log: (...args: any[]) => push('> ' + format(args)),
      info: (...args: any[]) => push('> ' + format(args)),
      warn: (...args: any[]) => push('> ' + format(args)),
      error: (...args: any[]) => push('ERROR: ' + format(args))
    };

    const capture = { timer: null as any, pendingTimers: 0 };
    const sandboxSetTimeout = ((handler: TimerHandler, timeout?: number, ...args: any[]) => {
      if (typeof handler !== 'function') return window.setTimeout(handler, timeout, ...args);
      capture.pendingTimers++;
      return window.setTimeout(() => {
        capture.pendingTimers--;
        try {
          handler(...args);
        } finally {
          onActivity?.();
        }
      }, timeout);
    }) as typeof setTimeout;
    const sandboxClearTimeout = ((id: any) => {
      capture.pendingTimers = Math.max(0, capture.pendingTimers - 1);
      window.clearTimeout(id);
      onActivity?.();
    }) as typeof clearTimeout;

    try {
      // eslint-disable-next-line no-new-func
      const run = new Function('console', 'setTimeout', 'clearTimeout', js);
      run(sandboxConsole, sandboxSetTimeout, sandboxClearTimeout);
    } catch (error: any) {
      push('ERROR: ' + (error && error.message ? error.message : String(error)));
    }

    capture.timer = window.setTimeout(() => this.stopCapture(), CodeExecutionService.ASYNC_CAPTURE_WINDOW_MS);
    this.activeCapture = capture;

    return logs;
  }

  /** Timers the current (or most recent) run has scheduled but not yet fired or cancelled. */
  getPendingTimerCount(): number {
    return this.activeCapture?.pendingTimers ?? 0;
  }

  /** Drops pending-timer bookkeeping for the current run. Safe to call when none is active. */
  stopCapture(): void {
    if (!this.activeCapture) return;
    window.clearTimeout(this.activeCapture.timer);
    this.activeCapture = null;
  }

  // Builds the markup for the Web (HTML/CSS/JS) preview, injected into a page container
  // via [innerHTML] (no iframe). The CSS is applied globally by design — without an
  // iframe there is no style isolation.
  buildWebMarkup(html: string, css: string): SafeHtml {
    const body = this.extractBody(html);
    return this.sanitizer.bypassSecurityTrustHtml(`<style>${css}</style>${body}`);
  }

  // Transpiles TypeScript to plain JavaScript in the browser (no execution). `typescript`
  // is dynamically imported so it lands in its own lazy chunk, not the initial bundle.
  async transpileTypeScript(code: string): Promise<string> {
    const ts = await import('typescript');
    return ts.transpileModule(code, {
      compilerOptions: { target: ts.ScriptTarget.ES2017 }
    }).outputText;
  }

  private extractBody(html: string): string {
    const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    return match ? match[1] : html;
  }

  private formatArg(arg: any): string {
    if (arg instanceof Error) return arg.message;
    if (arg === null) return 'null';
    if (arg === undefined) return 'undefined';
    if (typeof arg === 'object') {
      try { return JSON.stringify(arg); } catch { return String(arg); }
    }
    return String(arg);
  }

  async runPython(code: string): Promise<PythonRunResult> {
    const pyodide = await this.loadPyodide();
    let stdout = '';
    let stderr = '';

    pyodide.setStdout({ batched: (s: string) => (stdout += s + '\n') });
    pyodide.setStderr({ batched: (s: string) => (stderr += s + '\n') });

    try {
      await pyodide.runPythonAsync(code);
    } catch (error: any) {
      stderr += String(error && error.message ? error.message : error);
    }

    return { stdout, stderr };
  }

  private loadPyodide(): Promise<any> {
    if (this.pyodideInstance) {
      return Promise.resolve(this.pyodideInstance);
    }
    if (this.pyodideLoadingPromise) {
      return this.pyodideLoadingPromise;
    }

    this.pyodideLoadingPromise = new Promise((resolve, reject) => {
      if (typeof loadPyodide !== 'undefined') {
        this.initPyodide().then(resolve, reject);
        return;
      }
      const script = document.createElement('script');
      script.src = PYODIDE_CDN_URL;
      script.onload = () => this.initPyodide().then(resolve, reject);
      script.onerror = () => reject(new Error('Failed to load Pyodide from CDN'));
      document.head.appendChild(script);
    });

    return this.pyodideLoadingPromise;
  }

  private async initPyodide(): Promise<any> {
    this.pyodideInstance = await loadPyodide();
    return this.pyodideInstance;
  }
}
