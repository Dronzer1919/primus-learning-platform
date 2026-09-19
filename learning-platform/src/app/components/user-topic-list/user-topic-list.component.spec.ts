import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { UserTopicListComponent } from './user-topic-list.component';
import { ContentService } from '../../services/content.service';
import { Topic } from '../../models/content.model';

function makeTopic(overrides: Partial<Topic> = {}): Topic {
  return {
    id: 't1', title: 'Closures', description: '', difficultyLevel: 'beginner',
    languagePlatform: 'javascript', order: 1, subtopics: [], ...overrides
  };
}

describe('UserTopicListComponent', () => {
  let fixture: ComponentFixture<UserTopicListComponent>;
  let component: UserTopicListComponent;
  let topicsSubject: BehaviorSubject<Topic[]>;
  let contentService: jasmine.SpyObj<ContentService>;

  beforeEach(async () => {
    topicsSubject = new BehaviorSubject<Topic[]>([]);
    contentService = jasmine.createSpyObj<ContentService>('ContentService', [], {
      topics$: topicsSubject.asObservable()
    });

    await TestBed.configureTestingModule({
      imports: [UserTopicListComponent],
      providers: [provideRouter([]), { provide: ContentService, useValue: contentService }]
    }).compileComponents();

    fixture = TestBed.createComponent(UserTopicListComponent);
    component = fixture.componentInstance;
    component.difficultyLevel = 'beginner';
    component.selectedLanguage = 'javascript';
  });

  afterEach(() => fixture?.destroy());

  // ---------- Rendering ----------
  describe('rendering', () => {
    it('creates', () => {
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('renders nothing extra when there are no matching topics', () => {
      fixture.detectChanges();
      expect(component.topics).toEqual([]);
    });
  });

  // ---------- loadTopics() filtering ----------
  describe('loadTopics()', () => {
    it('filters by both difficulty and language', () => {
      fixture.detectChanges();
      topicsSubject.next([
        makeTopic({ id: 'a', difficultyLevel: 'beginner', languagePlatform: 'javascript' }),
        makeTopic({ id: 'b', difficultyLevel: 'advance', languagePlatform: 'javascript' }),
        makeTopic({ id: 'c', difficultyLevel: 'beginner', languagePlatform: 'html' })
      ]);
      expect(component.topics.map((t) => t.id)).toEqual(['a']);
    });

    it('sorts matching topics by order', () => {
      fixture.detectChanges();
      topicsSubject.next([
        makeTopic({ id: 'second', order: 2 }),
        makeTopic({ id: 'first', order: 1 })
      ]);
      expect(component.topics.map((t) => t.id)).toEqual(['first', 'second']);
    });

    it('ngOnChanges() re-filters when inputs change', () => {
      fixture.detectChanges();
      topicsSubject.next([
        makeTopic({ id: 'js', languagePlatform: 'javascript' }),
        makeTopic({ id: 'html', languagePlatform: 'html' })
      ]);
      expect(component.topics.map((t) => t.id)).toEqual(['js']);

      component.selectedLanguage = 'html';
      component.ngOnChanges();
      expect(component.topics.map((t) => t.id)).toEqual(['html']);
    });
  });

  // ---------- Expand/collapse ----------
  describe('toggleTopic() / isExpanded()', () => {
    beforeEach(() => fixture.detectChanges());

    it('expands a collapsed topic', () => {
      component.toggleTopic('t1');
      expect(component.isExpanded('t1')).toBeTrue();
    });

    it('collapses an expanded topic', () => {
      component.toggleTopic('t1');
      component.toggleTopic('t1');
      expect(component.isExpanded('t1')).toBeFalse();
    });

    it('tracks multiple expanded topics independently', () => {
      component.toggleTopic('a');
      component.toggleTopic('b');
      expect(component.isExpanded('a')).toBeTrue();
      expect(component.isExpanded('b')).toBeTrue();
      component.toggleTopic('a');
      expect(component.isExpanded('a')).toBeFalse();
      expect(component.isExpanded('b')).toBeTrue();
    });
  });

  // ---------- onSubtopicClick() ----------
  describe('onSubtopicClick()', () => {
    it('emits topicSelected', () => {
      fixture.detectChanges();
      const spy = jasmine.createSpy();
      component.topicSelected.subscribe(spy);
      component.onSubtopicClick();
      expect(spy).toHaveBeenCalled();
    });
  });

  // ---------- Enterprise: memory leak (KNOWN GAP) ----------
  // KNOWN GAP (flagged, not silently fixed here): loadTopics() subscribes to the
  // root-provided ContentService's topics$ BehaviorSubject on every ngOnInit/ngOnChanges
  // call, but the component has no ngOnDestroy to unsubscribe. Since topics$ outlives
  // any one instance of this component, each visit to a page containing it (e.g.
  // navigating between difficulty levels) leaves one more subscription running forever.
  // This test documents the current (leaky) behavior so it's caught the moment someone
  // adds the missing ngOnDestroy — flip the assertion then.
  describe('lifecycle / memory leak', () => {
    it('KNOWN GAP — topics$ subscription is still live after the component is destroyed', () => {
      fixture.detectChanges();
      fixture.destroy();

      // If unsubscribed on destroy, this emission would not reach component.topics.
      // Today it still does — that is the gap.
      topicsSubject.next([makeTopic({ id: 'late' })]);
      expect(component.topics.map((t) => t.id)).toEqual(['late']);
    });

    it('each (re)load adds another subscription — repeated calls multiply emission handling', () => {
      fixture.detectChanges();
      const initialObserverCount = (topicsSubject as any).observers?.length ?? 0;
      component.loadTopics();
      component.loadTopics();
      const afterObserverCount = (topicsSubject as any).observers?.length ?? 0;
      expect(afterObserverCount).toBeGreaterThan(initialObserverCount);
    });
  });
});
