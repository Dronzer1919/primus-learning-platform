import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AdminPage } from './admin.page';
import { AuthService } from '../../services/auth.service';
import { NavHistoryService } from '../../services/nav-history.service';
import { User } from '../../models/user.model';

function makeAdmin(): User {
  return { id: '1', email: 'a@b.com', username: 'admin', role: 'admin', createdAt: new Date() };
}

describe('AdminPage', () => {
  let fixture: ComponentFixture<AdminPage>;
  let component: AdminPage;
  let authService: jasmine.SpyObj<AuthService>;
  let navHistory: jasmine.SpyObj<NavHistoryService>;
  let router: Router;
  let innerWidthSpy: jasmine.Spy;

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['isAdmin', 'logout'], {
      currentUserValue: makeAdmin()
    });
    authService.isAdmin.and.returnValue(true);
    navHistory = jasmine.createSpyObj<NavHistoryService>('NavHistoryService', ['back'], { canGoBack: false });

    // isSidebarOpen is computed from window.innerWidth at class-field-init time (before
    // ngOnInit), and headless Chrome's real test viewport is narrow enough to trip the
    // overlay-mode branch — same class of gotcha covered in earlier modules. Tests that
    // need a different width call innerWidthSpy.and.returnValue(...) rather than
    // redefining the property a second time (mixing spyOnProperty with a raw
    // Object.defineProperty on the same property risks leaving it stuck for later spec
    // files, since jasmine's own auto-restore no longer knows about the manual override).
    innerWidthSpy = spyOnProperty(window, 'innerWidth', 'get').and.returnValue(1400);

    await TestBed.configureTestingModule({
      imports: [AdminPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: NavHistoryService, useValue: navHistory }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);

    fixture = TestBed.createComponent(AdminPage);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture?.destroy());

  describe('rendering / ngOnInit()', () => {
    it('creates for an admin user', () => {
      fixture.detectChanges();
      expect(component).toBeTruthy();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('redirects to /login when there is no signed-in user', () => {
      Object.defineProperty(authService, 'currentUserValue', { get: () => null });
      fixture.detectChanges();
      expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('redirects to /login when the signed-in user is not an admin', () => {
      authService.isAdmin.and.returnValue(false);
      fixture.detectChanges();
      expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('starts with the sidebar open on a wide (desktop) viewport', () => {
      fixture.detectChanges();
      expect(component.isSidebarOpen).toBeTrue();
    });

    it('renders all 8 menu items', () => {
      fixture.detectChanges();
      expect(component.menuItems.length).toBe(8);
    });
  });

  describe('showBackButton', () => {
    beforeEach(() => fixture.detectChanges());

    it('is false on the dashboard root with no in-app history', () => {
      spyOnProperty(router, 'url', 'get').and.returnValue('/admin');
      expect(component.showBackButton).toBeFalse();
    });

    it('is true on a child route', () => {
      spyOnProperty(router, 'url', 'get').and.returnValue('/admin/issues');
      expect(component.showBackButton).toBeTrue();
    });

    it('is true on the dashboard root once there is in-app history', () => {
      Object.defineProperty(navHistory, 'canGoBack', { get: () => true });
      spyOnProperty(router, 'url', 'get').and.returnValue('/admin');
      expect(component.showBackButton).toBeTrue();
    });
  });

  describe('goBack()', () => {
    it('falls back to /admin (the shell\'s own root)', () => {
      fixture.detectChanges();
      component.goBack();
      expect(navHistory.back).toHaveBeenCalledWith('/admin');
    });
  });

  describe('toggleSidebar()', () => {
    it('flips isSidebarOpen', () => {
      fixture.detectChanges();
      const before = component.isSidebarOpen;
      component.toggleSidebar();
      expect(component.isSidebarOpen).toBe(!before);
    });
  });

  describe('selectMenu()', () => {
    beforeEach(() => fixture.detectChanges());

    it('updates selectedMenu and navigates to the route', () => {
      component.selectMenu('issues', '/admin/issues');
      expect(component.selectedMenu).toBe('issues');
      expect(router.navigate).toHaveBeenCalledWith(['/admin/issues']);
    });

    it('closes the drawer after navigating on a narrow (overlay) viewport', () => {
      innerWidthSpy.and.returnValue(500);
      component.isSidebarOpen = true;
      component.selectMenu('issues', '/admin/issues');
      expect(component.isSidebarOpen).toBeFalse();
    });

    it('leaves the sidebar open on a wide viewport after navigating', () => {
      component.isSidebarOpen = true;
      component.selectMenu('issues', '/admin/issues');
      expect(component.isSidebarOpen).toBeTrue();
    });
  });

  describe('onViewportResize()', () => {
    beforeEach(() => fixture.detectChanges());

    it('closes the drawer when crossing from wide to overlay width', () => {
      component.isSidebarOpen = true;
      innerWidthSpy.and.returnValue(500);
      component.onViewportResize();
      expect(component.isSidebarOpen).toBeFalse();
    });

    it('does not touch isSidebarOpen on a resize that stays within the same mode', () => {
      component.isSidebarOpen = false;
      innerWidthSpy.and.returnValue(1300);
      component.onViewportResize(); // still wide -> still not "crossing"
      expect(component.isSidebarOpen).toBeFalse();
    });
  });

  describe('logout()', () => {
    it('logs out and navigates to /login', () => {
      fixture.detectChanges();
      component.logout();
      expect(authService.logout).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });
  });
});
