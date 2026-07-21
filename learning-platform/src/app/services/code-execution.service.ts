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

  runWebProject(html: string, css: string, js: string): SafeHtml {
    const doc = this.buildIframeDoc(html, css, js, 'web');
    return this.sanitizer.bypassSecurityTrustHtml(doc);
  }

  runJavaScript(js: string): SafeHtml {
    const doc = this.buildIframeDoc('', '', js, 'javascript');
    return this.sanitizer.bypassSecurityTrustHtml(doc);
  }

  // Transpiles TypeScript to JavaScript in the browser, then runs it through the same
  // sandboxed-iframe path as plain JS. `typescript` is dynamically imported so it lands in
  // its own lazy chunk instead of the initial bundle.
  async runTypeScript(code: string): Promise<SafeHtml> {
    const ts = await import('typescript');
    const js = ts.transpileModule(code, {
      compilerOptions: { target: ts.ScriptTarget.ES2017 }
    }).outputText;
    const doc = this.buildIframeDoc('', '', js, 'typescript');
    return this.sanitizer.bypassSecurityTrustHtml(doc);
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

  // Builds a self-contained HTML document that overrides console.log so output can be
  // captured via postMessage from inside the sandboxed iframe. `source` tags each message
  // so a single shared window 'message' listener can route logs to the right console panel.
  //
  // The user's code deliberately lives in its OWN <script> tag, separate from the setup
  // script and NOT wrapped in try/catch. A syntax error aborts parsing of the whole script
  // it appears in, so a surrounding try/catch would never run — which is why syntax errors
  // used to surface only in the browser devtools. Keeping the handlers in an earlier script
  // means they survive a broken user script and can report it via the 'error' event, which
  // fires for both syntax and runtime errors and carries a line/column number.
  private buildIframeDoc(bodyHtml: string, css: string, js: string, source: 'web' | 'javascript' | 'typescript'): string {
    // Inline script line numbers are document-relative, so we subtract the number of lines
    // that precede the user's first line to map positions back to the editor's numbering.
    const prefix = `<!DOCTYPE html>
<html>
<head>
<style>${css}</style>
</head>
<body>
${bodyHtml}
<script>
(function() {
  var OFFSET = __USER_CODE_LINE_OFFSET__;

  function post(type, data, position) {
    var message = { type: type, source: '${source}', data: data };
    if (position) {
      message.line = position.line;
      message.column = position.column;
    }
    window.parent.postMessage(message, '*');
  }

  function format(args) {
    return Array.prototype.map.call(args, function(arg) {
      if (arg instanceof Error) { return arg.message; }
      if (typeof arg === 'object' && arg !== null) {
        try { return JSON.stringify(arg); } catch (e) { return String(arg); }
      }
      return String(arg);
    }).join(' ');
  }

  var originalLog = console.log;
  console.log = function() {
    post('console', format(arguments));
    originalLog.apply(console, arguments);
  };

  var originalError = console.error;
  console.error = function() {
    post('error', format(arguments));
    originalError.apply(console, arguments);
  };

  // Fires for uncaught runtime errors AND for syntax errors in the user's script.
  window.addEventListener('error', function(event) {
    var message = event.message || 'Unknown error';
    // Browsers prefix uncaught errors; the console panel adds its own label.
    message = message.replace(/^Uncaught\\s+/, '');

    // The console panel renders a code frame from these, so no position is
    // appended to the message itself.
    var line = typeof event.lineno === 'number' ? event.lineno - OFFSET : 0;
    post('error', message, line > 0 ? { line: line, column: event.colno || 0 } : null);
  });

  window.addEventListener('unhandledrejection', function(event) {
    var reason = event.reason;
    var message = reason && reason.message ? reason.message : String(reason);
    post('error', 'Uncaught (in promise) ' + message);
  });
})();
</script>
<script>
`;

    const offset = prefix.split('\n').length - 1;

    return prefix.replace('__USER_CODE_LINE_OFFSET__', String(offset)) + js + `
</script>
</body>
</html>`;
  }
}
