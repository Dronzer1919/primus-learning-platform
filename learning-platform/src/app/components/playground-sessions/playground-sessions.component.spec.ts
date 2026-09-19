import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { provideRouter, Router, ActivatedRoute, convertToParamMap } from '@angular/router';
import { ToastController, AlertController } from '@ionic/angular';
import { of, throwError, Subject } from 'rxjs';
import { PlaygroundSessionsComponent } from './playground-sessions.component';
import { PlaygroundWorkspaceComponent } from '../playground-workspace/playground-workspace.component';
import { PlaygroundSessionService } from '../../services/playground-session.service';
import { LocalPlaygroundSessionService } from '../../services/local-playground-session.service';
import { AuthService } from '../../services/auth.service';
import { CodeExecutionService } from '../../services/code-execution.service';
import { NavHistoryService } from '../../services/nav-history.service';
import { PlaygroundSession } from '../../models/playground-session.model';
import { LocalPlaygroundSession } from '../../models/local-session.model';

type AnyPlaygroundSession = PlaygroundSession | LocalPlaygroundSession;

function makeSession(overrides: Partial<PlaygroundSession> = {}): PlaygroundSession {
  return {
    _id: '1',
    userId: 'u1',
    title: 'Session 1',
    mode: 'web',
    htmlCode: '<h1>hi</h1>',
    cssCode: '',
    jsCode: '',
    jsOnlyCode: '',
    tsCode: '',
    selectedTab: 'html',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides
  };
}

