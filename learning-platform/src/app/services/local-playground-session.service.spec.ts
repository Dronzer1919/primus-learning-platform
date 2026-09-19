import { TestBed } from '@angular/core/testing';
import { LocalPlaygroundSessionService } from './local-playground-session.service';
import { IndexedDbService, PLAYGROUND_STORE } from '../core/indexed-db.service';
import { LocalPlaygroundSession } from '../models/local-session.model';

function makeSession(overrides: Partial<LocalPlaygroundSession> = {}): LocalPlaygroundSession {
  return {
    _id: '1',
    title: 'A',
    mode: 'web',
    htmlCode: '',
    cssCode: '',
    jsCode: '',
    jsOnlyCode: '',
    tsCode: '',
    selectedTab: 'html',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides
  };
}

// IndexedDbService itself is fully covered (against the real browser API) in
// indexed-db.service.spec.ts. Here it's mocked so these tests isolate what this layer
// alone is responsible for: defaults, trimming, sort order, and merge-on-update.
describe('LocalPlaygroundSessionService', () => {
  let service: LocalPlaygroundSessionService;
  let dbSpy: jasmine.SpyObj<IndexedDbService>;

  beforeEach(() => {
    dbSpy = jasmine.createSpyObj<IndexedDbService>('IndexedDbService', ['getAll', 'get', 'put', 'delete', 'count', 'clear']);
    TestBed.configureTestingModule({
      providers: [{ provide: IndexedDbService, useValue: dbSpy }]
    });
    service = TestBed.inject(LocalPlaygroundSessionService);
  });

  describe('getSessions()', () => {
    it('reads from the playground store', (done) => {
      dbSpy.getAll.and.resolveTo([]);
      service.getSessions().subscribe(() => {
        expect(dbSpy.getAll).toHaveBeenCalledWith(PLAYGROUND_STORE);
        done();
      });
    });

    it('sorts sessions newest-updated first', (done) => {
      const older = makeSession({ _id: 'old', updatedAt: '2024-01-01T00:00:00.000Z' });
      const newer = makeSession({ _id: 'new', updatedAt: '2024-06-01T00:00:00.000Z' });
      dbSpy.getAll.and.resolveTo([older, newer]);

      service.getSessions().subscribe((sessions) => {
        expect(sessions.map((s) => s._id)).toEqual(['new', 'old']);
        done();
      });
    });

    it('resolves an empty array when the store is empty', (done) => {
      dbSpy.getAll.and.resolveTo([]);
      service.getSessions().subscribe((sessions) => {
        expect(sessions).toEqual([]);
        done();
      });
    });
  });

  describe('getSession()', () => {
    it('reads a single session by id', (done) => {
      dbSpy.get.and.resolveTo(makeSession());
      service.getSession('1').subscribe((session) => {
        expect(dbSpy.get).toHaveBeenCalledWith(PLAYGROUND_STORE, '1');
        expect(session?._id).toBe('1');
        done();
      });
    });

    it('resolves undefined for a missing id', (done) => {
      dbSpy.get.and.resolveTo(undefined);
      service.getSession('missing').subscribe((session) => {
        expect(session).toBeUndefined();
        done();
      });
    });
  });

  describe('createSession()', () => {
    it('applies sensible defaults when no title is given', (done) => {
      dbSpy.put.and.resolveTo();
      service.createSession().subscribe((session) => {
        expect(session.title).toBe('New Playground');
        expect(session.mode).toBe('web');
        expect(session.selectedTab).toBe('html');
        expect(session.htmlCode).toBe('');
        expect(session._id).toBeTruthy();
        expect(session.createdAt).toBe(session.updatedAt);
        expect(dbSpy.put).toHaveBeenCalledWith(PLAYGROUND_STORE, session);
        done();
      });
    });

    it('trims a provided title', (done) => {
      dbSpy.put.and.resolveTo();
      service.createSession('  My Session  ').subscribe((session) => {
        expect(session.title).toBe('My Session');
        done();
      });
    });

    it('falls back to the default title when given only whitespace', (done) => {
      dbSpy.put.and.resolveTo();
      service.createSession('   ').subscribe((session) => {
        expect(session.title).toBe('New Playground');
        done();
      });
    });

    it('generates a unique _id on each call', (done) => {
      dbSpy.put.and.resolveTo();
      service.createSession().subscribe((first) => {
        service.createSession().subscribe((second) => {
          expect(first._id).not.toBe(second._id);
          done();
        });
      });
    });
  });

  describe('updateSession()', () => {
    it('merges partial data onto the existing record, preserving untouched fields', (done) => {
      const existing = makeSession({ _id: '1', title: 'Old', jsCode: 'console.log(1)' });
      dbSpy.get.and.resolveTo(existing);
      dbSpy.put.and.resolveTo();

      service.updateSession('1', { title: 'New' }).subscribe((updated) => {
        expect(updated.title).toBe('New');
        expect(updated.jsCode).toBe('console.log(1)');
        expect(updated._id).toBe('1');
        expect(dbSpy.put).toHaveBeenCalledWith(PLAYGROUND_STORE, updated);
        done();
      });
    });

    it('refreshes updatedAt on every update', (done) => {
      const existing = makeSession({ _id: '1', updatedAt: '2020-01-01T00:00:00.000Z' });
      dbSpy.get.and.resolveTo(existing);
      dbSpy.put.and.resolveTo();

      service.updateSession('1', { title: 'New' }).subscribe((updated) => {
        expect(updated.updatedAt).not.toBe('2020-01-01T00:00:00.000Z');
        done();
      });
    });

    it('forces the id to match the id argument, ignoring a conflicting id in the payload', (done) => {
      const existing = makeSession({ _id: '1' });
      dbSpy.get.and.resolveTo(existing);
      dbSpy.put.and.resolveTo();

      service.updateSession('1', { _id: 'spoofed' } as any).subscribe((updated) => {
        expect(updated._id).toBe('1');
        done();
      });
    });
  });

  describe('deleteSession()', () => {
    it('deletes by id from the playground store', (done) => {
      dbSpy.delete.and.resolveTo();
      service.deleteSession('1').subscribe(() => {
        expect(dbSpy.delete).toHaveBeenCalledWith(PLAYGROUND_STORE, '1');
        done();
      });
    });
  });

  describe('count() / clearAll()', () => {
    it('count() reads from the playground store', (done) => {
      dbSpy.count.and.resolveTo(3);
      service.count().subscribe((n) => {
        expect(n).toBe(3);
        expect(dbSpy.count).toHaveBeenCalledWith(PLAYGROUND_STORE);
        done();
      });
    });

    it('clearAll() clears the playground store', (done) => {
      dbSpy.clear.and.resolveTo();
      service.clearAll().subscribe(() => {
        expect(dbSpy.clear).toHaveBeenCalledWith(PLAYGROUND_STORE);
        done();
      });
    });
  });
});
