import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { Subject, throwError } from 'rxjs';
import { ContentViewerComponent } from './content-viewer.component';
import { ContentService } from '../../services/content.service';

describe('ContentViewerComponent', () => {
  let fixture: ComponentFixture<ContentViewerComponent>;
  let component: ContentViewerComponent;
  let contentService: jasmine.SpyObj<ContentService>;
  let paramsSubject: Subject<any>;

  beforeEach(async () => {
    paramsSubject = new Subject();
    contentService = jasmine.createSpyObj<ContentService>('ContentService', ['getSubtopicContent']);

    await TestBed.configureTestingModule({
      imports: [ContentViewerComponent],
      providers: [
        { provide: ContentService, useValue: contentService },
        { provide: ActivatedRoute, useValue: { params: paramsSubject.asObservable() } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ContentViewerComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture?.destroy());

  function emitParams(topicId = 't1', subtopicId = 's1'): void {
    paramsSubject.next({ topicId, subtopicId });
  }

  function fullData(overrides: any = {}) {
    return {
      topic: { id: 't1', title: 'JS Basics', description: 'desc' },
      subtopic: {
        _id: 's1',
        title: 'Closures',
        order: 1,
        content: [
          { id: 'c1', type: 'description', order: 1, data: { text: 'A closure is...' } }
        ]
      },
      ...overrides
    };
  }

  // ---------- Rendering ----------
  describe('rendering', () => {
    it('creates', () => {
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('shows the loading state before params resolve', () => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.loading-container')).toBeTruthy();
    });

    it('stays in the loading state while the request is still pending', () => {
      const subject = new Subject<any>();
      contentService.getSubtopicContent.and.returnValue(subject.asObservable());
      fixture.detectChanges();
      emitParams();
      fixture.detectChanges();
      expect(component.loading).toBeTrue();
      expect(fixture.nativeElement.querySelector('.loading-container')).toBeTruthy();
    });

    it('renders the loaded topic/subtopic and description block', () => {
      contentService.getSubtopicContent.and.returnValue(new Subject().asObservable());
      fixture.detectChanges();
      const subject = new Subject<any>();
      contentService.getSubtopicContent.and.returnValue(subject.asObservable());
      emitParams();
      subject.next(fullData());
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.content-viewer')).toBeTruthy();
      expect(fixture.nativeElement.textContent).toContain('Closures');
      expect(fixture.nativeElement.textContent).toContain('A closure is...');
    });

    it('shows the error state when the request fails', () => {
      contentService.getSubtopicContent.and.returnValue(throwError(() => new Error('down')));
      fixture.detectChanges();
      emitParams();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.error-container')).toBeTruthy();
    });

    it('shows "not found" when the API returns success but no topic/subtopic', () => {
      const subject = new Subject<any>();
      contentService.getSubtopicContent.and.returnValue(subject.asObservable());
      fixture.detectChanges();
      emitParams();
      subject.next({});
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.no-selection, .error-container')).toBeTruthy();
    });

    it('shows the empty-content hint when the subtopic has no content blocks', () => {
      const subject = new Subject<any>();
      contentService.getSubtopicContent.and.returnValue(subject.asObservable());
      fixture.detectChanges();
      emitParams();
      subject.next(fullData({ subtopic: { _id: 's1', title: 'Empty', order: 1, content: [] } }));
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.empty-content')).toBeTruthy();
    });
  });

  // ---------- Method-level logic ----------
  describe('ngOnInit() / route param handling', () => {
    it('calls getSubtopicContent with the route params', () => {
      contentService.getSubtopicContent.and.returnValue(new Subject().asObservable());
      fixture.detectChanges();
      emitParams('topicA', 'subA');
      expect(contentService.getSubtopicContent).toHaveBeenCalledWith('topicA', 'subA');
    });

    it('cancels the previous request when params change quickly (switchMap)', () => {
      let callCount = 0;
      const subjects: Subject<any>[] = [];
      contentService.getSubtopicContent.and.callFake(() => {
        const s = new Subject<any>();
        subjects.push(s);
        callCount++;
        return s.asObservable();
      });
      fixture.detectChanges();

      emitParams('t1', 's1');
      emitParams('t1', 's2'); // fires before the first resolves

      expect(callCount).toBe(2);
      subjects[0].next(fullData()); // late response from the cancelled request
      // switchMap unsubscribes the first inner observable, so this "late" next()
      // reaching a live subject still just calls a dead subscriber — verify no crash
      // and that the component did not apply the stale first-request's data as current.
      expect(() => subjects[1].next(fullData({ subtopic: { _id: 's2', title: 'Second', order: 1, content: [] } }))).not.toThrow();
      fixture.detectChanges();
      expect(component.subtopic?.id).toBe('s2');
    });

    it('resets loading/error at the start of every param change', () => {
      contentService.getSubtopicContent.and.returnValue(throwError(() => new Error('fail')));
      fixture.detectChanges();
      emitParams();
      expect(component.error).toBeTruthy();

      const subject = new Subject<any>();
      contentService.getSubtopicContent.and.returnValue(subject.asObservable());
      emitParams('t2', 's2');
      expect(component.loading).toBeTrue();
      expect(component.error).toBe('');
    });

    it('defends against a subtopic with a non-array content field', () => {
      const subject = new Subject<any>();
      contentService.getSubtopicContent.and.returnValue(subject.asObservable());
      fixture.detectChanges();
      emitParams();
      expect(() =>
        subject.next(fullData({ subtopic: { _id: 's1', title: 'Bad', order: 1, content: null } }))
      ).not.toThrow();
      expect(component.contentBlocks).toEqual([]);
    });

    it('sorts content blocks by order', () => {
      const subject = new Subject<any>();
      contentService.getSubtopicContent.and.returnValue(subject.asObservable());
      fixture.detectChanges();
      emitParams();
      subject.next(
        fullData({
          subtopic: {
            _id: 's1', title: 'X', order: 1,
            content: [
              { id: 'c2', type: 'description', order: 2, data: {} },
              { id: 'c1', type: 'description', order: 1, data: {} }
            ]
          }
        })
      );
      expect(component.contentBlocks.map((b) => b.id)).toEqual(['c1', 'c2']);
    });
  });

  // ---------- Pure helpers ----------
  describe('getYoutubeThumbnail() / getYoutubeWatchUrl()', () => {
    beforeEach(() => {
      contentService.getSubtopicContent.and.returnValue(new Subject().asObservable());
      fixture.detectChanges();
    });

    it('builds the hqdefault thumbnail URL', () => {
      expect(component.getYoutubeThumbnail('abc123')).toBe('https://img.youtube.com/vi/abc123/hqdefault.jpg');
    });

    it('builds the watch URL', () => {
      expect(component.getYoutubeWatchUrl('abc123')).toBe('https://www.youtube.com/watch?v=abc123');
    });
  });

  describe('copyCode()', () => {
    beforeEach(() => {
      contentService.getSubtopicContent.and.returnValue(new Subject().asObservable());
      fixture.detectChanges();
    });

    it('writes the code to the clipboard', () => {
      const writeText = jasmine.createSpy().and.resolveTo();
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      component.copyCode('console.log(1)');
      expect(writeText).toHaveBeenCalledWith('console.log(1)');
    });

    it('does not throw when the clipboard API rejects (unfocused tab, insecure origin, etc.)', () => {
      const writeText = jasmine.createSpy().and.rejectWith(new Error('denied'));
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      expect(() => component.copyCode('x')).not.toThrow();
    });

    it('does not throw when the Clipboard API is unavailable', () => {
      Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
      expect(() => component.copyCode('x')).not.toThrow();
    });
  });

  // ---------- Enterprise: memory leak ----------
  describe('lifecycle / memory leak', () => {
    it('does not update state from a response arriving after the component is destroyed', () => {
      const subject = new Subject<any>();
      contentService.getSubtopicContent.and.returnValue(subject.asObservable());
      fixture.detectChanges();
      emitParams();
      fixture.destroy();
      expect(() => subject.next(fullData())).not.toThrow();
      expect(component.topic).toBeNull();
    });
  });
});
