import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ContentService } from './content.service';
import { environment } from '../../environments/environment';
import { Topic, UserNote } from '../models/content.model';

const apiUrl = environment.apiUrl;

function backendTopic(overrides: any = {}): any {
  return {
    _id: 't1',
    title: 'Closures',
    description: 'What closures are',
    difficultyLevel: 'beginner',
    languagePlatform: 'javascript',
    order: 1,
    subtopics: [],
    ...overrides
  };
}

describe('ContentService', () => {
  let service: ContentService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
  });

  afterEach(() => httpMock?.verify());

  /**
   * ContentService fires GET /language-tabs/active and GET /topics from its own
   * constructor. Every test that injects it must account for those two requests
   * before doing anything else, or httpMock.verify() fails on a "pending request"
   * that has nothing to do with what the test is actually checking.
   */
  function inject(opts: { tabsBody?: any; topicsBody?: any } = {}): ContentService {
    service = TestBed.inject(ContentService);
    httpMock = TestBed.inject(HttpTestingController);

    httpMock.expectOne(`${apiUrl}/language-tabs/active`).flush(
      opts.tabsBody ?? { success: true, data: [] }
    );
    httpMock.expectOne(`${apiUrl}/topics`).flush(opts.topicsBody ?? { success: true, data: [] });

    return service;
  }

  describe('constructor: loadLanguageTabs()', () => {
    it('maps a successful response onto languageTabs$', () => {
      const raw = [{ _id: 'x1', name: 'HTML', code: 'html', order: 1, isActive: true }];
      inject({ tabsBody: { success: true, data: raw } });
      expect(service.getLanguageTabs()).toEqual([
        { id: 'x1', name: 'HTML', code: 'html', order: 1, isActive: true }
      ]);
    });

    it('falls back to the built-in 8 default tabs when the API has nothing and none are loaded yet', () => {
      inject({ tabsBody: { success: false } });
      expect(service.getLanguageTabs().length).toBe(8);
      expect(service.getLanguageTabs().map((t) => t.code)).toContain('html');
    });

    it('falls back to defaults for a malformed (non-array data) response', () => {
      inject({ tabsBody: { success: true, data: 'not-an-array' } });
      expect(service.getLanguageTabs().length).toBe(8);
    });

    it('does not throw when the request errors outright', () => {
      expect(() => {
        service = TestBed.inject(ContentService);
        httpMock = TestBed.inject(HttpTestingController);
        httpMock.expectOne(`${apiUrl}/language-tabs/active`).error(new ProgressEvent('network'));
        httpMock.expectOne(`${apiUrl}/topics`).flush({ success: true, data: [] });
      }).not.toThrow();
      // The network failure still leaves the app usable via the default tabs.
      expect(service.getLanguageTabs().length).toBe(8);
    });
  });

  describe('constructor: loadTopics()', () => {
    it('maps a successful response, defaulting missing subtopics to []', () => {
      inject({ topicsBody: { success: true, data: [backendTopic()] } });
      const topics = service.getTopics();
      expect(topics.length).toBe(1);
      expect(topics[0].subtopics).toEqual([]);
    });

    it('defends against a subtopic with non-array subSubtopics/content', () => {
      inject({
        topicsBody: {
          success: true,
          data: [backendTopic({ subtopics: [{ _id: 's1', title: 'Intro', subSubtopics: null, content: null }] })]
        }
      });
      const topic = service.getTopics()[0];
      expect(topic.subtopics[0].subSubtopics).toEqual([]);
      expect(topic.subtopics[0].content).toEqual([]);
    });

    it('leaves the topic list empty (not throwing) on a malformed response', () => {
      expect(() => inject({ topicsBody: { success: true, data: null } })).not.toThrow();
      expect(service.getTopics()).toEqual([]);
    });

    it('does not throw on a completely malformed topic object', () => {
      expect(() => inject({ topicsBody: { success: true, data: [null] } })).not.toThrow();
    });
  });

  describe('synchronous getters', () => {
    beforeEach(() => {
      inject({
        topicsBody: {
          success: true,
          data: [
            backendTopic({ _id: 't1', difficultyLevel: 'beginner', languagePlatform: 'javascript', order: 2 }),
            backendTopic({ _id: 't2', difficultyLevel: 'advance', languagePlatform: 'javascript', order: 1 }),
            backendTopic({ _id: 't3', difficultyLevel: 'beginner', languagePlatform: 'html', order: 3 })
          ]
        }
      });
    });

    it('getTopics() returns everything currently loaded', () => {
      expect(service.getTopics().length).toBe(3);
    });

    it('getTopicsByDifficulty() filters correctly', () => {
      expect(service.getTopicsByDifficulty('beginner').map((t) => t.id)).toEqual(['t1', 't3']);
    });

    it('getTopicsByLanguage() filters correctly', () => {
      expect(service.getTopicsByLanguage('html').map((t) => t.id)).toEqual(['t3']);
    });
  });

  describe('getTopicById()', () => {
    beforeEach(() => inject());

    it('maps a successful response through mapTopicFromBackend', (done) => {
      service.getTopicById('t1').subscribe((topic) => {
        expect(topic?.id).toBe('t1');
        done();
      });
      httpMock.expectOne(`${apiUrl}/topics/t1`).flush({ success: true, data: backendTopic({ _id: 't1' }) });
    });

    it('resolves null when the API reports success: false', (done) => {
      service.getTopicById('missing').subscribe((topic) => {
        expect(topic).toBeNull();
        done();
      });
      httpMock.expectOne(`${apiUrl}/topics/missing`).flush({ success: false });
    });
  });

  describe('getSubtopicContent()', () => {
    beforeEach(() => inject());

    it('resolves the data payload on success', (done) => {
      service.getSubtopicContent('t1', 's1').subscribe((data) => {
        expect(data).toEqual({ foo: 'bar' });
        done();
      });
      httpMock.expectOne(`${apiUrl}/topics/t1/subtopics/s1`).flush({ success: true, data: { foo: 'bar' } });
    });

    it('resolves null on success: false', (done) => {
      service.getSubtopicContent('t1', 's1').subscribe((data) => {
        expect(data).toBeNull();
        done();
      });
      httpMock.expectOne(`${apiUrl}/topics/t1/subtopics/s1`).flush({ success: false });
    });
  });

  describe('language tab CRUD (with reload-on-success)', () => {
    beforeEach(() => inject());

    it('addLanguageTab() POSTs, maps the response, and triggers a reload on success', (done) => {
      service.addLanguageTab({ name: 'Rust', code: 'rust' as any, order: 9, isActive: true }).subscribe((tab) => {
        expect(tab).toEqual({ id: 'new-1' } as any);
        done();
      });
      const req = httpMock.expectOne(`${apiUrl}/language-tabs`);
      expect(req.request.method).toBe('POST');
      req.flush({ success: true, data: { id: 'new-1' } });
      // The tap() reload — must be flushed or verify() fails.
      httpMock.expectOne(`${apiUrl}/language-tabs/active`).flush({ success: true, data: [] });
    });

    it('does not reload when the API reports success: false', (done) => {
      service.addLanguageTab({ name: 'Rust', code: 'rust' as any, order: 9, isActive: true }).subscribe(() => {
        httpMock.expectNone(`${apiUrl}/language-tabs/active`);
        expect().nothing();
        done();
      });
      httpMock.expectOne(`${apiUrl}/language-tabs`).flush({ success: false, data: null });
    });

    it('updateLanguageTab() PUTs to the tab-specific URL', (done) => {
      service.updateLanguageTab({ id: 'x1', name: 'HTML5', code: 'html', order: 1, isActive: true }).subscribe(() => done());
      const req = httpMock.expectOne(`${apiUrl}/language-tabs/x1`);
      expect(req.request.method).toBe('PUT');
      req.flush({ success: true, data: {} });
      httpMock.expectOne(`${apiUrl}/language-tabs/active`).flush({ success: true, data: [] });
    });

    it('deleteLanguageTab() DELETEs and resolves void', (done) => {
      service.deleteLanguageTab('x1').subscribe((result) => {
        expect(result).toBeUndefined();
        done();
      });
      const req = httpMock.expectOne(`${apiUrl}/language-tabs/x1`);
      expect(req.request.method).toBe('DELETE');
      req.flush({ success: true });
      httpMock.expectOne(`${apiUrl}/language-tabs/active`).flush({ success: true, data: [] });
    });
  });

  describe('topic CRUD (with reload-on-success)', () => {
    beforeEach(() => inject());

    it('addTopic() POSTs and maps the response through mapTopicFromBackend', (done) => {
      service.addTopic({} as any).subscribe((topic) => {
        expect(topic.id).toBe('new-t');
        done();
      });
      httpMock.expectOne(`${apiUrl}/topics`).flush({ success: true, data: backendTopic({ _id: 'new-t' }) });
      httpMock.expectOne(`${apiUrl}/topics`).flush({ success: true, data: [] }); // reload
    });

    it('deleteTopic() DELETEs and resolves void', (done) => {
      service.deleteTopic('t1').subscribe((result) => {
        expect(result).toBeUndefined();
        done();
      });
      httpMock.expectOne(`${apiUrl}/topics/t1`).flush({ success: true });
      httpMock.expectOne(`${apiUrl}/topics`).flush({ success: true, data: [] }); // reload
    });
  });

  describe('subtopic CRUD', () => {
    beforeEach(() => inject());

    it('addSubtopic() POSTs to the topic-scoped URL', (done) => {
      service.addSubtopic('t1', {} as any).subscribe((topic) => {
        expect(topic.id).toBe('t1');
        done();
      });
      const req = httpMock.expectOne(`${apiUrl}/topics/t1/subtopics`);
      expect(req.request.method).toBe('POST');
      req.flush({ success: true, data: backendTopic({ _id: 't1' }) });
      httpMock.expectOne(`${apiUrl}/topics`).flush({ success: true, data: [] });
    });

    it('deleteSubtopic() DELETEs to the subtopic-scoped URL', (done) => {
      service.deleteSubtopic('t1', 's1').subscribe(() => done());
      const req = httpMock.expectOne(`${apiUrl}/topics/t1/subtopics/s1`);
      expect(req.request.method).toBe('DELETE');
      req.flush({ success: true, data: backendTopic({ _id: 't1' }) });
      httpMock.expectOne(`${apiUrl}/topics`).flush({ success: true, data: [] });
    });
  });

  describe('loadUserNotes()', () => {
    beforeEach(() => inject());

    it('maps notes, converting date strings to Date objects', (done) => {
      service.loadUserNotes().subscribe(() => {
        const notes = service.getUserNotes('u1');
        expect(notes[0].createdAt).toEqual(jasmine.any(Date));
        done();
      });
      httpMock.expectOne(`${apiUrl}/notes`).flush({
        success: true,
        data: [
          { _id: 'n1', userId: 'u1', content: 'hi', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z', isPinned: false }
        ]
      });
    });

    it('leaves userNotes$ unchanged on a malformed response', (done) => {
      service.loadUserNotes().subscribe(() => {
        expect(service.getUserNotes('u1')).toEqual([]);
        done();
      });
      httpMock.expectOne(`${apiUrl}/notes`).flush({ success: false });
    });
  });

  describe('getUserNotes()', () => {
    beforeEach(() => inject());

    it('filters notes by userId', (done) => {
      service.loadUserNotes().subscribe(() => {
        expect(service.getUserNotes('u1').length).toBe(1);
        expect(service.getUserNotes('u2').length).toBe(1);
        expect(service.getUserNotes('nobody').length).toBe(0);
        done();
      });
      httpMock.expectOne(`${apiUrl}/notes`).flush({
        success: true,
        data: [
          { _id: 'n1', userId: 'u1', content: 'a', createdAt: '2024-01-01', updatedAt: '2024-01-01', isPinned: false },
          { _id: 'n2', userId: 'u2', content: 'b', createdAt: '2024-01-01', updatedAt: '2024-01-01', isPinned: false }
        ]
      });
    });
  });

  describe('user note CRUD (with reload-on-success)', () => {
    beforeEach(() => inject());

    it('addUserNote() POSTs and maps the created note', (done) => {
      service.addUserNote({ userId: 'u1', content: 'hello', isPinned: false }).subscribe((note: UserNote) => {
        expect(note.id).toBe('n1');
        expect(note.createdAt).toEqual(jasmine.any(Date));
        done();
      });
      httpMock.expectOne(`${apiUrl}/notes`).flush({
        success: true,
        data: { _id: 'n1', userId: 'u1', content: 'hello', createdAt: '2024-01-01', updatedAt: '2024-01-01', isPinned: false }
      });
      httpMock.expectOne(`${apiUrl}/notes`).flush({ success: true, data: [] }); // reload
    });

    it('updateUserNote() PUTs to the note-specific URL', (done) => {
      service
        .updateUserNote({ id: 'n1', userId: 'u1', content: 'edited', createdAt: new Date(), updatedAt: new Date(), isPinned: false })
        .subscribe(() => done());
      const req = httpMock.expectOne(`${apiUrl}/notes/n1`);
      expect(req.request.method).toBe('PUT');
      req.flush({
        success: true,
        data: { _id: 'n1', userId: 'u1', content: 'edited', createdAt: '2024-01-01', updatedAt: '2024-01-01', isPinned: false }
      });
      httpMock.expectOne(`${apiUrl}/notes`).flush({ success: true, data: [] }); // reload
    });

    it('deleteUserNote() DELETEs and resolves void', (done) => {
      service.deleteUserNote('n1').subscribe((result) => {
        expect(result).toBeUndefined();
        done();
      });
      httpMock.expectOne(`${apiUrl}/notes/n1`).flush({ success: true });
      httpMock.expectOne(`${apiUrl}/notes`).flush({ success: true, data: [] }); // reload
    });

    it('propagates an error instead of silently resolving', (done) => {
      service.deleteUserNote('n1').subscribe({
        next: () => fail('expected an error'),
        error: (err) => {
          expect(err.status).toBe(500);
          done();
        }
      });
      httpMock.expectOne(`${apiUrl}/notes/n1`).flush({}, { status: 500, statusText: 'Server Error' });
    });
  });
});
