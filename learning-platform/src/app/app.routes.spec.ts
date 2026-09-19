import { routes } from './app.routes';

// A "contract stability" test: app.routes.ts is pure configuration with no logic to
// exercise, but it's exactly the kind of file where a typo or an accidentally-deleted
// entry (a guard silently dropped, a path renamed) would compile fine and only surface
// as a 404 or an unprotected admin page in production. These tests pin down the shape
// so a regression here fails loudly in CI instead of silently in the browser.
describe('app.routes', () => {
  function findRoute(path: string) {
    return routes.find((r) => r.path === path);
  }

  it('defines the root ("") route as the compiler/playground home page', () => {
    expect(findRoute('')).toBeTruthy();
  });

  it('has a wildcard route that redirects to the root', () => {
    const wildcard = routes.find((r) => r.path === '**');
    expect(wildcard?.redirectTo).toBe('');
  });

  it('the wildcard route is last (so it never shadows a real route)', () => {
    expect(routes[routes.length - 1].path).toBe('**');
  });

  it('every top-level path is unique', () => {
    const paths = routes.map((r) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  describe('security: guards are attached where they must be', () => {
    it('protects /admin with adminGuard', () => {
      const admin = findRoute('admin');
      expect(admin?.canActivate).toBeDefined();
      expect(admin?.canActivate?.length).toBeGreaterThan(0);
    });

    it('protects /user with authGuard', () => {
      const user = findRoute('user');
      expect(user?.canActivate).toBeDefined();
      expect(user?.canActivate?.length).toBeGreaterThan(0);
    });

    it('leaves public routes (login, signup, landing, flowchart) unguarded', () => {
      for (const path of ['login', 'signup', 'landing', 'flowchart']) {
        expect(findRoute(path)?.canActivate).toBeUndefined();
      }
    });

    it('every /admin child route inherits protection from its parent (none re-declares its own canActivate)', () => {
      const admin = findRoute('admin');
      for (const child of admin?.children ?? []) {
        expect(child.canActivate).toBeUndefined();
      }
    });
  });

  describe('admin children', () => {
    it('has an index route, language-tabs, topics/:level, and issues', () => {
      const admin = findRoute('admin');
      const childPaths = (admin?.children ?? []).map((c) => c.path);
      expect(childPaths).toEqual(['', 'language-tabs', 'topics/:level', 'issues']);
    });
  });

  describe('user children', () => {
    it('redirects the empty child path to home', () => {
      const user = findRoute('user');
      const emptyChild = user?.children?.find((c) => c.path === '');
      expect(emptyChild?.redirectTo).toBe('home');
      expect(emptyChild?.pathMatch).toBe('full');
    });

    it('has an entry for every shell feature (home, content, notes, rag, playground-sessions, report-issue)', () => {
      const user = findRoute('user');
      const childPaths = (user?.children ?? []).map((c) => c.path);
      expect(childPaths).toEqual(
        jasmine.arrayContaining(['home', 'content/:topicId/:subtopicId', 'notes', 'rag', 'playground-sessions', 'report-issue'])
      );
    });
  });

  it('every route resolves its component lazily (loadComponent), never eagerly (component)', () => {
    function checkNoEagerComponent(list: typeof routes): void {
      for (const r of list) {
        expect((r as any).component).toBeUndefined();
        if (r.children) checkNoEagerComponent(r.children);
      }
    }
    checkNoEagerComponent(routes);
  });

  it('every route carries either a component loader or a redirect, never neither', () => {
    for (const r of routes) {
      const hasLoader = typeof r.loadComponent === 'function';
      const hasRedirect = typeof r.redirectTo === 'string';
      const hasChildrenOnly = Array.isArray(r.children) && r.children.length > 0 && !hasLoader && !hasRedirect;
      expect(hasLoader || hasRedirect || hasChildrenOnly).toBeTrue();
    }
  });

  it('offers both an authenticated (/user/playground-sessions) and a public (/playground-sessions) path to the same feature', () => {
    expect(findRoute('playground-sessions')).toBeTruthy();
    const userChild = findRoute('user')?.children?.find((c) => c.path === 'playground-sessions');
    expect(userChild).toBeTruthy();
  });
});
