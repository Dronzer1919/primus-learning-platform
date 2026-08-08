import { Component, Input, Output, EventEmitter, NgZone, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { SafeHtml } from '@angular/platform-browser';
import { CodeExecutionService } from '../../services/code-execution.service';
import { PLAYGROUND_LANGUAGES, PlaygroundLanguage, PlaygroundModeId } from '../../models/playground.model';
import { CodeEditorComponent } from '../code-editor/code-editor.component';
import { ThemeSelectorComponent } from '../theme-selector/theme-selector.component';
import { JsVisualizerComponent, VizSection } from '../js-visualizer/js-visualizer.component';
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
  jsOnlyConsole: string[] = [];

  // Step-through execution visualizer (swaps in for the console when open).
  showVisualizer = false;
  visualizerCode = '';

  /**
   * Mobile accordion for the visualizer. Active exactly where the workspace stacks its
   * panes (see the `lg` / short-viewport rules in the stylesheet) — the accordion exists
   * to solve the vertical squeeze that stacking creates, so the two must agree.
   */
  private static readonly ACCORDION_QUERY = '(max-width: 992px) and (min-height: 521px)';
  mobileAccordion = false;
  /**
   * Expanded accordion sections; 'code' is this component's own editor pane. Open
   * sections split the height evenly, so the default shows the trace and its variables
   * half and half.
   */
  openSections: VizSection[] = ['flow', 'memory'];
  private accordionMql: MediaQueryList | null = null;
  private readonly onAccordionChangeRef = (e: MediaQueryListEvent) => {
    this.mobileAccordion = e.matches;
  };

  // 🎉 Success feedback. `runSucceeded` persists the "code executed successfully"
  // line until the next run/clear; `showCelebration` is the transient confetti burst.
  runSucceeded = false;
  showCelebration = false;
  confetti: Array<{ left: number; color: string; delay: number; duration: number; drift: number }> = [];
  private celebrationCheckTimer: any = null;
  private celebrationHideTimer: any = null;
  // True once this run has celebrated. Async output (setTimeout, promises) can keep
  // arriving well after that first decision — without this flag, each burst of output
  // that goes quiet for 500ms would retrigger a fresh confetti burst.
  private celebrated = false;

  // TypeScript state
  tsCode = DEFAULT_TS;
  tsConsole: string[] = [];

  constructor(
    private codeExecutionService: CodeExecutionService,
    private toastController: ToastController,
    public authService: AuthService,
    private router: Router,
    private ngZone: NgZone
  ) {}

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/'], { replaceUrl: true });
  }

  ngOnInit(): void {
    this.selectedMode = this.mode;

    if (typeof window !== 'undefined' && window.matchMedia) {
      this.accordionMql = window.matchMedia(PlaygroundWorkspaceComponent.ACCORDION_QUERY);
      this.mobileAccordion = this.accordionMql.matches;
      this.accordionMql.addEventListener('change', this.onAccordionChangeRef);
    }
  }

  ngOnDestroy(): void {
    document.removeEventListener('mousemove', this.onResizeMoveRef);
    document.removeEventListener('mouseup', this.onResizeEndRef);
    this.accordionMql?.removeEventListener('change', this.onAccordionChangeRef);
    clearTimeout(this.celebrationCheckTimer);
    clearTimeout(this.celebrationHideTimer);
    this.codeExecutionService.stopCapture();
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
    this.celebrated = false;
    // Render the HTML/CSS into the in-page preview container (no iframe).
    this.output = this.codeExecutionService.buildWebMarkup(this.htmlCode, this.cssCode);
    // Run the JS after Angular paints the markup so document queries resolve.
    setTimeout(() => {
      this.consoleOutput = this.codeExecutionService.runInPage(this.jsCode, () => this.scheduleCelebration(() => this.consoleOutput));
      this.scheduleCelebration(() => this.consoleOutput);
    });
  }

  clearCode(): void {
    this.htmlCode = '';
    this.cssCode = '';
    this.jsCode = '';
    this.output = '';
    this.consoleOutput = [];
    this.runSucceeded = false;
    this.showCelebration = false;
    this.celebrated = false;
    this.codeExecutionService.stopCapture();
  }

  resetCode(): void {
    this.htmlCode = DEFAULT_HTML;
    this.cssCode = DEFAULT_CSS;
    this.jsCode = DEFAULT_JS;
    this.output = '';
    this.consoleOutput = [];
  }

  runJavaScriptOnly(): void {
    // The output panel is *ngIf-swapped with the visualizer — running new code
    // while the visualizer is open would compute fresh console output behind a
    // still-playing trace of the *previous* code, with no visible sign the run
    // even happened. Closing it switches back to the console panel and (via
    // the visualizer's own ngOnDestroy) stops its play timer.
    this.showVisualizer = false;
    this.celebrated = false;
    this.jsOnlyConsole = this.codeExecutionService.runInPage(this.jsOnlyCode, () => this.scheduleCelebration(() => this.jsOnlyConsole));
    this.scheduleCelebration(() => this.jsOnlyConsole);
  }

  clearJavaScriptOutput(): void {
    this.jsOnlyConsole = [];
    this.runSucceeded = false;
    this.showCelebration = false;
    this.celebrated = false;
    this.codeExecutionService.stopCapture();
  }

  /** Opens the step-through visualizer for the current JavaScript code. */
  visualizeJavaScript(): void {
    this.visualizerCode = this.jsOnlyCode;
    this.showVisualizer = true;
    // The editor starts collapsed: the visualizer shows the same code with the active
    // line highlighted, so the editable copy is the one section worth folding away.
    this.openSections = ['flow', 'memory'];
  }

  closeVisualizer(): void {
    this.showVisualizer = false;
  }

  /** True while `section` is expanded (or whenever the accordion is not in play). */
  isSectionOpen(section: VizSection): boolean {
    return !this.mobileAccordion || this.openSections.includes(section);
  }

  /** Expands `section`, or collapses it if it was already open. */
  toggleSection(section: VizSection): void {
    this.openSections = this.openSections.includes(section)
      ? this.openSections.filter((s) => s !== section)
      : [...this.openSections, section];
  }

  async runTypeScript(): Promise<void> {
    this.tsConsole = [];
    this.celebrated = false;
    try {
      const js = await this.codeExecutionService.transpileTypeScript(this.tsCode);
      this.tsConsole = this.codeExecutionService.runInPage(js, () => this.scheduleCelebration(() => this.tsConsole));
      this.scheduleCelebration(() => this.tsConsole);
    } catch (error: any) {
      this.tsConsole.push('ERROR: ' + (error?.message ?? 'Failed to compile TypeScript.'));
    }
  }

  // Called once right after a run, and again on every subsequent activity (a console line,
  // or a setTimeout scheduled/fired/cancelled by the run's own code — see
  // CodeExecutionService.runInPage). Before the first decision is made, each call hides the
  // success line and restarts the 500ms debounce, so it only shows once activity has gone
  // quiet for 500ms with no error line AND no timers left pending — never mid-stream while
  // a setTimeout/promise chain is still running (e.g. `await sleep(2500)` followed by more
  // code). Once decided, later activity no longer retriggers the celebration; it only
  // revokes an already-shown success if a late line turns out to be an error.
  //
  // Wrapped in NgZone.run(): this app's dev build doesn't patch window.setTimeout (plain
  // `setTimeout` callbacks land in the root zone here, not Angular's), and the run's own
  // async output arrives via exactly such callbacks — so without an explicit run(), neither
  // the console lines nor this celebration state would trigger change detection at all.
  private scheduleCelebration(getConsole: () => string[]): void {
    this.ngZone.run(() => {
      if (this.celebrated) {
        if (getConsole().some((line) => this.isErrorLine(line))) {
          this.runSucceeded = false;
          this.showCelebration = false;
        }
        return;
      }

      // A fresh run clears the previous success line until this run proves clean.
      this.runSucceeded = false;
      this.showCelebration = false;
      clearTimeout(this.celebrationCheckTimer);
      this.celebrationCheckTimer = setTimeout(() => {
        this.ngZone.run(() => {
          const hasError = getConsole().some((line) => this.isErrorLine(line));
          const stillPending = this.codeExecutionService.getPendingTimerCount() > 0;
          if (!hasError && !stillPending) {
            this.celebrated = true;
            this.triggerCelebration();
          }
          // If timers are still pending, no new check is scheduled here — the next
          // setTimeout firing/scheduling will call back into this method via onActivity.
        });
      }, 500);
    });
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
    // See the note on scheduleCelebration: this callback also needs an explicit run() to be
    // seen by change detection.
    this.celebrationHideTimer = setTimeout(() => this.ngZone.run(() => (this.showCelebration = false)), 1900);
  }

  clearTypeScriptOutput(): void {
    this.tsConsole = [];
    this.runSucceeded = false;
    this.showCelebration = false;
    this.celebrated = false;
    this.codeExecutionService.stopCapture();
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

  isErrorLine(log: string): boolean {
    return log.startsWith('ERROR!') || log.startsWith('ERROR: ');
  }

  // Kept for the console template: multi-line code frames (ERROR!) scroll sideways;
  // plain 'ERROR: ' messages wrap. In-page runs only produce the latter.
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
