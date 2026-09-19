import { TestBed } from '@angular/core/testing';
import { Title, Meta } from '@angular/platform-browser';
import { ActivatedRoute, NavigationEnd, provideRouter, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { SeoService } from './seo.service';

describe('SeoService', () => {
  let service: SeoService;
  let routerEvents: Subject<any>;
  let title: Title;
  let meta: Meta;
  let routeData: Subject<any>;

  beforeEach(() => {
    routerEvents = new Subject();
    routeData = new Subject();

    const routerSpy = jasmine.createSpyObj<Router>('Router', [], { events: routerEvents.asObservable() });
    const activatedRouteStub = { firstChild: null, data: routeData.asObservable() };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: activatedRouteStub }
      ]
    });

    service = TestBed.inject(SeoService);
    title = TestBed.inject(Title);
    meta = TestBed.inject(Meta);

    document.querySelector('link[rel="canonical"]')?.remove();
    meta.removeTag('name="description"');
    meta.removeTag('property="og:title"');
    meta.removeTag('property="og:description"');
    meta.removeTag('property="og:url"');
  });

  afterEach(() => {
    document.querySelector('link[rel="canonical"]')?.remove();
  });

  // NavigationEnd is a concrete class the service checks with `instanceof`, so a plain
  // object shape won't match — a real instance is required to exercise the filter.
  function realNavigate(seo?: { title: string; description: string; path: string }): void {
    service.init();
    routerEvents.next(new NavigationEnd(1, '/x', '/x'));
    routeData.next({ seo });
  }

  describe('init() / apply()', () => {
    it('sets the document title from route data', () => {
      realNavigate({ title: 'Flowchart — Primus Codex', description: 'd', path: '/flowchart' });
      expect(title.getTitle()).toBe('Flowchart — Primus Codex');
    });

    it('updates the description meta tag', () => {
      realNavigate({ title: 't', description: 'Custom description', path: '/x' });
      expect(meta.getTag('name="description"')?.content).toBe('Custom description');
    });

    it('updates og:title, og:description and og:url', () => {
      realNavigate({ title: 'T', description: 'D', path: '/flowchart' });
      expect(meta.getTag('property="og:title"')?.content).toBe('T');
      expect(meta.getTag('property="og:description"')?.content).toBe('D');
      expect(meta.getTag('property="og:url"')?.content).toBe('https://primuscodex.com/flowchart');
    });

    it('creates the canonical link tag if none exists', () => {
      expect(document.querySelector('link[rel="canonical"]')).toBeNull();
      realNavigate({ title: 'T', description: 'D', path: '/flowchart' });
      const link = document.querySelector('link[rel="canonical"]');
      expect(link?.getAttribute('href')).toBe('https://primuscodex.com/flowchart');
    });

    it('reuses an existing canonical link on a later navigation rather than creating a second one', () => {
      realNavigate({ title: 'T', description: 'D', path: '/a' });
      realNavigate({ title: 'T', description: 'D', path: '/b' });
      const links = document.querySelectorAll('link[rel="canonical"]');
      expect(links.length).toBe(1);
      expect(links[0].getAttribute('href')).toBe('https://primuscodex.com/b');
    });

    it('uses the bare site origin (no trailing path) for the root route', () => {
      realNavigate({ title: 'T', description: 'D', path: '/' });
      expect(meta.getTag('property="og:url"')?.content).toBe('https://primuscodex.com/');
    });

    it('falls back to defaults when a route has no seo data', () => {
      realNavigate(undefined);
      expect(title.getTitle()).toBe('Online Compiler — Primus Codex');
      expect(meta.getTag('property="og:url"')?.content).toBe('https://primuscodex.com/');
    });

    it('walks down to the deepest activated child route for its data', () => {
      const childData = new Subject<any>();
      (TestBed.inject(ActivatedRoute) as any).firstChild = { firstChild: null, data: childData.asObservable() };
      service.init();
      routerEvents.next(new NavigationEnd(1, '/child', '/child'));
      childData.next({ seo: { title: 'Child title', description: 'd', path: '/child' } });
      expect(title.getTitle()).toBe('Child title');
    });

    it('ignores non-NavigationEnd router events', () => {
      service.init();
      title.setTitle('unchanged');
      routerEvents.next({ constructor: { name: 'NavigationStart' } });
      expect(title.getTitle()).toBe('unchanged');
    });
  });
});
