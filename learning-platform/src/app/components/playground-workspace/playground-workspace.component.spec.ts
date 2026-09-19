import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { PlaygroundWorkspaceComponent } from './playground-workspace.component';
import { CodeExecutionService } from '../../services/code-execution.service';
import { AuthService } from '../../services/auth.service';
import { NavHistoryService } from '../../services/nav-history.service';

describe('PlaygroundWorkspaceComponent', () => {
  let fixture: ComponentFixture<PlaygroundWorkspaceComponent>;
  let component: PlaygroundWorkspaceComponent;
  let codeExecutionService: jasmine.SpyObj<CodeExecutionService>;
  let authService: jasmine.SpyObj<AuthService>;
  let navHistory: jasmine.SpyObj<NavHistoryService>;
  let toastController: jasmine.SpyObj<ToastController>;
  let router: Router;

  beforeEach(async () => {
    // CodeEditorComponent (real CodeMirror) and JsVisualizerComponent (real acorn tracer)
    // each already have their own dedicated, thorough spec files, and both proved cheap to
    // construct there (well under a second for their whole suites) — so unlike the heavier
    // PlaygroundSessionsComponent in Module 2, there's no need to stub them out here. They
    // render for real, which also means @ViewChild(..., { static: true }) inside
    // CodeEditorComponent resolves normally instead of needing a hand-built stub template.
    codeExecutionService = jasmine.createSpyObj<CodeExecutionService>('CodeExecutionService', [
      'runInPage', 'getPendingTimerCount', 'stopCapture', 'buildWebMarkup', 'transpileTypeScript', 'runPython'
    ]);
    codeExecutionService.runInPage.and.returnValue([]);
    codeExecutionService.getPendingTimerCount.and.returnValue(0);
    codeExecutionService.buildWebMarkup.and.returnValue('<h1>ok</h1>' as any);

    authService = jasmine.createSpyObj<AuthService>('AuthService', ['isAuthenticated', 'logout']);
    navHistory = jasmine.createSpyObj<NavHistoryService>('NavHistoryService', ['back'], { canGoBack: false });
    toastController = jasmine.createSpyObj<ToastController>('ToastController', ['create']);
    toastController.create.and.resolveTo({ present: jasmine.createSpy().and.resolveTo() } as any);

    await TestBed.configureTestingModule({
      imports: [PlaygroundWorkspaceComponent],
      providers: [
        provideRouter([]),
        { provide: CodeExecutionService, useValue: codeExecutionService },
        { provide: AuthService, useValue: authService },
        { provide: NavHistoryService, useValue: navHistory },
        { provide: ToastController, useValue: toastController }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);

    // ngOnInit() reads window.matchMedia for both the mobile and accordion breakpoints and
    // assigns straight into isMobile/mobileAccordion, overwriting anything set on the
    // component beforehand. Headless Chrome's actual viewport in this CI/CLI context matches
    // "(max-width: 768px)", which silently made every "desktop" rendering assertion below
    // fail against real browser dimensions rather than the component's own logic — stub it
    // to a deterministic desktop-sized result so tests exercise the inputs they claim to.
    spyOn(window, 'matchMedia').and.callFake(
      (query: string) =>
        ({
          matches: false,
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {}
        }) as unknown as MediaQueryList
    );

    fixture = TestBed.createComponent(PlaygroundWorkspaceComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture?.destroy());

  // ---------- Rendering ----------
  describe('rendering', () => {
    it('creates', () => {
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('shows the desktop header when showHeader is true and not mobile', () => {
      component.showHeader = true;
      component.isMobile = false;
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.compiler-header')).toBeTruthy();
    });

    it('hides the desktop header when showHeader is false', () => {
      component.showHeader = false;
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.compiler-header')).toBeNull();
    });

    it('shows the language rail only when showModeTabs is true and not mobile', () => {
      component.showModeTabs = true;
      component.isMobile = false;
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.rail')).toBeTruthy();
    });

    it('hides the language rail when showModeTabs is false', () => {
      component.showModeTabs = false;
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.rail')).toBeNull();
    });

    it('renders the save button only when showSave is true (web mode)', () => {
      component.showSave = true;
      component.selectedMode = 'web';
      fixture.detectChanges();
      const saveButtons = Array.from(fixture.nativeElement.querySelectorAll('ion-button')) as HTMLElement[];
      expect(saveButtons.some((b) => b.textContent?.includes('Save'))).toBeTrue();
    });
  });

  // ---------- getters ----------
  describe('computed getters', () => {
    beforeEach(() => fixture.detectChanges());

    it('modeIcon/modeTagline/fileLabel reflect the selected mode (web)', () => {
      component.selectedMode = 'web';
      component.selectedTab = 'css';
      expect(component.modeIcon).toBe('code-slash-outline');
      expect(component.modeTagline).toContain('Web Project');
      expect(component.fileLabel).toBe('style.css');
    });

    it('modeIcon/modeTagline/fileLabel reflect javascript mode', () => {
      component.selectedMode = 'javascript';
      expect(component.modeIcon).toBe('logo-javascript');
      expect(component.modeTagline).toContain('JavaScript');
      expect(component.fileLabel).toBe('main.js');
    });

    it('modeIcon/modeTagline/fileLabel reflect typescript mode', () => {
      component.selectedMode = 'typescript';
      expect(component.modeTagline).toContain('TypeScript');
      expect(component.fileLabel).toBe('main.ts');
    });

    it('sessionsLink points to the account list when authenticated', () => {
      authService.isAuthenticated.and.returnValue(true);
      expect(component.sessionsLink).toBe('/user/playground-sessions');
    });

    it('sessionsLink points to the guest (public) list when not authenticated', () => {
      authService.isAuthenticated.and.returnValue(false);
      expect(component.sessionsLink).toBe('/playground-sessions');
    });

    it('outputStatus is "idle" with no output and empty console', () => {
      component.consoleOutput = [];
      component.output = '';
      expect(component.outputStatus).toBe('idle');
    });

    it('outputStatus is "ready" once there is console output', () => {
      component.consoleOutput = ['> hi'];
      expect(component.outputStatus).toBe('ready');
      expect(component.outputStatusLabel).toBe('Ready');
    });

    it('outputStatus is "error" when the active console has an error line', () => {
      component.consoleOutput = ['ERROR: bad'];
      expect(component.outputStatus).toBe('error');
      expect(component.outputStatusLabel).toBe('Error');
    });

    it('backHref is "/" while on the root route', () => {
      spyOnProperty(router, 'url', 'get').and.returnValue('/');
      expect(component.backHref).toBe('/');
    });

    it('backHref points to /user/home for an authenticated user off the root route', () => {
      spyOnProperty(router, 'url', 'get').and.returnValue('/user/playground');
      authService.isAuthenticated.and.returnValue(true);
      expect(component.backHref).toBe('/user/home');
    });

    it('backHref points to "/" for a guest off the root route', () => {
      spyOnProperty(router, 'url', 'get').and.returnValue('/user/playground');
      authService.isAuthenticated.and.returnValue(false);
      expect(component.backHref).toBe('/');
    });

    it('showBackButton is false on the root route with no in-app history', () => {
      spyOnProperty(router, 'url', 'get').and.returnValue('/');
      expect(component.showBackButton).toBeFalse();
    });

    it('showBackButton is true off the root route regardless of history', () => {
      spyOnProperty(router, 'url', 'get').and.returnValue('/flowchart');
      expect(component.showBackButton).toBeTrue();
    });
  });

  // ---------- mode / tab selection ----------
  describe('selectMode()', () => {
    beforeEach(() => fixture.detectChanges());

    it('switches to an unlocked mode', () => {
      component.selectMode('javascript');
      expect(component.selectedMode).toBe('javascript');
    });

    it('ignores an unknown mode id', () => {
      component.selectedMode = 'web';
      component.selectMode('nonexistent' as any);
      expect(component.selectedMode).toBe('web');
    });

    it('shows a toast and does not switch for a locked language', () => {
      component.languages = [
        ...component.languages,
        { id: 'python' as any, label: 'Python', icon: 'x', multiFile: false, locked: true, lockedMessage: 'Coming soon' }
      ];
      component.selectedMode = 'web';
      component.selectMode('python' as any);
      expect(component.selectedMode).toBe('web');
      expect(toastController.create).toHaveBeenCalledWith(jasmine.objectContaining({ message: 'Coming soon' }));
    });
  });

  describe('selectTab()', () => {
    it('switches the active web-mode file tab', () => {
      fixture.detectChanges();
      component.selectTab('css');
      expect(component.selectedTab).toBe('css');
    });
  });

  // ---------- runCode() (web mode) ----------
  describe('runCode()', () => {
    beforeEach(() => fixture.detectChanges());

    it('builds the HTML/CSS preview via CodeExecutionService', fakeAsync(() => {
      component.htmlCode = '<h1>hi</h1>';
      component.cssCode = 'h1{color:red}';
      component.runCode();
      expect(codeExecutionService.buildWebMarkup).toHaveBeenCalledWith('<h1>hi</h1>', 'h1{color:red}');
      tick();
    }));

    it('runs the JS after the markup paints and populates consoleOutput', fakeAsync(() => {
      codeExecutionService.runInPage.and.returnValue(['> hello']);
      component.jsCode = "console.log('hello')";
      component.runCode();
      tick(); // flush the setTimeout(0) inside runCode()
      expect(component.consoleOutput).toEqual(['> hello']);
    }));

    it('clears any previous console output immediately (before the async run)', () => {
      component.consoleOutput = ['stale'];
      component.runCode();
      expect(component.consoleOutput).toEqual([]);
    });
  });

  describe('clearCode() / resetCode()', () => {
    beforeEach(() => fixture.detectChanges());

    it('clearCode() empties all web-mode state and stops capture', () => {
      component.htmlCode = 'x';
      component.cssCode = 'y';
      component.jsCode = 'z';
      component.output = 'out' as any;
      component.consoleOutput = ['a'];
      component.runSucceeded = true;

      component.clearCode();

      expect(component.htmlCode).toBe('');
      expect(component.cssCode).toBe('');
      expect(component.jsCode).toBe('');
      expect(component.output).toBe('');
      expect(component.consoleOutput).toEqual([]);
      expect(component.runSucceeded).toBeFalse();
      expect(codeExecutionService.stopCapture).toHaveBeenCalled();
    });

    it('resetCode() restores the default starter code, not blank code', () => {
      component.clearCode();
      component.resetCode();
      expect(component.htmlCode).toContain('Hello World');
      expect(component.cssCode).toContain('font-family');
      expect(component.jsCode).toContain('Hello from JavaScript');
    });
  });

  // ---------- JavaScript-only mode ----------
  describe('runJavaScriptOnly()', () => {
    beforeEach(() => fixture.detectChanges());

    it('closes the visualizer before running (so a stale trace is never left open)', () => {
      component.showVisualizer = true;
      codeExecutionService.runInPage.and.returnValue([]);
      component.runJavaScriptOnly();
      expect(component.showVisualizer).toBeFalse();
    });

    it('populates jsOnlyConsole from the run', () => {
      codeExecutionService.runInPage.and.returnValue(['> out']);
      component.runJavaScriptOnly();
      expect(component.jsOnlyConsole).toEqual(['> out']);
    });
  });

  describe('clearJavaScriptOutput()', () => {
    it('empties jsOnlyConsole and stops capture', () => {
      fixture.detectChanges();
      component.jsOnlyConsole = ['x'];
      component.clearJavaScriptOutput();
      expect(component.jsOnlyConsole).toEqual([]);
      expect(codeExecutionService.stopCapture).toHaveBeenCalled();
    });
  });

  // ---------- TypeScript mode ----------
  describe('runTypeScript()', () => {
    beforeEach(() => fixture.detectChanges());

    it('transpiles then runs the compiled JS, populating tsConsole', async () => {
      codeExecutionService.transpileTypeScript.and.resolveTo('console.log("compiled")');
      codeExecutionService.runInPage.and.returnValue(['> compiled']);

      await component.runTypeScript();

      expect(codeExecutionService.transpileTypeScript).toHaveBeenCalledWith(component.tsCode);
      expect(component.tsConsole).toEqual(['> compiled']);
    });

    it('pushes an ERROR line to tsConsole when transpilation fails, without throwing', async () => {
      codeExecutionService.transpileTypeScript.and.rejectWith(new Error('Unexpected token'));

      await component.runTypeScript();

      expect(component.tsConsole[0]).toContain('ERROR:');
      expect(component.tsConsole[0]).toContain('Unexpected token');
    });

    it('falls back to a generic message when the rejection carries no message', async () => {
      codeExecutionService.transpileTypeScript.and.rejectWith({});
      await component.runTypeScript();
      expect(component.tsConsole[0]).toContain('Failed to compile TypeScript');
    });
  });

  describe('clearTypeScriptOutput()', () => {
    it('empties tsConsole and stops capture', () => {
      fixture.detectChanges();
      component.tsConsole = ['x'];
      component.clearTypeScriptOutput();
      expect(component.tsConsole).toEqual([]);
      expect(codeExecutionService.stopCapture).toHaveBeenCalled();
    });
  });

  // ---------- celebration (success-run feedback) ----------
  describe('run-success celebration (debounced, via scheduleCelebration)', () => {
    beforeEach(() => fixture.detectChanges());

    it('shows the success banner 500ms after a clean run with no pending timers', fakeAsync(() => {
      codeExecutionService.getPendingTimerCount.and.returnValue(0);
      codeExecutionService.runInPage.and.returnValue(['> ok']);

      component.runJavaScriptOnly();
      expect(component.runSucceeded).toBeFalse(); // not yet — still debouncing
      tick(500);

      expect(component.runSucceeded).toBeTrue();
      expect(component.showCelebration).toBeTrue();
    }));

    it('does not celebrate when the console contains an error line', fakeAsync(() => {
      codeExecutionService.getPendingTimerCount.and.returnValue(0);
      codeExecutionService.runInPage.and.returnValue(['ERROR: broken']);

      component.runJavaScriptOnly();
      tick(500);

      expect(component.runSucceeded).toBeFalse();
    }));

    it('withholds celebration while timers are still pending', fakeAsync(() => {
      codeExecutionService.getPendingTimerCount.and.returnValue(1);
      codeExecutionService.runInPage.and.returnValue([]);

      component.runJavaScriptOnly();
      tick(500);

      expect(component.runSucceeded).toBeFalse();
    }));

    it('hides the confetti burst after ~1.9s', fakeAsync(() => {
      codeExecutionService.getPendingTimerCount.and.returnValue(0);
      codeExecutionService.runInPage.and.returnValue([]);

      component.runJavaScriptOnly();
      tick(500);
      expect(component.showCelebration).toBeTrue();
      tick(1900);
      expect(component.showCelebration).toBeFalse();
    }));

    it('a late error line revokes an already-celebrated run', fakeAsync(() => {
      codeExecutionService.getPendingTimerCount.and.returnValue(0);
      let onActivityCb: (() => void) | undefined;
      codeExecutionService.runInPage.and.callFake((_code: string, onActivity?: () => void) => {
        onActivityCb = onActivity;
        return [];
      });

      component.runJavaScriptOnly();
      tick(500);
      expect(component.runSucceeded).toBeTrue();

      component.jsOnlyConsole = ['ERROR: late failure'];
      onActivityCb?.();

      expect(component.runSucceeded).toBeFalse();
      expect(component.showCelebration).toBeFalse();
    }));
  });

  // ---------- visualizer ----------
  describe('visualizeJavaScript() / closeVisualizer()', () => {
    beforeEach(() => fixture.detectChanges());

    it('opens the visualizer with the current JS-only code and expands both default sections', () => {
      component.jsOnlyCode = 'let a = 1;';
      component.openSections = [];
      component.visualizeJavaScript();
      expect(component.showVisualizer).toBeTrue();
      expect(component.visualizerCode).toBe('let a = 1;');
      expect(component.openSections).toEqual(['flow', 'memory']);
    });

    it('closeVisualizer() switches back to the console panel', () => {
      component.showVisualizer = true;
      component.closeVisualizer();
      expect(component.showVisualizer).toBeFalse();
    });
  });

  describe('isSectionOpen() / toggleSection()', () => {
    it('isSectionOpen() is always true when not in mobile accordion mode', () => {
      fixture.detectChanges();
      component.mobileAccordion = false;
      component.openSections = [];
      expect(component.isSectionOpen('flow')).toBeTrue();
    });

    it('toggleSection() adds a closed section and removes an open one', () => {
      fixture.detectChanges();
      component.openSections = ['flow'];
      component.toggleSection('memory');
      expect(component.openSections).toEqual(['flow', 'memory']);
      component.toggleSection('flow');
      expect(component.openSections).toEqual(['memory']);
    });
  });

  // ---------- logout ----------
  describe('logout()', () => {
    it('logs out and replaces navigation to the root', () => {
      fixture.detectChanges();
      component.logout();
      expect(authService.logout).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/'], { replaceUrl: true });
    });
  });

  // ---------- error-line helpers ----------
  describe('isErrorLine() / isErrorFrame()', () => {
    it('recognizes both error-line prefixes', () => {
      fixture.detectChanges();
      expect(component.isErrorLine('ERROR: x')).toBeTrue();
      expect(component.isErrorLine('ERROR!x')).toBeTrue();
      expect(component.isErrorLine('> ok')).toBeFalse();
    });

    it('isErrorFrame() only matches the multi-line frame prefix', () => {
      fixture.detectChanges();
      expect(component.isErrorFrame('ERROR!frame')).toBeTrue();
      expect(component.isErrorFrame('ERROR: plain')).toBeFalse();
    });
  });

  // ---------- lifecycle / memory leaks ----------
  describe('ngOnDestroy()', () => {
    it('stops any pending code-execution capture', () => {
      fixture.detectChanges();
      fixture.destroy();
      expect(codeExecutionService.stopCapture).toHaveBeenCalled();
    });

    it('clears celebration timers so they cannot fire on a destroyed component', fakeAsync(() => {
      codeExecutionService.getPendingTimerCount.and.returnValue(0);
      fixture.detectChanges();
      component.runJavaScriptOnly();
      fixture.destroy();
      // If the debounce timer weren't cleared, this tick would throw trying to touch
      // a destroyed component's state via NgZone.run — it must not.
      expect(() => tick(500)).not.toThrow();
    }));

    it('removes the mobile/accordion media-query listeners (no leaked callbacks)', () => {
      // window.matchMedia is already stubbed in the outer beforeEach; re-point it at a
      // spy-tracked MediaQueryList instead of spying on it a second time.
      const mql = { matches: false, media: '', addEventListener: jasmine.createSpy(), removeEventListener: jasmine.createSpy() };
      (window.matchMedia as jasmine.Spy).and.returnValue(mql as unknown as MediaQueryList);
      fixture.detectChanges(); // ngOnInit registers the listeners
      fixture.destroy();
      expect(mql.removeEventListener).toHaveBeenCalled();
    });
  });
});
