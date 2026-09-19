import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of, throwError, Subject } from 'rxjs';
import { AdminDashboardComponent } from './admin-dashboard.component';
import { ContentService } from '../../../services/content.service';
import { AuthService } from '../../../services/auth.service';
import { Topic } from '../../../models/content.model';
import { UserStats } from '../../../models/user.model';

function makeTopic(overrides: Partial<Topic> = {}): Topic {
  return {
    id: 't1', title: 'X', description: '', difficultyLevel: 'beginner',
    languagePlatform: 'javascript', order: 1, subtopics: [], ...overrides
  };
}

function makeStats(overrides: Partial<UserStats> = {}): UserStats {
  return { totalUsers: 5, activeNow: 1, totalSessions: 10, googleUsers: 2, todayLogins: 3, recentLogins: [], ...overrides };
}

describe('AdminDashboardComponent', () => {
  let fixture: ComponentFixture<AdminDashboardComponent>;
  let component: AdminDashboardComponent;
  let contentService: jasmine.SpyObj<ContentService>;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    contentService = jasmine.createSpyObj<ContentService>('ContentService', ['getTopics', 'getLanguageTabs']);
    contentService.getTopics.and.returnValue([]);
    contentService.getLanguageTabs.and.returnValue([]);

    authService = jasmine.createSpyObj<AuthService>('AuthService', ['getStats']);
    authService.getStats.and.returnValue(of(makeStats()));

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });

    await TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: [
        { provide: ContentService, useValue: contentService },
        { provide: AuthService, useValue: authService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDashboardComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture?.destroy());

  it('creates', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('loadStats()', () => {
    it('computes counts from the currently loaded topics/tabs', () => {
      contentService.getTopics.and.returnValue([
        makeTopic({ difficultyLevel: 'beginner', subtopics: [{ id: 's1' } as any] }),
        makeTopic({ difficultyLevel: 'intermediate' }),
        makeTopic({ difficultyLevel: 'advance' }),
        makeTopic({ difficultyLevel: 'expert' })
      ]);
      contentService.getLanguageTabs.and.returnValue([{ id: '1' } as any, { id: '2' } as any]);

      fixture.detectChanges();

      expect(component.stats.totalTopics).toBe(4);
      expect(component.stats.totalSubtopics).toBe(1);
      expect(component.stats.languageTabs).toBe(2);
      expect(component.stats.beginner).toBe(1);
      expect(component.stats.intermediate).toBe(1);
      expect(component.stats.advance).toBe(1);
      expect(component.stats.expert).toBe(1);
    });

    it('sums subtopics across every topic', () => {
      contentService.getTopics.and.returnValue([
        makeTopic({ subtopics: [{} as any, {} as any] }),
        makeTopic({ subtopics: [{} as any] })
      ]);
      fixture.detectChanges();
      expect(component.stats.totalSubtopics).toBe(3);
    });
  });

  describe('loadUserStats()', () => {
    it('populates userStats and clears the loading flag on success', () => {
      fixture.detectChanges();
      expect(component.userStats?.totalUsers).toBe(5);
      expect(component.userStatsLoading).toBeFalse();
    });

    it('clears the loading flag even on failure, keeping stale-but-present stats absent', () => {
      authService.getStats.and.returnValue(throwError(() => new Error('down')));
      fixture.detectChanges();
      expect(component.userStatsLoading).toBeFalse();
      expect(component.userStats).toBeNull();
    });

    it('skips the poll entirely while the tab is hidden', () => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      fixture.detectChanges();
      expect(authService.getStats).not.toHaveBeenCalled();
    });

    it('does not stack a second request while one is already in flight', () => {
      const subject = new Subject<UserStats>();
      authService.getStats.and.returnValue(subject.asObservable());
      fixture.detectChanges();
      component.loadUserStats(); // called again while the first is still pending
      expect(authService.getStats).toHaveBeenCalledTimes(1);
      subject.next(makeStats());
      subject.complete();
    });

    it('polls again every 30 seconds', fakeAsync(() => {
      fixture.detectChanges();
      authService.getStats.calls.reset();
      tick(30000);
      expect(authService.getStats).toHaveBeenCalledTimes(1);
      tick(30000);
      expect(authService.getStats).toHaveBeenCalledTimes(2);
    }));

    it('refreshes immediately when the tab becomes visible again', () => {
      fixture.detectChanges();
      authService.getStats.calls.reset();
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(authService.getStats).toHaveBeenCalled();
    });

    it('does not poll on a visibilitychange event while the tab is still hidden', () => {
      fixture.detectChanges();
      authService.getStats.calls.reset();
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(authService.getStats).not.toHaveBeenCalled();
    });
  });

  describe('ngOnDestroy() — memory leak prevention', () => {
    it('stops the 30s poll interval', fakeAsync(() => {
      fixture.detectChanges();
      authService.getStats.calls.reset();
      fixture.destroy();
      tick(60000);
      expect(authService.getStats).not.toHaveBeenCalled();
    }));

    it('removes the visibilitychange listener', () => {
      fixture.detectChanges();
      fixture.destroy();
      authService.getStats.calls.reset();
      document.dispatchEvent(new Event('visibilitychange'));
      expect(authService.getStats).not.toHaveBeenCalled();
    });

    it('a stats response arriving after destroy does not update a destroyed component', () => {
      const subject = new Subject<UserStats>();
      authService.getStats.and.returnValue(subject.asObservable());
      fixture.detectChanges();
      fixture.destroy();
      expect(() => subject.next(makeStats())).not.toThrow();
    });
  });
});
