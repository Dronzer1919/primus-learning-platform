import { Component, Input, Output, EventEmitter, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { SafeHtml } from '@angular/platform-browser';
import { CodeExecutionService } from '../../services/code-execution.service';
import { PLAYGROUND_LANGUAGES, PlaygroundLanguage, PlaygroundModeId } from '../../models/playground.model';
import { CodeEditorComponent } from '../code-editor/code-editor.component';
import { ThemeSelectorComponent } from '../theme-selector/theme-selector.component';
import { JsVisualizerComponent } from '../js-visualizer/js-visualizer.component';
import { AuthService } from '../../services/auth.service';

const DEFAULT_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>My Page</title>
</head>
<body>
  <h1>Hello World!</h1>
  <p>This is a paragraph.</p>
</body>
</html>`;

const DEFAULT_CSS = `body {
  font-family: Arial, sans-serif;
  margin: 0;
  padding: 20px;
}

h1 {
  color: #3880ff;
}`;

const DEFAULT_JS = `// JavaScript code
console.log('Hello from JavaScript!');

document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM is ready!');
});`;

const DEFAULT_JS_ONLY = `// Online Javascript Editor for free
// Write, Edit and Run your JavaScript code using JS Online Compiler

console.log("Start small. Ship something.");`;

const DEFAULT_TS = `// Online TypeScript Editor for free
// Write, Edit and Run your TypeScript code using the TS Online Compiler