describe('PlaygroundSessionsComponent', () => {
  let fixture: ComponentFixture<PlaygroundSessionsComponent>;
  let component: PlaygroundSessionsComponent;
  let pgSessionService: jasmine.SpyObj<PlaygroundSessionService>;
  let localPgSessionService: jasmine.SpyObj<LocalPlaygroundSessionService>;
  let authService: jasmine.SpyObj<AuthService>;
  let toastController: jasmine.SpyObj<ToastController>;
  let alertController: jasmine.SpyObj<AlertController>;
  let router: Router;
  let toastConfig: any;
  let alertConfig: any;

  beforeEach(async () => {
    // PlaygroundWorkspaceComponent is a heavy real component (CodeMirror editors, a
    // JS visualizer, its own theme selector) that Module 3 (Code Editor) tests in full.
    // Here only its *presence/absence* and its plain data properties matter, so its
    // template/imports are gutted while keeping the exact class token intact — that's
    // what @ViewChild(PlaygroundWorkspaceComponent) in the component under test needs
    // to still resolve correctly.
    TestBed.overrideComponent(PlaygroundWorkspaceComponent, {
      set: { template: '<div class="stub-workspace"></div>', imports: [CommonModule] }
    });

    pgSessionService = jasmine.createSpyObj<PlaygroundSessionService>('PlaygroundSessionService', [
      'getSessions', 'createSession', 'updateSession', 'deleteSession'
    ]);
    localPgSessionService = jasmine.createSpyObj<LocalPlaygroundSessionService>('LocalPlaygroundSessionService', [
      'getSessions', 'createSession', 'updateSession', 'deleteSession'
    ]);
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['isAuthenticated']);
    toastController = jasmine.createSpyObj<ToastController>('ToastController', ['create']);
    toastController.create.and.callFake((config: any) => {
      toastConfig = config;
      return Promise.resolve({ present: jasmine.createSpy().and.resolveTo() } as any);
    });
    alertController = jasmine.createSpyObj<AlertController>('AlertController', ['create']);
    alertController.create.and.callFake((config: any) => {
      alertConfig = config;
      return Promise.resolve({ present: jasmine.createSpy().and.resolveTo() } as any);
    });

    const codeExecutionSpy = jasmine.createSpyObj<CodeExecutionService>('CodeExecutionService', [
      'runInPage', 'getPendingTimerCount', 'stopCapture', 'buildWebMarkup', 'transpileTypeScript', 'runPython'
    ]);
    const navHistorySpy = jasmine.createSpyObj<NavHistoryService>('NavHistoryService', ['back']);

    await TestBed.configureTestingModule({
      imports: [PlaygroundSessionsComponent],
      providers: [
        provideRouter([]),
        { provide: PlaygroundSessionService, useValue: pgSessionService },
        { provide: LocalPlaygroundSessionService, useValue: localPgSessionService },
        { provide: AuthService, useValue: authService },
        { provide: ToastController, useValue: toastController },
        { provide: AlertController, useValue: alertController },
        { provide: CodeExecutionService, useValue: codeExecutionSpy },
        { provide: NavHistoryService, useValue: navHistorySpy },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(PlaygroundSessionsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture?.destroy());

  // ---------- Rendering ----------
  describe('rendering', () => {
    it('creates the component', () => {
      authService.isAuthenticated.and.returnValue(true);
      pgSessionService.getSessions.and.returnValue(of([]));
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('shows the guest banner for a signed-out visitor', () => {
      authService.isAuthenticated.and.returnValue(false);
      localPgSessionService.getSessions.and.returnValue(of([]));
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.pgs-guest-banner')).toBeTruthy();
    });

    it('hides the guest banner for a signed-in user', () => {
      authService.isAuthenticated.and.returnValue(true);
      pgSessionService.getSessions.and.returnValue(of([]));
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.pgs-guest-banner')).toBeNull();
    });

    it('shows the empty-state hint when there are no sessions and loading has finished', () => {
      authService.isAuthenticated.and.returnValue(true);
      pgSessionService.getSessions.and.returnValue(of([]));
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.empty-hint')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.pgs-workspace.pgs-empty')).toBeTruthy();
    });

    it('shows a loading spinner while a request is in flight', () => {
      authService.isAuthenticated.and.returnValue(true);
      pgSessionService.getSessions.and.returnValue(new Subject<PlaygroundSession[]>());
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.loading-hint')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.empty-hint')).toBeNull();
    });

    it('renders one list item per session and selects the first by default', () => {
      authService.isAuthenticated.and.returnValue(true);
      pgSessionService.getSessions.and.returnValue(of([makeSession({ _id: '1' }), makeSession({ _id: '2', title: 'Session 2' })]));
      fixture.detectChanges();

      const items = fixture.nativeElement.querySelectorAll('.pgs-item');
      expect(items.length).toBe(2);
      expect(component.activeSession?._id).toBe('1');
      expect(fixture.nativeElement.querySelector('.stub-workspace')).toBeTruthy();
    });

    it('renders the back button only on the standalone (non-/user/) route', () => {
      spyOnProperty(router, 'url', 'get').and.returnValue('/playground-sessions');
      authService.isAuthenticated.and.returnValue(true);
      pgSessionService.getSessions.and.returnValue(of([]));
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('app-back-button')).toBeTruthy();
    });

    it('hides the back button under /user/ (the shell already has one)', () => {
      spyOnProperty(router, 'url', 'get').and.returnValue('/user/playground-sessions');
      authService.isAuthenticated.and.returnValue(true);
      pgSessionService.getSessions.and.returnValue(of([]));
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('app-back-button')).toBeNull();
    });

    it('gives the save and delete icons a title for basic accessibility', () => {
      authService.isAuthenticated.and.returnValue(true);
      pgSessionService.getSessions.and.returnValue(of([makeSession()]));
      fixture.detectChanges();
      const saveIcon = fixture.nativeElement.querySelector('.active-actions ion-icon[title="Save"]');
      const deleteIcon = fixture.nativeElement.querySelector('.active-actions ion-icon[title="Delete"]');
      expect(saveIcon).toBeTruthy();
      expect(deleteIcon).toBeTruthy();
    });
  });

  // ---------- ngOnInit / source selection ----------
  describe('ngOnInit()', () => {
    it('uses the local (IndexedDB) source for a guest', () => {
      authService.isAuthenticated.and.returnValue(false);
      localPgSessionService.getSessions.and.returnValue(of([]));
      fixture.detectChanges();
      expect(component.isGuest).toBeTrue();
      expect(localPgSessionService.getSessions).toHaveBeenCalled();
      expect(pgSessionService.getSessions).not.toHaveBeenCalled();
    });

    it('uses the backend source for a signed-in user', () => {
      authService.isAuthenticated.and.returnValue(true);
      pgSessionService.getSessions.and.returnValue(of([]));
      fixture.detectChanges();
      expect(component.isGuest).toBeFalse();
      expect(pgSessionService.getSessions).toHaveBeenCalled();
    });

    it('selects the session named by ?sessionId= over the first in the list', () => {
      // ngOnInit() reads the route lazily on the first change-detection pass, so mutating
      // the stub's snapshot before detectChanges() is enough — no need to recreate the
      // fixture or override a provider on an already-instantiated TestBed.
      (TestBed.inject(ActivatedRoute).snapshot as any).queryParamMap = convertToParamMap({ sessionId: '2' });

      authService.isAuthenticated.and.returnValue(true);
      pgSessionService.getSessions.and.returnValue(of([makeSession({ _id: '1' }), makeSession({ _id: '2' })]));
      fixture.detectChanges();

      expect(component.activeSession?._id).toBe('2');
    });
  });

  // ---------- loadSessions() ----------
  describe('loadSessions()', () => {
    it('defensively coerces a non-array response to an empty list rather than throwing', () => {
      authService.isAuthenticated.and.returnValue(true);
      pgSessionService.getSessions.and.returnValue(of({ notAnArray: true } as any));
      expect(() => fixture.detectChanges()).not.toThrow();
      expect(component.sessions).toEqual([]);
    });

    it('shows a toast and stops loading on failure, without clearing an already-loaded list', () => {
      authService.isAuthenticated.and.returnValue(true);
      pgSessionService.getSessions.and.returnValue(of([makeSession()]));
      fixture.detectChanges();
      expect(component.sessions.length).toBe(1);

      pgSessionService.getSessions.and.returnValue(throwError(() => new Error('network down')));
      component.loadSessions();

      expect(component.loading).toBeFalse();
      expect(component.sessions.length).toBe(1); // untouched by the failed reload
      expect(toastConfig.color).toBe('danger');
    });

    it('re-selects the previously active session by id after a reload rather than resetting to the first', () => {
      authService.isAuthenticated.and.returnValue(true);
      pgSessionService.getSessions.and.returnValue(of([makeSession({ _id: '1' }), makeSession({ _id: '2' })]));
      fixture.detectChanges();
      component.selectSession(component.sessions[1]);
      expect(component.activeSession?._id).toBe('2');

      // Same two sessions returned again (server order may differ) — active stays '2'.
      pgSessionService.getSessions.and.returnValue(of([makeSession({ _id: '2' }), makeSession({ _id: '1' })]));
      component.loadSessions();
      expect(component.activeSession?._id).toBe('2');
    });
  });

  // ---------- createSession() ----------
  describe('createSession()', () => {
    beforeEach(() => {
      authService.isAuthenticated.and.returnValue(true);
      pgSessionService.getSessions.and.returnValue(of([]));
      fixture.detectChanges();
    });

    it('prepends and selects the new session on success', () => {
      const created = makeSession({ _id: 'new-1', title: 'New Playground' });
      pgSessionService.createSession.and.returnValue(of(created));

      component.createSession();

      expect(component.sessions[0]._id).toBe('new-1');
      expect(component.activeSession?._id).toBe('new-1');
      expect(component.isCreating).toBeFalse();
    });

    it('ignores a second call while the first is still in flight (no double-create)', () => {
      const subject = new Subject<PlaygroundSession>();
      pgSessionService.createSession.and.returnValue(subject.asObservable());

      component.createSession();
      expect(component.isCreating).toBeTrue();
      component.createSession(); // should be a no-op

      expect(pgSessionService.createSession).toHaveBeenCalledTimes(1);
      subject.next(makeSession());
      subject.complete();
    });

    it('shows a toast and resets isCreating on failure', () => {
      pgSessionService.createSession.and.returnValue(throwError(() => new Error('server down')));
      component.createSession();
      expect(component.isCreating).toBeFalse();
      expect(toastConfig.color).toBe('danger');
    });
  });

  // ---------- saveSession() / openSaveDialog() ----------
  describe('saveSession()', () => {
    beforeEach(() => {
      authService.isAuthenticated.and.returnValue(true);
      pgSessionService.getSessions.and.returnValue(of([makeSession({ _id: '1' })]));
      fixture.detectChanges(); // activeSession + workspace (stub) now populated
    });

    it('is a no-op when there is no active session', () => {
      component.activeSession = null;
      component.saveSession();
      expect(pgSessionService.updateSession).not.toHaveBeenCalled();
    });

    it('is a no-op while a save is already in flight', () => {
      const subject = new Subject<PlaygroundSession>();
      pgSessionService.updateSession.and.returnValue(subject.asObservable());
      component.saveSession();
      pgSessionService.updateSession.calls.reset();

      component.saveSession(); // guarded by isSaving

      expect(pgSessionService.updateSession).not.toHaveBeenCalled();
      subject.next(makeSession());
      subject.complete();
    });

    it('sends the workspace content and updates the session list on success', () => {
      component.workspace.htmlCode = '<p>edited</p>';
      const updated = makeSession({ _id: '1', htmlCode: '<p>edited</p>' });
      pgSessionService.updateSession.and.returnValue(of(updated));

      component.saveSession();

      const [id, data] = pgSessionService.updateSession.calls.mostRecent().args;
      expect(id).toBe('1');
      expect(data.htmlCode).toBe('<p>edited</p>');
      expect(component.activeSession?.htmlCode).toBe('<p>edited</p>');
      expect(component.isSaving).toBeFalse();
      expect(toastConfig.color).toBe('success');
    });

    it('shows a danger toast and resets isSaving on failure', () => {
      pgSessionService.updateSession.and.returnValue(throwError(() => new Error('fail')));
      component.saveSession();
      expect(component.isSaving).toBeFalse();
      expect(toastConfig.color).toBe('danger');
    });

    it('openSaveDialog() prefills the alert input with the current editing title', async () => {
      component.editingTitle = 'Custom title';
      await component.openSaveDialog();
      expect(alertConfig.inputs[0].value).toBe('Custom title');
    });

    it('openSaveDialog() is a no-op with no active session', async () => {
      component.activeSession = null;
      await component.openSaveDialog();
      expect(alertController.create).not.toHaveBeenCalled();
    });
  });

  // ---------- renameSession() ----------
  describe('renameSession()', () => {
    beforeEach(() => {
      authService.isAuthenticated.and.returnValue(true);
      pgSessionService.getSessions.and.returnValue(of([makeSession({ _id: '1', title: 'Old title' })]));
      fixture.detectChanges();
    });

    it('does nothing when the prompt is cancelled (returns null)', () => {
      spyOn(window, 'prompt').and.returnValue(null);
      component.renameSession(component.sessions[0]);
      expect(pgSessionService.updateSession).not.toHaveBeenCalled();
    });

    it('does nothing for a blank entry', () => {
      spyOn(window, 'prompt').and.returnValue('   ');
      component.renameSession(component.sessions[0]);
      expect(pgSessionService.updateSession).not.toHaveBeenCalled();
    });

    it('trims the new title and caps it at 120 characters', () => {
      spyOn(window, 'prompt').and.returnValue('  ' + 'x'.repeat(200) + '  ');
      pgSessionService.updateSession.and.returnValue(of(makeSession({ _id: '1', title: 'x'.repeat(120) })));

      component.renameSession(component.sessions[0]);

      const [, data] = pgSessionService.updateSession.calls.mostRecent().args;
      expect((data.title as string).length).toBe(120);
    });

    it('updates the active session in place when it is the one renamed', () => {
      const updated = makeSession({ _id: '1', title: 'Renamed' });
      spyOn(window, 'prompt').and.returnValue('Renamed');
      pgSessionService.updateSession.and.returnValue(of(updated));

      component.renameSession(component.sessions[0]);

      expect(component.activeSession?.title).toBe('Renamed');
    });

    it('shows a toast on failure instead of an unhandled rejection', () => {
      spyOn(window, 'prompt').and.returnValue('Renamed');
      pgSessionService.updateSession.and.returnValue(throwError(() => new Error('fail')));

      expect(() => component.renameSession(component.sessions[0])).not.toThrow();
      expect(toastConfig.color).toBe('danger');
    });
  });

  // ---------- deleteSession() ----------
  describe('deleteSession()', () => {
    beforeEach(() => {
      authService.isAuthenticated.and.returnValue(true);
      pgSessionService.getSessions.and.returnValue(of([makeSession({ _id: '1' }), makeSession({ _id: '2' })]));
      fixture.detectChanges();
    });

    async function confirmDelete(session: AnyPlaygroundSession): Promise<void> {
      await component.deleteSession(session);
      const deleteBtn = alertConfig.buttons.find((b: any) => b.text === 'Delete');
      await deleteBtn.handler();
    }

    it('stops the click from bubbling to selectSession()', async () => {
      const event = jasmine.createSpyObj<Event>('Event', ['stopPropagation']);
      await component.deleteSession(component.sessions[0], event);
      expect(event.stopPropagation).toHaveBeenCalled();
    });

    it('removes the session from the list on confirmed delete', async () => {
      pgSessionService.deleteSession.and.returnValue(of(undefined));
      await confirmDelete(component.sessions[0]);
      expect(component.sessions.find((s) => s._id === '1')).toBeUndefined();
    });

    it('selects the next session when the active one is deleted', async () => {
      pgSessionService.deleteSession.and.returnValue(of(undefined));
      expect(component.activeSession?._id).toBe('1');
      await confirmDelete(component.sessions[0]);
      expect(component.activeSession?._id).toBe('2');
    });

    it('sets activeSession to null when the last remaining session is deleted', async () => {
      pgSessionService.deleteSession.and.returnValue(of(undefined));
      await confirmDelete(component.sessions[1]);
      await confirmDelete(component.sessions[0]);
      expect(component.activeSession).toBeNull();
    });

    it('shows a toast on failure and leaves the list untouched', async () => {
      pgSessionService.deleteSession.and.returnValue(throwError(() => new Error('fail')));
      await confirmDelete(component.sessions[0]);
      expect(component.sessions.length).toBe(2);
      expect(toastConfig.color).toBe('danger');
    });
  });

  // ---------- pure helpers ----------
  describe('formatDate() / trackById()', () => {
    beforeEach(() => {
      authService.isAuthenticated.and.returnValue(true);
      pgSessionService.getSessions.and.returnValue(of([]));
      fixture.detectChanges();
    });

    it('formatDate() renders a short month/day string', () => {
      const formatted = component.formatDate('2024-03-15T00:00:00.000Z');
      expect(formatted).toMatch(/\w+ \d+/);
    });

    it('trackById() returns the record id', () => {
      expect(component.trackById(0, { _id: 'abc' })).toBe('abc');
    });
  });

  // ---------- Enterprise: memory leak (takeUntilDestroyed) ----------
  describe('lifecycle / memory leak', () => {
    it('does not update state from a response that arrives after the component is destroyed', () => {
      authService.isAuthenticated.and.returnValue(true);
      const subject = new Subject<PlaygroundSession[]>();
      pgSessionService.getSessions.and.returnValue(subject.asObservable());

      fixture.detectChanges();
      expect(component.loading).toBeTrue();

      fixture.destroy();
      subject.next([makeSession()]); // late response after teardown

      expect(component.sessions).toEqual([]);
      expect(component.loading).toBeTrue(); // never got the chance to flip — proves the subscription was torn down
    });
  });
});
