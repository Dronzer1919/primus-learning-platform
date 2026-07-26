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

  constructor(private sanitizer: DomSanitizer) {}

  // Runs JavaScript directly in the current page (no iframe) and returns the captured
  // console output. Normal logs are prefixed "> "; errors are prefixed "ERROR: " so the
  // console panel can style them. console.* is overridden only for the (synchronous)
  // duration of the run and always restored, so the app's own logging is unaffected.
  //
  // Note: because capture is synchronous, output from async code (setTimeout, promises)
  // that logs AFTER the run returns is not captured here.
  runInPage(js: string): string[] {
    const logs: string[] = [];
    const format = (args: any) =>
      Array.prototype.map.call(args, (arg: any) => this.formatArg(arg)).join(' ');

    const native = {
      log: console.log, info: console.info, warn: console.warn, error: console.error
    };
    console.log = function () { logs.push('> ' + format(arguments)); };
    console.info = function () { logs.push('> ' + format(arguments)); };
    console.warn = function () { logs.push('> ' + format(arguments)); };
    console.error = function () { logs.push('ERROR: ' + format(arguments)); };

    try {
      // eslint-disable-next-line no-new-func
      const run = new Function(js);
      run();
    } catch (error: any) {
      logs.push('ERROR: ' + (error && error.message ? error.message : String(error)));
    } finally {
      console.log = native.log;
      console.info = native.info;
      console.warn = native.warn;
      console.error = native.error;
    }
    return logs;
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
