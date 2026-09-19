import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { BehaviorSubject, Subject } from 'rxjs';
import { RagAssistantComponent } from './rag-assistant.component';
import { RagService } from '../../services/rag.service';
import { ContentService } from '../../services/content.service';
import { RagStreamEvent, RagCitation } from '../../models/rag.model';
import { LanguageTab } from '../../models/content.model';

describe('RagAssistantComponent', () => {
  let fixture: ComponentFixture<RagAssistantComponent>;
  let component: RagAssistantComponent;
  let ragService: jasmine.SpyObj<RagService>;
  let contentService: jasmine.SpyObj<ContentService>;
  let tabsSubject: BehaviorSubject<LanguageTab[]>;
  let router: Router;

  beforeEach(async () => {
    tabsSubject = new BehaviorSubject<LanguageTab[]>([]);
    ragService = jasmine.createSpyObj<RagService>('RagService', ['ask']);
    contentService = jasmine.createSpyObj<ContentService>('ContentService', [], { languageTabs$: tabsSubject.asObservable() });

    await TestBed.configureTestingModule({
      imports: [RagAssistantComponent],
      providers: [
        provideRouter([]),
        { provide: RagService, useValue: ragService },
        { provide: ContentService, useValue: contentService }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);

    fixture = TestBed.createComponent(RagAssistantComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture?.destroy());

  describe('rendering / ngOnInit()', () => {
    it('creates', () => {
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('populates languageTabs from ContentService', () => {
      fixture.detectChanges();
      tabsSubject.next([{ id: '1', name: 'JS', code: 'javascript', order: 1, isActive: true }]);
      expect(component.languageTabs.length).toBe(1);
    });

    it('starts with an empty chat', () => {
      fixture.detectChanges();
      expect(component.messages).toEqual([]);
    });
  });

  describe('send()', () => {
    beforeEach(() => fixture.detectChanges());

    it('is a no-op with blank input', () => {
      component.question = '   ';
      component.send();
      expect(ragService.ask).not.toHaveBeenCalled();
    });

    it('is a no-op while already asking', () => {
      component.question = 'q';
      component.asking = true;
      component.send();
      expect(ragService.ask).not.toHaveBeenCalled();
    });

    it('pushes a user message and a pending assistant message, then clears the input', () => {
      ragService.ask.and.returnValue(new Subject<RagStreamEvent>().asObservable());
      component.question = '  What is a closure?  ';
      component.send();

      expect(component.messages[0]).toEqual({ role: 'user', text: 'What is a closure?' });
      expect(component.messages[1]).toEqual(jasmine.objectContaining({ role: 'assistant', text: '', pending: true }));
      expect(component.question).toBe('');
      expect(component.asking).toBeTrue();
    });

    it('calls ragService.ask with the trimmed question and no scope by default', () => {
      ragService.ask.and.returnValue(new Subject<RagStreamEvent>().asObservable());
      component.question = 'q';
      component.send();
      expect(ragService.ask).toHaveBeenCalledWith('q', undefined);
    });

    it('passes the selected scope through', () => {
      ragService.ask.and.returnValue(new Subject<RagStreamEvent>().asObservable());
      component.scope = 'javascript';
      component.question = 'q';
      component.send();
      expect(ragService.ask).toHaveBeenCalledWith('q', 'javascript');
    });

    it('cancels a still-running previous ask before starting a new one', () => {
      const first = new Subject<RagStreamEvent>();
      ragService.ask.and.returnValue(first.asObservable());
      component.question = 'first';
      component.send();
      expect(first.observed).toBeTrue();

      component.asking = false; // allow a second send()
      const second = new Subject<RagStreamEvent>();
      ragService.ask.and.returnValue(second.asObservable());
      component.question = 'second';
      component.send();

      expect(first.observed).toBeFalse(); // the first subscription was torn down
    });

    describe('stream event handling', () => {
      let stream: Subject<RagStreamEvent>;

      beforeEach(() => {
        stream = new Subject<RagStreamEvent>();
        ragService.ask.and.returnValue(stream.asObservable());
        component.question = 'q';
        component.send();
      });

      function assistantMessage() {
        return component.messages[component.messages.length - 1];
      }

      it('citations event attaches citations to the assistant message', () => {
        const citations: RagCitation[] = [{ topicId: 't1', subtopicId: 's1', title: 'JS > Closures', languagePlatform: 'javascript' }];
        stream.next({ type: 'citations', citations });
        expect(assistantMessage().citations).toEqual(citations);
      });

      it('delta events append text incrementally', () => {
        stream.next({ type: 'delta', text: 'Hello' });
        stream.next({ type: 'delta', text: ' world' });
        expect(assistantMessage().text).toBe('Hello world');
      });

      it('refusal sets a fallback message and marks failed when no text was streamed yet', () => {
        stream.next({ type: 'refusal' });
        expect(assistantMessage().text).toBe("I can't help with that question.");
        expect(assistantMessage().failed).toBeTrue();
      });

      it('refusal keeps any partial text already streamed instead of overwriting it', () => {
        stream.next({ type: 'delta', text: 'Partial answer' });
        stream.next({ type: 'refusal' });
        expect(assistantMessage().text).toBe('Partial answer');
        expect(assistantMessage().failed).toBeTrue();
      });

      it('error event sets the message text and marks failed', () => {
        stream.next({ type: 'error', message: 'Server exploded' });
        expect(assistantMessage().text).toBe('Server exploded');
        expect(assistantMessage().failed).toBeTrue();
      });

      it('done event does not itself change pending/failed (that is complete()\'s job)', () => {
        stream.next({ type: 'delta', text: 'x' });
        stream.next({ type: 'done' });
        expect(assistantMessage().pending).toBeTrue();
      });

      it('on complete(), clears pending and asking', () => {
        stream.next({ type: 'delta', text: 'x' });
        stream.complete();
        expect(assistantMessage().pending).toBeFalse();
        expect(component.asking).toBeFalse();
      });

      it('on an Observable-level error, falls back to a generic message if nothing streamed yet', () => {
        stream.error(new Error('boom'));
        expect(assistantMessage().text).toBe('Something went wrong. Please try again.');
        expect(assistantMessage().failed).toBeTrue();
        expect(assistantMessage().pending).toBeFalse();
        expect(component.asking).toBeFalse();
      });

      it('on an Observable-level error, keeps any partial text already streamed', () => {
        stream.next({ type: 'delta', text: 'so far so good' });
        stream.error(new Error('boom'));
        expect(assistantMessage().text).toBe('so far so good');
      });
    });
  });

  describe('onEnter()', () => {
    beforeEach(() => {
      fixture.detectChanges();
      ragService.ask.and.returnValue(new Subject<RagStreamEvent>().asObservable());
    });

    it('sends on plain Enter and prevents the default newline', () => {
      component.question = 'q';
      const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
      spyOn(event, 'preventDefault');
      component.onEnter(event);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(ragService.ask).toHaveBeenCalled();
    });

    it('does not send on Shift+Enter (newline)', () => {
      component.question = 'q';
      const event = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, cancelable: true });
      component.onEnter(event);
      expect(ragService.ask).not.toHaveBeenCalled();
    });
  });

  describe('openCitation()', () => {
    it('navigates to the content route for the citation', () => {
      fixture.detectChanges();
      component.openCitation({ topicId: 't1', subtopicId: 's1', title: 'x', languagePlatform: 'javascript' });
      expect(router.navigate).toHaveBeenCalledWith(['/user/content', 't1', 's1']);
    });
  });

  describe('clearChat()', () => {
    it('resets messages and asking, and unsubscribes any in-flight ask', () => {
      fixture.detectChanges();
      const stream = new Subject<RagStreamEvent>();
      ragService.ask.and.returnValue(stream.asObservable());
      component.question = 'q';
      component.send();
      expect(component.messages.length).toBe(2);

      component.clearChat();

      expect(component.messages).toEqual([]);
      expect(component.asking).toBeFalse();
      expect(stream.observed).toBeFalse();
    });
  });

  describe('trackByIndex()', () => {
    it('returns the given index', () => {
      fixture.detectChanges();
      expect(component.trackByIndex(3)).toBe(3);
    });
  });

  describe('scrollToBottom() (via send()/delta)', () => {
    it('schedules a scrollIntoView call on the anchor element', fakeAsync(() => {
      fixture.detectChanges();
      const anchor = (component as any).scrollAnchor;
      if (anchor) spyOn(anchor.nativeElement, 'scrollIntoView');

      ragService.ask.and.returnValue(new Subject<RagStreamEvent>().asObservable());
      component.question = 'q';
      component.send();
      tick();

      if (anchor) expect(anchor.nativeElement.scrollIntoView).toHaveBeenCalled();
    }));
  });

  describe('ngOnDestroy() — memory leak', () => {
    it('unsubscribes from languageTabs$', () => {
      fixture.detectChanges();
      fixture.destroy();
      expect(() => tabsSubject.next([{ id: '1', name: 'JS', code: 'javascript', order: 1, isActive: true }])).not.toThrow();
      expect(component.languageTabs).toEqual([]);
    });

    it('aborts an in-flight ask by unsubscribing', () => {
      fixture.detectChanges();
      const stream = new Subject<RagStreamEvent>();
      ragService.ask.and.returnValue(stream.asObservable());
      component.question = 'q';
      component.send();
      expect(stream.observed).toBeTrue();

      fixture.destroy();

      expect(stream.observed).toBeFalse();
    });
  });
});
