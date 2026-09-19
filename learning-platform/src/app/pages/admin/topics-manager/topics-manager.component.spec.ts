import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of, BehaviorSubject, Subject } from 'rxjs';
import { TopicsManagerComponent } from './topics-manager.component';
import { ContentService } from '../../../services/content.service';
import { Topic, Subtopic } from '../../../models/content.model';

function makeTopic(overrides: Partial<Topic> = {}): Topic {
  return {
    id: 't1', title: 'Closures', description: '', difficultyLevel: 'beginner',
    languagePlatform: 'javascript', order: 1, subtopics: [], ...overrides
  };
}

function makeSubtopic(overrides: Partial<Subtopic> = {}): Subtopic {
  return { id: 's1', topicId: 't1', title: 'Intro', order: 1, content: [], ...overrides };
}

describe('TopicsManagerComponent', () => {
  let fixture: ComponentFixture<TopicsManagerComponent>;
  let component: TopicsManagerComponent;
  let contentService: jasmine.SpyObj<ContentService>;
  let topicsSubject: BehaviorSubject<Topic[]>;
  let routeParams: Subject<any>;

  beforeEach(async () => {
    topicsSubject = new BehaviorSubject<Topic[]>([]);
    routeParams = new Subject();
    contentService = jasmine.createSpyObj<ContentService>(
      'ContentService',
      ['updateTopic', 'addTopic', 'deleteTopic', 'updateSubtopic', 'addSubtopic', 'deleteSubtopic'],
      { topics$: topicsSubject.asObservable() }
    );

    await TestBed.configureTestingModule({
      imports: [TopicsManagerComponent],
      providers: [
        { provide: ContentService, useValue: contentService },
        { provide: ActivatedRoute, useValue: { params: routeParams.asObservable() } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TopicsManagerComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture?.destroy());

  function init(level = 'beginner'): void {
    fixture.detectChanges();
    routeParams.next({ level });
  }

  describe('rendering / route params', () => {
    it('creates', () => {
      init();
      expect(component).toBeTruthy();
    });

    it('reads the difficulty level from the route and reloads on change', () => {
      init('beginner');
      topicsSubject.next([makeTopic({ difficultyLevel: 'beginner' }), makeTopic({ id: 't2', difficultyLevel: 'advance' })]);
      expect(component.topics.length).toBe(1);

      routeParams.next({ level: 'advance' });
      expect(component.difficultyLevel).toBe('advance');
      expect(component.topics.length).toBe(1);
      expect(component.topics[0].id).toBe('t2');
    });

    it('renders one card per topic in the current difficulty', () => {
      init();
      topicsSubject.next([makeTopic({ id: 'a' }), makeTopic({ id: 'b' })]);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('.topic-card').length).toBe(2);
    });

    it('sorts topics by order', () => {
      init();
      topicsSubject.next([makeTopic({ id: 'b', order: 2 }), makeTopic({ id: 'a', order: 1 })]);
      expect(component.topics.map((t) => t.id)).toEqual(['a', 'b']);
    });
  });

  describe('getDifficultyLabel() / getDifficultyIcon()', () => {
    it('capitalizes the difficulty label', () => {
      init('beginner');
      expect(component.getDifficultyLabel()).toBe('Beginner');
    });

    it('maps each difficulty to a distinct icon', () => {
      const icons = (['beginner', 'intermediate', 'advance', 'expert'] as const).map((level) => {
        component.difficultyLevel = level;
        return component.getDifficultyIcon();
      });
      expect(new Set(icons).size).toBe(4);
    });
  });

  describe('topic modal', () => {
    beforeEach(() => init());

    it('openTopicModal() blank defaults order to one past the current count', () => {
      topicsSubject.next([makeTopic()]);
      component.openTopicModal();
      expect(component.topicForm.order).toBe(2);
      expect(component.topicForm.difficultyLevel).toBe('beginner');
    });

    it('openTopicModal(topic) prefills the form for editing', () => {
      const topic = makeTopic({ title: 'Edited title' });
      component.openTopicModal(topic);
      expect(component.editingTopic).toBe(topic);
      expect(component.topicForm.title).toBe('Edited title');
    });
  });

  // KNOWN BUG (flagged, not silently fixed here): saveTopic(), deleteTopic(),
  // saveSubtopic(), deleteSubtopic(), and saveContent() all call the corresponding
  // ContentService method but never .subscribe() to what it returns. Exactly the same
  // gap documented in language-tabs-manager.component.spec.ts, and arguably more
  // consequential here: this is the ENTIRE admin content-authoring surface (every topic,
  // subtopic and content block an admin tries to create/edit/delete through this screen)
  // silently not reaching the server. The modal closes and the UI behaves as if the save
  // succeeded either way, since success/failure was never observed. These tests assert
  // the actual (broken) behavior so it's caught the moment someone adds a .subscribe().
  describe('saveTopic() / deleteTopic() / saveSubtopic() / deleteSubtopic() / saveContent() — KNOWN GAP: writes never fire', () => {
    beforeEach(() => init());

    function spySubscribe<T>(obs: import('rxjs').Observable<T>): jasmine.Spy {
      return spyOn(obs, 'subscribe').and.callThrough();
    }

    it('KNOWN GAP — creating a topic builds the request but never subscribes', () => {
      const response$ = of(makeTopic());
      const subscribeSpy = spySubscribe(response$);
      contentService.addTopic.and.returnValue(response$);
      component.openTopicModal();
      component.topicForm = { title: 'New', description: '', difficultyLevel: 'beginner', languagePlatform: 'html', order: 1 };

      component.saveTopic();

      expect(contentService.addTopic).toHaveBeenCalled();
      expect(subscribeSpy).not.toHaveBeenCalled();
      expect(component.isTopicModalOpen).toBeFalse();
    });

    it('KNOWN GAP — editing a topic builds the request but never subscribes', () => {
      const response$ = of(makeTopic());
      const subscribeSpy = spySubscribe(response$);
      contentService.updateTopic.and.returnValue(response$);
      const topic = makeTopic();
      component.openTopicModal(topic);
      component.topicForm = { ...topic, title: 'Edited' };

      component.saveTopic();

      expect(contentService.updateTopic).toHaveBeenCalled();
      expect(subscribeSpy).not.toHaveBeenCalled();
    });

    it('KNOWN GAP — deleting a topic builds the request but never subscribes', () => {
      spyOn(window, 'confirm').and.returnValue(true);
      const response$ = of(undefined as any);
      const subscribeSpy = spySubscribe(response$);
      contentService.deleteTopic.and.returnValue(response$);

      component.deleteTopic(makeTopic());

      expect(contentService.deleteTopic).toHaveBeenCalled();
      expect(subscribeSpy).not.toHaveBeenCalled();
    });

    it('does not call deleteTopic when the confirm dialog is cancelled', () => {
      spyOn(window, 'confirm').and.returnValue(false);
      component.deleteTopic(makeTopic());
      expect(contentService.deleteTopic).not.toHaveBeenCalled();
    });

    it('KNOWN GAP — creating a subtopic builds the request but never subscribes', () => {
      const response$ = of(makeTopic());
      const subscribeSpy = spySubscribe(response$);
      contentService.addSubtopic.and.returnValue(response$);
      const topic = makeTopic();
      component.openSubtopicModal(topic);
      component.subtopicForm = { topicId: topic.id, title: 'New sub', order: 1, content: [] };

      component.saveSubtopic();

      expect(contentService.addSubtopic).toHaveBeenCalledWith(topic.id, jasmine.any(Object));
      expect(subscribeSpy).not.toHaveBeenCalled();
    });

    it('saveSubtopic() is a no-op with no current topic set', () => {
      component.saveSubtopic();
      expect(contentService.addSubtopic).not.toHaveBeenCalled();
      expect(contentService.updateSubtopic).not.toHaveBeenCalled();
    });

    it('KNOWN GAP — editing a subtopic builds the request but never subscribes', () => {
      const response$ = of(makeTopic());
      const subscribeSpy = spySubscribe(response$);
      contentService.updateSubtopic.and.returnValue(response$);
      const topic = makeTopic();
      const subtopic = makeSubtopic();
      component.openSubtopicModal(topic, subtopic);
      component.subtopicForm = { ...subtopic, title: 'Edited sub' };

      component.saveSubtopic();

      expect(contentService.updateSubtopic).toHaveBeenCalledWith(topic.id, jasmine.any(Object));
      expect(subscribeSpy).not.toHaveBeenCalled();
    });

    it('KNOWN GAP — deleting a subtopic builds the request but never subscribes', () => {
      spyOn(window, 'confirm').and.returnValue(true);
      const response$ = of(makeTopic());
      const subscribeSpy = spySubscribe(response$);
      contentService.deleteSubtopic.and.returnValue(response$);

      component.deleteSubtopic(makeTopic(), makeSubtopic());

      expect(contentService.deleteSubtopic).toHaveBeenCalled();
      expect(subscribeSpy).not.toHaveBeenCalled();
    });

    it('KNOWN GAP — adding a content block builds the request but never subscribes', () => {
      const response$ = of(makeTopic());
      const subscribeSpy = spySubscribe(response$);
      contentService.updateSubtopic.and.returnValue(response$);
      const topic = makeTopic();
      const subtopic = makeSubtopic();
      component.openContentModal(topic, subtopic);
      component.contentForm = { type: 'description', order: 1, data: { text: 'hi' } };

      component.saveContent();

      expect(contentService.updateSubtopic).toHaveBeenCalled();
      const [, updatedSubtopic] = contentService.updateSubtopic.calls.mostRecent().args;
      expect((updatedSubtopic as Subtopic).content.length).toBe(1);
      expect(subscribeSpy).not.toHaveBeenCalled();
      expect(component.isContentModalOpen).toBeFalse();
    });

    it('saveContent() is a no-op with no current topic/subtopic set', () => {
      component.saveContent();
      expect(contentService.updateSubtopic).not.toHaveBeenCalled();
    });
  });

  describe('lifecycle / memory leak', () => {
    it('KNOWN GAP — topics$ subscription is still live after the component is destroyed (no ngOnDestroy)', () => {
      init();
      fixture.destroy();
      topicsSubject.next([makeTopic({ id: 'late' })]);
      expect(component.topics.map((t) => t.id)).toEqual(['late']);
    });
  });
});
