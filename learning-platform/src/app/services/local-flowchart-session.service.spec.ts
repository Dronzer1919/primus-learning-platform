import { TestBed } from '@angular/core/testing';
import { LocalFlowchartSessionService } from './local-flowchart-session.service';
import { IndexedDbService, FLOWCHART_STORE } from '../core/indexed-db.service';
import { LocalFlowchartSession } from '../models/local-session.model';

function makeSession(overrides: Partial<LocalFlowchartSession> = {}): LocalFlowchartSession {
  return {
    _id: '1',
    title: 'A',
    nodes: [],
    edges: [],
    canvasBg: 'dots',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides
  };
}

describe('LocalFlowchartSessionService', () => {
  let service: LocalFlowchartSessionService;
  let dbSpy: jasmine.SpyObj<IndexedDbService>;

  beforeEach(() => {
    dbSpy = jasmine.createSpyObj<IndexedDbService>('IndexedDbService', ['getAll', 'get', 'put', 'delete', 'count', 'clear']);
    TestBed.configureTestingModule({
      providers: [{ provide: IndexedDbService, useValue: dbSpy }]
    });
    service = TestBed.inject(LocalFlowchartSessionService);
  });

  describe('getSessions()', () => {
    it('reads from the flowchart store', (done) => {
      dbSpy.getAll.and.resolveTo([]);
      service.getSessions().subscribe(() => {
        expect(dbSpy.getAll).toHaveBeenCalledWith(FLOWCHART_STORE);
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
  });

  describe('getSession()', () => {
    it('resolves undefined for a missing id', (done) => {
      dbSpy.get.and.resolveTo(undefined);
      service.getSession('missing').subscribe((session) => {
        expect(session).toBeUndefined();
        done();
      });
    });
  });

  describe('createSession()', () => {
    it('applies defaults for title/nodes/edges/canvasBg when none are given', (done) => {
      dbSpy.put.and.resolveTo();
      service.createSession({}).subscribe((session) => {
        expect(session.title).toBe('New Flowchart');
        expect(session.nodes).toEqual([]);
        expect(session.edges).toEqual([]);
        expect(session.canvasBg).toBe('dots');
        expect(session._id).toBeTruthy();
        expect(dbSpy.put).toHaveBeenCalledWith(FLOWCHART_STORE, session);
        done();
      });
    });

    it('trims a provided title', (done) => {
      dbSpy.put.and.resolveTo();
      service.createSession({ title: '  Flow  ' }).subscribe((session) => {
        expect(session.title).toBe('Flow');
        done();
      });
    });

    it('falls back to default title when given only whitespace', (done) => {
      dbSpy.put.and.resolveTo();
      service.createSession({ title: '   ' }).subscribe((session) => {
        expect(session.title).toBe('New Flowchart');
        done();
      });
    });

    it('preserves provided nodes/edges/canvasBg rather than defaulting them', (done) => {
      dbSpy.put.and.resolveTo();
      const nodes = [{ id: 'n1' }] as any;
      const edges = [{ id: 'e1' }] as any;
      service.createSession({ nodes, edges, canvasBg: 'grid' }).subscribe((session) => {
        expect(session.nodes).toBe(nodes);
        expect(session.edges).toBe(edges);
        expect(session.canvasBg).toBe('grid');
        done();
      });
    });
  });

  describe('updateSession()', () => {
    it('merges the payload onto the existing record and refreshes updatedAt', (done) => {
      const existing = makeSession({ _id: '1', title: 'Old', updatedAt: '2020-01-01T00:00:00.000Z' });
      dbSpy.get.and.resolveTo(existing);
      dbSpy.put.and.resolveTo();

      service.updateSession('1', { title: 'New' }).subscribe((updated) => {
        expect(updated.title).toBe('New');
        expect(updated._id).toBe('1');
        expect(updated.updatedAt).not.toBe('2020-01-01T00:00:00.000Z');
        done();
      });
    });
  });

  describe('deleteSession()', () => {
    it('deletes by id from the flowchart store', (done) => {
      dbSpy.delete.and.resolveTo();
      service.deleteSession('1').subscribe(() => {
        expect(dbSpy.delete).toHaveBeenCalledWith(FLOWCHART_STORE, '1');
        done();
      });
    });
  });

  describe('count() / clearAll()', () => {
    it('count() reads from the flowchart store', (done) => {
      dbSpy.count.and.resolveTo(2);
      service.count().subscribe((n) => {
        expect(n).toBe(2);
        expect(dbSpy.count).toHaveBeenCalledWith(FLOWCHART_STORE);
        done();
      });
    });

    it('clearAll() clears the flowchart store', (done) => {
      dbSpy.clear.and.resolveTo();
      service.clearAll().subscribe(() => {
        expect(dbSpy.clear).toHaveBeenCalledWith(FLOWCHART_STORE);
        done();
      });
    });
  });
});
