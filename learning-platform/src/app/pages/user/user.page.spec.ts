import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter, Router, NavigationEnd } from '@angular/router';
import { BehaviorSubject, of, throwError, Subject } from 'rxjs';
import { UserPage } from './user.page';
import { AuthService } from '../../services/auth.service';
import { ContentService } from '../../services/content.service';
import { PlaygroundSessionService } from '../../services/playground-session.service';
import { NavHistoryService } from '../../services/nav-history.service';
import { User } from '../../models/user.model';
import { LanguageTab, Topic } from '../../models/content.model';
import { PlaygroundSession } from '../../models/playground-session.model';

function makeUser(overrides: Partial<User> = {}): User {
  return { id: 'u1', email: 'a@b.com', username: 'alice', role: 'user', createdAt: new Date(), ...overrides };
}

function makeTab(overrides: Partial<LanguageTab> = {}): LanguageTab {
  return { id: '1', name: 'HTML', code: 'html', order: 1, isActive: true, ...overrides };
}

function makeTopic(overrides: Partial<Topic> = {}): Topic {
  return { id: 't1', title: 'X', description: '', difficultyLevel: 'beginner', languagePlatform: 'html', order: 1, subtopics: [], ...overrides };
}

function makeSession(overrides: Partial<PlaygroundSession> = {}): PlaygroundSession {
  return {
    _id: 's1', userId: 'u1', title: 'S', mode: 'web', htmlCode: '', cssCode: '', jsCode: '',
    jsOnlyCode: '', tsCode: '', selectedTab: 'html', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides
  };
}

