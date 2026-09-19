import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { authGuard, adminGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

// Security-critical: these guards are the only thing standing between an
// unauthenticated/non-admin visitor and a protected route. Every branch is
// tested explicitly rather than relying on a single happy-path check.

describe('Auth guards', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let router: Router;

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', ['isAuthenticated', 'isAdmin']);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceSpy }
      ]
    });

    router = TestBed.inject(Router);
  });

  function state(url: string): RouterStateSnapshot {
    return { url } as RouterStateSnapshot;
  }

  function route(): ActivatedRouteSnapshot {
    return {} as ActivatedRouteSnapshot;
  }

  describe('authGuard', () => {
    it('allows navigation when the user is authenticated', () => {
      authServiceSpy.isAuthenticated.and.returnValue(true);

      const result = TestBed.runInInjectionContext(() => authGuard(route(), state('/user')));

      expect(result).toBeTrue();
    });

    it('redirects an unauthenticated visitor to /login carrying the attempted URL', () => {
      authServiceSpy.isAuthenticated.and.returnValue(false);

      const result = TestBed.runInInjectionContext(() => authGuard(route(), state('/user/notes')));

      expect(result).not.toBe(true);
      const serialized = router.serializeUrl(result as UrlTree);
      expect(serialized).toContain('/login');
      expect(serialized).toContain('returnUrl=%2Fuser%2Fnotes');
    });

    it('carries a nested/query-bearing attempted URL through returnUrl intact', () => {
      authServiceSpy.isAuthenticated.and.returnValue(false);

      const result = TestBed.runInInjectionContext(() =>
        authGuard(route(), state('/user/content/js/closures'))
      ) as UrlTree;

      expect(router.serializeUrl(result)).toContain('returnUrl=%2Fuser%2Fcontent%2Fjs%2Fclosures');
    });
  });

  describe('adminGuard', () => {
    it('allows navigation when the user is an admin', () => {
      authServiceSpy.isAdmin.and.returnValue(true);

      const result = TestBed.runInInjectionContext(() => adminGuard(route(), state('/admin')));

      expect(result).toBeTrue();
    });

    it('sends a signed-in non-admin to /user rather than /login', () => {
      authServiceSpy.isAdmin.and.returnValue(false);
      authServiceSpy.isAuthenticated.and.returnValue(true);

      const result = TestBed.runInInjectionContext(() => adminGuard(route(), state('/admin'))) as UrlTree;

      const serialized = router.serializeUrl(result);
      expect(serialized).toContain('/user');
      expect(serialized).not.toContain('/login');
    });

    it('sends a signed-out visitor to /login with returnUrl, not /user', () => {
      authServiceSpy.isAdmin.and.returnValue(false);
      authServiceSpy.isAuthenticated.and.returnValue(false);

      const result = TestBed.runInInjectionContext(() => adminGuard(route(), state('/admin/issues'))) as UrlTree;

      const serialized = router.serializeUrl(result);
      expect(serialized).toContain('/login');
      expect(serialized).toContain('returnUrl=%2Fadmin%2Fissues');
    });

    it('never grants admin access purely from isAuthenticated() being true', () => {
      // A forged client-side role must not be enough on its own — isAdmin()
      // is the only thing this guard may trust for the "allow" branch.
      authServiceSpy.isAuthenticated.and.returnValue(true);
      authServiceSpy.isAdmin.and.returnValue(false);

      const result = TestBed.runInInjectionContext(() => adminGuard(route(), state('/admin')));

      expect(result).not.toBe(true);
    });
  });
});
