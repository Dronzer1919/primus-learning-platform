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
import { BackButtonComponent } from '../back-button/back-button.component';
import { AuthService } from '../../services/auth.service';
import { NavHistoryService } from '../../services/nav-history.service';

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
  imports: [IonicModule, CommonModule, RouterModule, CodeEditorComponent, ThemeSelectorComponent, JsVisualizerComponent, BackButtonComponent]
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

  /**
   * Phone chrome: an app bar + hamburger drawer + bottom action bar replace the language
   * rail, the header and both toolbar button groups. That is a different element tree,
   * not a restyling of the desktop one, so it is driven from here rather than from CSS —
   * `md` is the same boundary the stylesheet uses to fold the rail away.
   */
  private static readonly MOBILE_QUERY = '(max-width: 768px)';
  isMobile = false;
  mobileMenuOpen = false;
  /** Mobile action bar: the last-tapped item carries the highlight pill. */
  activeBarItem: 'run' | 'save' | 'console' | 'reset' | 'visualize' | 'clear' = 'run';
  private mobileMql: MediaQueryList | null = null;
  private readonly onMobileChangeRef = (e: MediaQueryListEvent) => {
    this.ngZone.run(() => {
      this.isMobile = e.matches;
      if (!e.matches) {
        this.mobileMenuOpen = false;
      }
    });
  };

  // Editor/output split. Side by side it is a width; stacked (below `lg`) it is a
  // height, which stays null until the user first drags so the CSS defaults apply.
  editorWidthPercent = 50;
  editorHeightPercent: number | null = null;
  private resizing = false;
  private resizeAxis: 'x' | 'y' = 'x';
  private resizeStart = 0;
  private resizeStartSize = 0;
  private resizeHostSize = 0;
  private readonly onResizeMoveRef = (e: PointerEvent) => this.onResizeMove(e);
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
    private navHistory: NavHistoryService,
    private router: Router,
    private ngZone: NgZone
  ) {}

  /**
   * The drawer is the workspace's navigation on a phone, and the app bar's hamburger is
   * the only thing that opens it — so where the host page suppresses the header (the
   * sessions page embeds the workspace under its own chrome), rendering the panel would
   * leave it unreachable.
   */
  get showMobileDrawer(): boolean {
    return this.isMobile && this.showHeader;
  }

  /** True while this workspace is the app's root route, where there is no "back". */
  private get isRootRoute(): boolean {
    return this.router.url.split('?')[0].split('#')[0] === '/';
  }

  /**
   * The root playground only offers a back control once the visitor has actually been
   * somewhere in the app; every other route the workspace serves always offers one.
   */
  get showBackButton(): boolean {
    return !this.isRootRoute || this.navHistory.canGoBack;
  }

  /** Where back lands when this page was the entry point (deep link, new tab). */
  get backHref(): string {
    return this.isRootRoute ? '/' : this.authService.isAuthenticated() ? '/user/home' : '/';
  }

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

      this.mobileMql = window.matchMedia(PlaygroundWorkspaceComponent.MOBILE_QUERY);
      this.isMobile = this.mobileMql.matches;
      this.mobileMql.addEventListener('change', this.onMobileChangeRef);
    }
  }

  ngOnDestroy(): void {
    document.removeEventListener('pointermove', this.onResizeMoveRef);
    document.removeEventListener('pointerup', this.onResizeEndRef);
    document.removeEventListener('pointercancel', this.onResizeEndRef);
    this.accordionMql?.removeEventListener('change', this.onAccordionChangeRef);
    this.mobileMql?.removeEventListener('change', this.onMobileChangeRef);
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

  /**
   * Signed-in users' sessions live on the backend; signed-out visitors' saves live on
   * this device only — same list UI, different route (see app.routes.ts).
   */
  get sessionsLink(): string {
    return this.authService.isAuthenticated() ? '/user/playground-sessions' : '/playground-sessions';
  }

  /** Console lines belonging to whichever mode is on screen. */
  private get activeConsole(): string[] {
    switch (this.selectedMode) {
      case 'javascript':
        return this.jsOnlyConsole;
      case 'typescript':
        return this.tsConsole;
      case 'web':
      default:
        return this.consoleOutput;
    }
  }

  /**
   * Drives the mobile panel header's status dot. Stacked panes mean the editor often
   * hides the output entirely, so the header has to say whether the last run produced
   * anything and whether it failed.
   */
  get outputStatus(): 'idle' | 'ready' | 'error' {
    if (this.activeConsole.some((line) => this.isErrorLine(line))) {
      return 'error';
    }
    return this.activeConsole.length > 0 || !!this.output ? 'ready' : 'idle';
  }

  get outputStatusLabel(): string {
    switch (this.outputStatus) {
      case 'error':
        return 'Error';
      case 'ready':
        return 'Ready';
      default:
        return 'Idle';
    }
  }

  /** Run button in the mobile action bar — one control for all three modes. */
  runActiveMode(): void {
    switch (this.selectedMode) {
      case 'javascript':
        this.runJavaScriptOnly();
        break;
      case 'typescript':
        this.runTypeScript();
        break;
      case 'web':
      default:
        this.runCode();
        break;
    }
  }

  /** A locked language keeps the drawer open so its toast lands next to the tapped row. */
  selectModeFromDrawer(lang: PlaygroundLanguage): void {
    this.selectMode(lang.id);
    if (!lang.locked) {
      this.mobileMenuOpen = false;
    }
  }

  /** "Clear all" in the mobile action bar — one control for all three modes, like Run. */
  clearActiveMode(): void {
    switch (this.selectedMode) {
      case 'javascript':
        this.clearJavaScriptOutput();
        this.jsOnlyCode = '';
        break;
      case 'typescript':
        this.clearTypeScriptOutput();
        this.tsCode = '';
        break;
      case 'web':
      default:
        this.clearCode();
        break;
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

  /**
   * Pointer events (not mouse events) so dragging the divider resizes the split
   * from a finger drag too — `touch-action: none` on `.resize-divider` stops the
   * page from scrolling underneath it, same pattern as the flowchart's handles.
   *
   * The axis follows the layout: a row split drags sideways, a stacked (column)
   * split drags up and down.
   */
  startResize(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    const divider = event.currentTarget as HTMLElement;
    const host = divider.parentElement;
    if (!host) {
      return;
    }
    event.preventDefault();
    const hostStyle = getComputedStyle(host);
    this.resizing = true;

    if (hostStyle.flexDirection.startsWith('column')) {
      const editor = divider.previousElementSibling as HTMLElement | null;
      this.resizeAxis = 'y';
      this.resizeStart = event.clientY;
      this.resizeHostSize = host.clientHeight
        - parseFloat(hostStyle.paddingTop) - parseFloat(hostStyle.paddingBottom);
      this.resizeStartSize = this.editorHeightPercent
        ?? ((editor?.offsetHeight ?? this.resizeHostSize / 2) / this.resizeHostSize) * 100;
    } else {
      this.resizeAxis = 'x';
      this.resizeStart = event.clientX;
      this.resizeHostSize = host.offsetWidth || 800;
      this.resizeStartSize = this.editorWidthPercent;
    }

    document.addEventListener('pointermove', this.onResizeMoveRef);
    document.addEventListener('pointerup', this.onResizeEndRef);
    document.addEventListener('pointercancel', this.onResizeEndRef);
  }

  private onResizeMove(event: PointerEvent): void {
    if (!this.resizing || this.resizeHostSize <= 0) return;
    if (this.resizeAxis === 'y') {
      const dPercent = ((event.clientY - this.resizeStart) / this.resizeHostSize) * 100;
      // Keep a few lines of each pane on screen.
      this.editorHeightPercent = Math.min(85, Math.max(15, this.resizeStartSize + dPercent));
    } else {
      const dPercent = ((event.clientX - this.resizeStart) / this.resizeHostSize) * 100;
      // Min 25%, max 75% (= 125% of default 50%)
      this.editorWidthPercent = Math.min(75, Math.max(25, this.resizeStartSize + dPercent));
    }
  }

  private onResizeEnd(): void {
    this.resizing = false;
    document.removeEventListener('pointermove', this.onResizeMoveRef);
    document.removeEventListener('pointerup', this.onResizeEndRef);
    document.removeEventListener('pointercancel', this.onResizeEndRef);
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