const message: string = "Start small. Ship something.";
console.log(message);`;

@Component({
  selector: 'app-playground-workspace',
  templateUrl: './playground-workspace.component.html',
  styleUrls: ['./playground-workspace.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, RouterModule, CodeEditorComponent, ThemeSelectorComponent, JsVisualizerComponent]
})
export class PlaygroundWorkspaceComponent implements OnInit, OnDestroy {
  @Input() mode: PlaygroundModeId = 'web';
  @Input() showModeTabs = true;
  @Input() showHeader = true;
  @Input() showSave = false;
  @Input() sessionUpdatedAt: string | null = null;
  @Output() saveClick = new EventEmitter<void>();

  languages: PlaygroundLanguage[] = PLAYGROUND_LANGUAGES;
  selectedMode: PlaygroundModeId = this.mode;
  isFullscreen = false;
  showConsole = false;

  // Editor resize (web mode only)
  editorWidthPercent = 50;
  private resizing = false;
  private resizeStartX = 0;
  private resizeStartW = 0;
  private resizeHostW = 0;
  private readonly onResizeMoveRef = (e: MouseEvent) => this.onResizeMove(e);
  private readonly onResizeEndRef = () => this.onResizeEnd();

  // Web Project (HTML/CSS/JS) state
  htmlCode = DEFAULT_HTML;
  cssCode = DEFAULT_CSS;
  jsCode = DEFAULT_JS;
  selectedTab: 'html' | 'css' | 'js' = 'html';
  output: SafeHtml = '';
  consoleOutput: string[] = [];

  // JavaScript-only state
  jsOnlyCode = DEFAULT_JS_ONLY;
  jsOnlyOutput: SafeHtml = '';
  jsOnlyConsole: string[] = [];

  // Step-through execution visualizer (swaps in for the console when open).
  showVisualizer = false;
  visualizerCode = '';

  // 🎉 Success feedback. `runSucceeded` persists the "code executed successfully"
  // line until the next run/clear; `showCelebration` is the transient confetti burst.
  runSucceeded = false;
  showCelebration = false;
  confetti: Array<{ left: number; color: string; delay: number; duration: number; drift: number }> = [];
  private celebrationCheckTimer: any = null;
  private celebrationHideTimer: any = null;

  // TypeScript state
  tsCode = DEFAULT_TS;
  tsOutput: SafeHtml = '';
  tsConsole: string[] = [];

  private messageListener = (event: MessageEvent) => this.handleMessage(event);

  constructor(
    private codeExecutionService: CodeExecutionService,
    private toastController: ToastController,
    public authService: AuthService,
    private router: Router
  ) {}

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  ngOnInit(): void {
    this.selectedMode = this.mode;
    window.addEventListener('message', this.messageListener);
  }

  ngOnDestroy(): void {
    window.removeEventListener('message', this.messageListener);
    document.removeEventListener('mousemove', this.onResizeMoveRef);
    document.removeEventListener('mouseup', this.onResizeEndRef);
    clearTimeout(this.celebrationCheckTimer);
    clearTimeout(this.celebrationHideTimer);
  }

  get modeIcon(): string {
    switch (this.selectedMode) {
      case 'javascript':
      case 'typescript':
        return 'logo-javascript';
      case 'web':
      default:
        return 'code-slash-outline';
    }
  }

  get modeTagline(): string {
    switch (this.selectedMode) {
      case 'javascript':
        return 'JavaScript Online Compiler';
      case 'typescript':
        return 'TypeScript Online Compiler';
      case 'web':
      default:
        return 'Web Project Online Compiler';
    }
  }

  get fileLabel(): string {
    switch (this.selectedMode) {
      case 'web':
        return this.selectedTab === 'html' ? 'index.html' : this.selectedTab === 'css' ? 'style.css' : 'script.js';
      case 'typescript':
        return 'main.ts';
      case 'javascript':
      default:
        return 'main.js';
    }
  }

  selectMode(id: PlaygroundModeId): void {
    const lang = this.languages.find((l) => l.id === id);
    if (!lang) {
      return;
    }
    if (lang.locked) {
      this.showLockedToast(lang.lockedMessage ?? 'This language is not available yet.');
      return;
    }
    this.selectedMode = id;
  }

  selectTab(tab: 'html' | 'css' | 'js'): void {
    this.selectedTab = tab;
  }

  toggleFullscreen(): void {
    this.isFullscreen = !this.isFullscreen;
  }

  formatSessionDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  startResize(event: MouseEvent): void {
    event.preventDefault();
    this.resizing = true;
    this.resizeStartX = event.clientX;
    this.resizeStartW = this.editorWidthPercent;
    this.resizeHostW = (event.currentTarget as HTMLElement).parentElement?.offsetWidth ?? 800;
    document.addEventListener('mousemove', this.onResizeMoveRef);
    document.addEventListener('mouseup', this.onResizeEndRef);
  }

  private onResizeMove(event: MouseEvent): void {
    if (!this.resizing) return;
    const dx = event.clientX - this.resizeStartX;
    const dPercent = (dx / this.resizeHostW) * 100;
    // Min 25%, max 75% (= 125% of default 50%)
    this.editorWidthPercent = Math.min(75, Math.max(25, this.resizeStartW + dPercent));
  }

  private onResizeEnd(): void {
    this.resizing = false;
    document.removeEventListener('mousemove', this.onResizeMoveRef);
    document.removeEventListener('mouseup', this.onResizeEndRef);
  }

  runCode(): void {
    this.consoleOutput = [];
    this.output = this.codeExecutionService.runWebProject(this.htmlCode, this.cssCode, this.jsCode);
    this.scheduleCelebration(() => this.consoleOutput);
  }

  clearCode(): void {
    this.htmlCode = '';
    this.cssCode = '';
    this.jsCode = '';
    this.output = '';
    this.consoleOutput = [];
    this.runSucceeded = false;
    this.showCelebration = false;
  }

  resetCode(): void {
    this.htmlCode = DEFAULT_HTML;
    this.cssCode = DEFAULT_CSS;
    this.jsCode = DEFAULT_JS;
    this.output = '';
    this.consoleOutput = [];
  }

  runJavaScriptOnly(): void {
    this.jsOnlyConsole = [];
    this.jsOnlyOutput = this.codeExecutionService.runJavaScript(this.jsOnlyCode);
    this.scheduleCelebration(() => this.jsOnlyConsole);
  }

  clearJavaScriptOutput(): void {
    this.jsOnlyConsole = [];
    this.jsOnlyOutput = '';
    this.runSucceeded = false;
    this.showCelebration = false;
  }

  /** Opens the step-through visualizer for the current JavaScript code. */
  visualizeJavaScript(): void {
    this.visualizerCode = this.jsOnlyCode;
    this.showVisualizer = true;
  }

  closeVisualizer(): void {
    this.showVisualizer = false;
  }

  async runTypeScript(): Promise<void> {
    this.tsConsole = [];
    try {
      this.tsOutput = await this.codeExecutionService.runTypeScript(this.tsCode);
      this.scheduleCelebration(() => this.tsConsole);
    } catch (error: any) {
      this.tsConsole.push('ERROR: ' + (error?.message ?? 'Failed to compile TypeScript.'));
    }
  }

  // Waits briefly for console/error output to arrive (logs come async via postMessage),
  // then celebrates only if no error line showed up for that panel.
  private scheduleCelebration(getConsole: () => string[]): void {
    // A fresh run clears the previous success line until this run proves clean.
    this.runSucceeded = false;
    this.showCelebration = false;
    clearTimeout(this.celebrationCheckTimer);
    this.celebrationCheckTimer = setTimeout(() => {
      const hasError = getConsole().some((line) => this.isErrorLine(line));
      if (!hasError) {
        this.triggerCelebration();
      }
    }, 500);
  }

  private triggerCelebration(): void {
    this.runSucceeded = true; // persists until the next run/clear
    const colors = ['#2dd4a7', '#58a6ff', '#f0b429', '#e5484d', '#8b5cf6', '#ec4899'];
    this.confetti = Array.from({ length: 30 }, (_, i) => ({
      left: Math.round(Math.random() * 100),
      color: colors[i % colors.length],
      delay: Math.round(Math.random() * 250) / 1000,
      duration: 1.1 + Math.round(Math.random() * 700) / 1000,
      drift: Math.round((Math.random() * 2 - 1) * 70)
    }));
    this.showCelebration = true;
    clearTimeout(this.celebrationHideTimer);
    this.celebrationHideTimer = setTimeout(() => (this.showCelebration = false), 1900);
  }

  clearTypeScriptOutput(): void {
    this.tsConsole = [];
    this.tsOutput = '';
    this.runSucceeded = false;
    this.showCelebration = false;
  }

  async shareCode(): Promise<void> {
    const toast = await this.toastController.create({
      message: 'Sharing requires a backend service — coming soon.',
      duration: 2000,
      color: 'medium',
      position: 'bottom'
    });
    toast.present();
  }

  private handleMessage(event: MessageEvent): void {
    const data = event.data;
    if (!data || (data.type !== 'console' && data.type !== 'error')) {
      return;
    }

    const line = data.type === 'error'
      ? this.formatError(data.data, data.source, data.line, data.column)
      : '> ' + data.data;

    if (data.source === 'javascript') {
      this.jsOnlyConsole.push(line);
    } else if (data.source === 'typescript') {
      this.tsConsole.push(line);
    } else {
      this.consoleOutput.push(line);
    }
  }

  // Renders a Node-style code frame pointing at the failing token, e.g.
  //
  //   ERROR!
  //   main.js:2
  //   let result = str.split(');
  //                          ^
  //
  //   SyntaxError: Invalid or unexpected token
  //
  // Errors without a position (console.error, cross-origin failures) fall back
  // to a single labelled line.
  private formatError(message: string, source: string, line?: number, column?: number): string {
    if (!line || line < 1) {
      return 'ERROR: ' + message;
    }

    const isTs = source === 'typescript';
    const fileName = isTs ? 'main.ts' : 'main.js';
    const sourceCode = isTs ? this.tsCode : source === 'javascript' ? this.jsOnlyCode : this.jsCode;
    const failingLine = sourceCode.split('\n')[line - 1];

    const frame = ['ERROR!', `${fileName}:${line}`];

    if (failingLine !== undefined) {
      frame.push(failingLine);
      if (column && column > 0) {
        // Reuse the line's own tabs so the caret stays aligned under the token.
        const indent = failingLine.slice(0, column - 1).replace(/[^\t]/g, ' ');
        frame.push(indent + '^');
      }
    }

    frame.push('', message);
    return frame.join('\n');
  }

  isErrorLine(log: string): boolean {
    return log.startsWith('ERROR!') || log.startsWith('ERROR: ');
  }

  // Multi-line code frames (a SyntaxError with a caret) must keep their alignment,
  // so only these scroll sideways. Plain 'ERROR: ' messages wrap normally.
  isErrorFrame(log: string): boolean {
    return log.startsWith('ERROR!');
  }

  private async showLockedToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2500,
      color: 'medium',
      position: 'bottom'
    });
    toast.present();
  }
}
