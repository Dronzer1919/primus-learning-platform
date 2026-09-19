import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { NavHistoryService } from './nav-history.service';

describe('NavHistoryService', () => {
  let service: NavHistoryService;
  let events: Subject<any>;
  let locationSpy: jasmine.SpyObj<Location>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    events = new Subject();
    locationSpy = jasmine.createSpyObj<Location>('Location', ['back']);
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigateByUrl'], { events: events.asObservable() });

    TestBed.configureTestingModule({
      providers: [
        NavHistoryService,
        { provide: Router, useValue: routerSpy },
        { provide: Location, useValue: locationSpy }
      ]
    });
    service = TestBed.inject(NavHistoryService);
  });

  function navigateTo(url: string): void {
    events.next(new NavigationEnd(1, url, url));
  }

  describe('canGoBack', () => {
    it('is false before any navigation is recorded', () => {
      expect(service.canGoBack).toBeFalse();
    });

    it('is false after only a single URL has been visited (the entry point)', () => {
      navigateTo('/a');
      expect(service.canGoBack).toBeFalse();
    });

    it('is true once a second distinct URL has been visited', () => {
      navigateTo('/a');
      navigateTo('/b');
      expect(service.canGoBack).toBeTrue();
    });
  });

  describe('back()', () => {
    it('calls location.back() when there is in-app history', () => {
      navigateTo('/a');
      navigateTo('/b');
      service.back('/fallback');
      expect(locationSpy.back).toHaveBeenCalled();
      expect(routerSpy.navigateByUrl).not.toHaveBeenCalled();
    });

    it('navigates to the fallback when this page was the entry point', () => {
      navigateTo('/a');
      service.back('/fallback');
      expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/fallback');
      expect(locationSpy.back).not.toHaveBeenCalled();
    });

    it('defaults the fallback to "/"', () => {
      service.back();
      expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/');
    });
  });

  describe('stack bookkeeping (revisit unwinding)', () => {
    it('unwinds to an earlier URL instead of pushing a duplicate (A -> B -> A)', () => {
      navigateTo('/a');
      navigateTo('/b');
      navigateTo('/a');
      // Back to /a should have unwound to just [/a] — canGoBack is now false again,
      // matching the documented "back/forward step lands on an already-visited URL" case.
      expect(service.canGoBack).toBeFalse();
    });

    it('a genuine forward revisit (A -> B -> A -> B) does not duplicate B either', () => {
      navigateTo('/a');
      navigateTo('/b');
      navigateTo('/a'); // unwinds to [/a]
      navigateTo('/b'); // re-appends -> [/a, /b]
      expect(service.canGoBack).toBeTrue();
      service.back('/fallback');
      expect(locationSpy.back).toHaveBeenCalled();
    });

    it('accumulates distinct URLs normally (A -> B -> C)', () => {
      navigateTo('/a');
      navigateTo('/b');
      navigateTo('/c');
      expect(service.canGoBack).toBeTrue();
    });
  });
});