describe('UserPage', () => {
  let fixture: ComponentFixture<UserPage>;
  let component: UserPage;
  let authService: jasmine.SpyObj<AuthService>;
  let contentService: jasmine.SpyObj<ContentService>;
  let pgSessionService: jasmine.SpyObj<PlaygroundSessionService>;
  let navHistory: jasmine.SpyObj<NavHistoryService>;
  let router: Router;
  let tabsSubject: BehaviorSubject<LanguageTab[]>;
  let topicsSubject: BehaviorSubject<Topic[]>;
  let innerWidthSpy: jasmine.Spy;

  beforeEach(async () => {
    tabsSubject = new BehaviorSubject<LanguageTab[]>([]);
    topicsSubject = new BehaviorSubject<Topic[]>([]);

    authService = jasmine.createSpyObj<AuthService>('AuthService', ['logout'], { currentUserValue: makeUser() });
    contentService = jasmine.createSpyObj<ContentService>('ContentService', [], {
      languageTabs$: tabsSubject.asObservable(),
      topics$: topicsSubject.asObservable()
    });
    pgSessionService = jasmine.createSpyObj<PlaygroundSessionService>('PlaygroundSessionService', ['getSessions']);
    navHistory = jasmine.createSpyObj<NavHistoryService>('NavHistoryService', ['back'], { canGoBack: false });

    innerWidthSpy = spyOnProperty(window, 'innerWidth', 'get').and.returnValue(1400);
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [UserPage],
      providers: [
        // A REAL Router via provideRouter([]) — its ActivatedRoute/RouterLink machinery
        // is internally coupled to a genuine Router instance (confirmed empirically: a
        // plain Router spy broke both ActivatedRoute's own factory and Ionic's
        // RouterLinkDelegateDirective, which calls router.createUrlTree() in ngOnInit).
        // `navigate`/`navigateByUrl` are spied below, `url` via spyOnProperty per test,
        // and `router.events` is used directly — it's a real EventEmitter (a Subject
        // subclass), so router.events.next(...) works on the genuine instance.
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: ContentService, useValue: contentService },
        { provide: PlaygroundSessionService, useValue: pgSessionService },
        { provide: NavHistoryService, useValue: navHistory }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);

    fixture = TestBed.createComponent(UserPage);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture?.destroy();
    localStorage.clear();
  });

  describe('ngOnInit()', () => {
    it('creates and loads the current user', () => {
      fixture.detectChanges();
      expect(component.currentUser?.id).toBe('u1');
    });

    it('redirects to /login when no user is signed in', () => {
      Object.defineProperty(authService, 'currentUserValue', { get: () => null });
      fixture.detectChanges();
      expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('loads a previously saved avatar from localStorage', () => {
      localStorage.setItem('avatar_u1', 'data:image/png;base64,xyz');
      fixture.detectChanges();
      expect(component.avatarUrl).toBe('data:image/png;base64,xyz');
    });
  });

  describe('orderedTabs (combineLatest of languageTabs$ / topics$)', () => {
    beforeEach(() => fixture.detectChanges());

    it('puts tabs with content first and empty tabs last, disabled', () => {
      tabsSubject.next([makeTab({ id: '1', code: 'html', order: 1 }), makeTab({ id: '2', code: 'css', order: 2 })]);
      topicsSubject.next([makeTopic({ languagePlatform: 'html' })]);

      expect(component.orderedTabs.map((t) => t.code)).toEqual(['html', 'css']);
      expect(component.orderedTabs[0].disabled).toBeFalse();
      expect(component.orderedTabs[1].disabled).toBeTrue();
    });

    it('excludes inactive tabs entirely', () => {
      tabsSubject.next([makeTab({ id: '1', isActive: false })]);
      topicsSubject.next([]);
      expect(component.orderedTabs.length).toBe(0);
    });

    it('switches the selected language onto one that actually has content', () => {
      component.selectedLanguage = 'html'; // default, but no html topics below
      tabsSubject.next([makeTab({ id: '1', code: 'html' }), makeTab({ id: '2', code: 'javascript' })]);
      topicsSubject.next([makeTopic({ languagePlatform: 'javascript' })]);
      expect(component.selectedLanguage).toBe('javascript');
    });

    it('leaves the selection alone when it already has content', () => {
      component.selectedLanguage = 'javascript';
      tabsSubject.next([makeTab({ id: '1', code: 'javascript' })]);
      topicsSubject.next([makeTopic({ languagePlatform: 'javascript' })]);
      expect(component.selectedLanguage).toBe('javascript');
    });
  });

  describe('selectLanguage()', () => {
    beforeEach(() => fixture.detectChanges());

    it('switches to an enabled tab', () => {
      component.selectLanguage({ ...makeTab({ code: 'css' }), disabled: false });
      expect(component.selectedLanguage).toBe('css');
    });

    it('ignores a disabled (empty) tab', () => {
      component.selectedLanguage = 'html';
      component.selectLanguage({ ...makeTab({ code: 'css' }), disabled: true });
      expect(component.selectedLanguage).toBe('html');
    });
  });

  describe('route-flag derivation (hideSidebar / isShellHome / showBackButton)', () => {
    it('hides the sidebar on the sessions/notes/report-issue/rag routes', () => {
      Object.defineProperty(router, 'url', { get: () => '/user/notes', configurable: true });
      fixture.detectChanges();
      expect(component.hideSidebar).toBeTrue();
    });

    it('shows the sidebar on the topic-browsing home route', () => {
      Object.defineProperty(router, 'url', { get: () => '/user/home', configurable: true });
      fixture.detectChanges();
      expect(component.hideSidebar).toBeFalse();
    });

    it('marks isShellHome true only for the exact /user/home path (ignoring query params)', () => {
      Object.defineProperty(router, 'url', { get: () => '/user/home?x=1', configurable: true });
      fixture.detectChanges();
      expect(component.isShellHome).toBeTrue();
    });

    it('showBackButton is false on shell home with no in-app history', () => {
      Object.defineProperty(router, 'url', { get: () => '/user/home', configurable: true });
      fixture.detectChanges();
      expect(component.showBackButton).toBeFalse();
    });

    it('showBackButton is true off shell home', () => {
      Object.defineProperty(router, 'url', { get: () => '/user/notes', configurable: true });
      fixture.detectChanges();
      expect(component.showBackButton).toBeTrue();
    });

    it('showBackButton is true on shell home once there is in-app history', () => {
      Object.defineProperty(router, 'url', { get: () => '/user/home', configurable: true });
      Object.defineProperty(navHistory, 'canGoBack', { get: () => true });
      fixture.detectChanges();
      expect(component.showBackButton).toBeTrue();
    });

    it('re-derives the flags on every NavigationEnd', () => {
      Object.defineProperty(router, 'url', { get: () => '/user/home', configurable: true });
      fixture.detectChanges();
      expect(component.hideSidebar).toBeFalse();

      (router.events as any).next(new NavigationEnd(1, '/user/notes', '/user/notes'));
      expect(component.hideSidebar).toBeTrue();
    });
  });

  describe('goBack()', () => {
    it('falls back to /user/home', () => {
      fixture.detectChanges();
      component.goBack();
      expect(navHistory.back).toHaveBeenCalledWith('/user/home');
    });
  });

  describe('sidebar toggling', () => {
    beforeEach(() => fixture.detectChanges());

    it('toggleSidebar() flips isSidebarOpen', () => {
      const before = component.isSidebarOpen;
      component.toggleSidebar();
      expect(component.isSidebarOpen).toBe(!before);
    });

    it('expandSidebarIfCollapsed() opens a collapsed sidebar', () => {
      component.isSidebarOpen = false;
      component.expandSidebarIfCollapsed();
      expect(component.isSidebarOpen).toBeTrue();
    });

    it('expandSidebarIfCollapsed() is a no-op when already open', () => {
      component.isSidebarOpen = true;
      component.expandSidebarIfCollapsed();
      expect(component.isSidebarOpen).toBeTrue();
    });

    it('onTopicSelected() closes the sidebar only on a narrow (overlay) viewport', () => {
      innerWidthSpy.and.returnValue(500);
      component.isSidebarOpen = true;
      component.onTopicSelected();
      expect(component.isSidebarOpen).toBeFalse();
    });

    it('onTopicSelected() leaves the sidebar open on a wide viewport', () => {
      component.isSidebarOpen = true;
      component.onTopicSelected();
      expect(component.isSidebarOpen).toBeTrue();
    });

    it('onViewportResize() closes the drawer when crossing into overlay width', () => {
      component.isSidebarOpen = true;
      innerWidthSpy.and.returnValue(500);
      component.onViewportResize();
      expect(component.isSidebarOpen).toBeFalse();
    });

    it('onViewportResize() does nothing when staying within the same layout mode', () => {
      component.isSidebarOpen = false;
      innerWidthSpy.and.returnValue(1300);
      component.onViewportResize();
      expect(component.isSidebarOpen).toBeFalse();
    });
  });

  describe('greeting / userInitial / userPhone', () => {
    beforeEach(() => fixture.detectChanges());

    it('greets "Good Morning" before noon', () => {
      jasmine.clock().install();
      jasmine.clock().mockDate(new Date(2024, 0, 1, 9, 0, 0));
      expect(component.greeting).toBe('Good Morning');
      jasmine.clock().uninstall();
    });

    it('greets "Good Afternoon" between 12 and 17', () => {
      jasmine.clock().install();
      jasmine.clock().mockDate(new Date(2024, 0, 1, 14, 0, 0));
      expect(component.greeting).toBe('Good Afternoon');
      jasmine.clock().uninstall();
    });

    it('greets "Good Evening" after 17', () => {
      jasmine.clock().install();
      jasmine.clock().mockDate(new Date(2024, 0, 1, 20, 0, 0));
      expect(component.greeting).toBe('Good Evening');
      jasmine.clock().uninstall();
    });

    it('userInitial is the uppercased first letter of the username', () => {
      expect(component.userInitial).toBe('A');
    });

    it('userInitial falls back to "U" with no user', () => {
      component.currentUser = null;
      expect(component.userInitial).toBe('U');
    });

    it('userPhone reads an optional phone field, or null', () => {
      expect(component.userPhone).toBeNull();
      component.currentUser = { ...makeUser(), phone: '555-1234' } as any;
      expect(component.userPhone).toBe('555-1234');
    });
  });

  describe('profile popover', () => {
    it('openProfile() opens the popover and records the anchor event', () => {
      fixture.detectChanges();
      const event = new Event('click');
      component.openProfile(event);
      expect(component.isProfileOpen).toBeTrue();
      expect(component.profileEvent).toBe(event);
    });
  });

  describe('avatar management', () => {
    beforeEach(() => fixture.detectChanges());

    it('selectAvatar() persists the chosen avatar keyed by user id', () => {
      component.selectAvatar('data:image/svg+xml,ghost');
      expect(component.avatarUrl).toBe('data:image/svg+xml,ghost');
      expect(localStorage.getItem('avatar_u1')).toBe('data:image/svg+xml,ghost');
    });

    it('clearAvatar() removes the stored avatar', () => {
      component.selectAvatar('data:image/svg+xml,ghost');
      component.clearAvatar();
      expect(component.avatarUrl).toBeNull();
      expect(localStorage.getItem('avatar_u1')).toBeNull();
    });

    function fileEvent(file: File | null): Event {
      const input = document.createElement('input');
      input.type = 'file';
      spyOnProperty(input, 'files').and.returnValue(file ? ([file] as any) : ([] as any));
      return { target: input } as unknown as Event;
    }

    it('onAvatarFile() rejects a non-image file', () => {
      spyOn(window, 'alert');
      component.onAvatarFile(fileEvent(new File(['x'], 'a.pdf', { type: 'application/pdf' })));
      expect(window.alert).toHaveBeenCalledWith('Please choose an image file.');
    });

    it('onAvatarFile() rejects a file over 2MB', () => {
      spyOn(window, 'alert');
      const big = new File([new ArrayBuffer(3 * 1024 * 1024)], 'big.png', { type: 'image/png' });
      component.onAvatarFile(fileEvent(big));
      expect(window.alert).toHaveBeenCalledWith('Image is too large. Please pick one under 2 MB.');
    });

    it('onAvatarFile() does nothing when no file was chosen', () => {
      expect(() => component.onAvatarFile(fileEvent(null))).not.toThrow();
    });

    it('onAvatarFile() reads a valid image as a data URL and saves it', (done) => {
      const file = new File(['x'], 'a.png', { type: 'image/png' });
      component.onAvatarFile(fileEvent(file));
      // FileReader.readAsDataURL is async even for an in-memory File; poll briefly.
      const check = () => {
        if (component.avatarUrl) {
          expect(component.avatarUrl).toContain('data:');
          done();
        } else {
          setTimeout(check, 5);
        }
      };
      check();
    });
  });

  describe('logout()', () => {
    it('closes the profile popover, logs out, and navigates to "/" after a short delay', fakeAsync(() => {
      fixture.detectChanges();
      component.isProfileOpen = true;
      component.logout();
      expect(component.isProfileOpen).toBeFalse();
      expect(authService.logout).toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
      tick(150);
      expect(router.navigate).toHaveBeenCalledWith(['/'], { replaceUrl: true });
    }));
  });

  describe('navigation helpers', () => {
    beforeEach(() => fixture.detectChanges());

    it('navigateToPlayground()', () => {
      component.navigateToPlayground();
      expect(router.navigate).toHaveBeenCalledWith(['/user/playground']);
    });

    it('navigateHome()', () => {
      component.navigateHome();
      expect(router.navigate).toHaveBeenCalledWith(['/user/home']);
    });

    it('navigateToPlaygroundSessions()', () => {
      component.navigateToPlaygroundSessions();
      expect(router.navigate).toHaveBeenCalledWith(['/user/playground-sessions']);
    });

    it('navigateToNotes()', () => {
      component.navigateToNotes();
      expect(router.navigate).toHaveBeenCalledWith(['/user/notes']);
    });

    it('navigateToRag()', () => {
      component.navigateToRag();
      expect(router.navigate).toHaveBeenCalledWith(['/user/rag']);
    });

    it('navigateToReportIssue()', () => {
      component.navigateToReportIssue();
      expect(router.navigate).toHaveBeenCalledWith(['/user/report-issue']);
    });
  });

  describe('drafts panel', () => {
    beforeEach(() => fixture.detectChanges());

    it('openDrafts() loads sessions and clears the loading flag', () => {
      pgSessionService.getSessions.and.returnValue(of([makeSession()]));
      component.openDrafts();
      expect(component.draftsOpen).toBeTrue();
      expect(component.draftSessions.length).toBe(1);
      expect(component.draftsLoading).toBeFalse();
    });

    it('openDrafts() defends against a non-array response', () => {
      pgSessionService.getSessions.and.returnValue(of(null as any));
      component.openDrafts();
      expect(component.draftSessions).toEqual([]);
    });

    it('openDrafts() clears the loading flag on failure too', () => {
      pgSessionService.getSessions.and.returnValue(throwError(() => new Error('down')));
      component.openDrafts();
      expect(component.draftsLoading).toBeFalse();
    });

    it('closeDrafts() closes the panel', () => {
      component.draftsOpen = true;
      component.closeDrafts();
      expect(component.draftsOpen).toBeFalse();
    });

    it('openDraft() closes the panel and navigates with the session id as a query param', () => {
      component.draftsOpen = true;
      component.openDraft(makeSession({ _id: 'abc' }));
      expect(component.draftsOpen).toBeFalse();
      expect(router.navigate).toHaveBeenCalledWith(['/user/playground-sessions'], { queryParams: { sessionId: 'abc' } });
    });

    it('formatDraftDate() renders a short date', () => {
      expect(component.formatDraftDate('2024-03-15T00:00:00.000Z')).toMatch(/\w+ \d+/);
    });

    it('does not update drafts from a response arriving after the component is destroyed', () => {
      const subject = new Subject<PlaygroundSession[]>();
      pgSessionService.getSessions.and.returnValue(subject.asObservable());
      component.openDrafts();
      fixture.destroy();
      expect(() => subject.next([makeSession()])).not.toThrow();
      expect(component.draftSessions).toEqual([]);
    });
  });

  describe('ngOnDestroy() — memory leak', () => {
    it('unsubscribes the route-flags subscription', () => {
      Object.defineProperty(router, 'url', { get: () => '/user/home', configurable: true });
      fixture.detectChanges();
      fixture.destroy();
      expect(() => (router.events as any).next(new NavigationEnd(1, '/user/notes', '/user/notes'))).not.toThrow();
      // hideSidebar should not have flipped, since the subscription is gone.
      expect(component.hideSidebar).toBeFalse();
    });
  });

  describe('ionViewDidEnter()', () => {
    it('re-navigates when the nested router-outlet exists but has nothing activated (the actual bug this works around)', () => {
      // provideRouter([]) renders a real, empty RouterOutlet here — with no routes
      // configured, it's present but never activated, which is exactly the state this
      // method exists to detect and recover from (see the method's own doc comment).
      fixture.detectChanges();
      expect((component as any).childOutlet).toBeTruthy();
      expect((component as any).childOutlet.isActivated).toBeFalse();

      component.ionViewDidEnter();

      expect(router.navigateByUrl).toHaveBeenCalledWith('/', { skipLocationChange: true });
    });

    it('does nothing when the outlet reports itself as already activated', () => {
      fixture.detectChanges();
      Object.defineProperty((component as any).childOutlet, 'isActivated', { get: () => true, configurable: true });

      component.ionViewDidEnter();

      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });

    it('does not throw before the view (and its outlet) has been created', () => {
      expect(() => component.ionViewDidEnter()).not.toThrow();
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });
  });
});
