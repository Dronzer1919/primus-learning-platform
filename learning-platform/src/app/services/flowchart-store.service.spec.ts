import { FlowchartStoreService } from './flowchart-store.service';
import { FlowNode } from '../models/flowchart.model';

describe('FlowchartStoreService', () => {
  let service: FlowchartStoreService;

  beforeEach(() => {
    localStorage.removeItem('flowchart-diagram');
    localStorage.removeItem('flowchart-session-meta');
    service = new FlowchartStoreService();
  });

  afterEach(() => {
    localStorage.removeItem('flowchart-diagram');
    localStorage.removeItem('flowchart-session-meta');
  });

  describe('load()', () => {
    it('returns an empty diagram when nothing is stored', () => {
      expect(service.load()).toEqual({ nodes: [], edges: [] });
    });

    it('returns the stored diagram', () => {
      const node: FlowNode = { id: 'n1', type: 'rectangle', x: 0, y: 0, w: 120, h: 60, text: '' };
      localStorage.setItem('flowchart-diagram', JSON.stringify({ nodes: [node], edges: [] }));
      expect(service.load().nodes).toEqual([node]);
    });

    it('returns an empty diagram for malformed JSON rather than throwing', () => {
      localStorage.setItem('flowchart-diagram', '{not json');
      expect(() => service.load()).not.toThrow();
      expect(service.load()).toEqual({ nodes: [], edges: [] });
    });

    it('coerces non-array nodes/edges to empty arrays', () => {
      localStorage.setItem('flowchart-diagram', JSON.stringify({ nodes: 'oops', edges: null }));
      expect(service.load()).toEqual({ nodes: [], edges: [] });
    });
  });

  describe('save()', () => {
    it('persists the diagram as JSON', () => {
      const diagram = { nodes: [], edges: [] };
      service.save(diagram);
      expect(JSON.parse(localStorage.getItem('flowchart-diagram')!)).toEqual(diagram);
    });

    it('does not throw when storage is unavailable (e.g. quota exceeded / private mode)', () => {
      spyOn(localStorage, 'setItem').and.throwError('QuotaExceededError');
      expect(() => service.save({ nodes: [], edges: [] })).not.toThrow();
    });
  });

  describe('loadMeta()', () => {
    it('returns null when nothing is stored', () => {
      expect(service.loadMeta()).toBeNull();
    });

    it('returns the stored meta', () => {
      localStorage.setItem('flowchart-session-meta', JSON.stringify({ id: 's1', title: 'My Flow' }));
      expect(service.loadMeta()).toEqual({ id: 's1', title: 'My Flow' });
    });

    it('returns null for malformed JSON', () => {
      localStorage.setItem('flowchart-session-meta', '{not json');
      expect(service.loadMeta()).toBeNull();
    });

    it('returns null for a half-written meta object (id without a title)', () => {
      localStorage.setItem('flowchart-session-meta', JSON.stringify({ id: 's1' }));
      expect(service.loadMeta()).toBeNull();
    });

    it('returns null when the stored value is not an object', () => {
      localStorage.setItem('flowchart-session-meta', JSON.stringify('just a string'));
      expect(service.loadMeta()).toBeNull();
    });
  });

  describe('saveMeta()', () => {
    it('persists a given meta object', () => {
      service.saveMeta({ id: 's1', title: 'My Flow' });
      expect(JSON.parse(localStorage.getItem('flowchart-session-meta')!)).toEqual({ id: 's1', title: 'My Flow' });
    });

    it('removes the key when passed null', () => {
      service.saveMeta({ id: 's1', title: 'My Flow' });
      service.saveMeta(null);
      expect(localStorage.getItem('flowchart-session-meta')).toBeNull();
    });

    it('does not throw when storage is unavailable', () => {
      spyOn(localStorage, 'setItem').and.throwError('QuotaExceededError');
      expect(() => service.saveMeta({ id: 's1', title: 'x' })).not.toThrow();
    });
  });
});
