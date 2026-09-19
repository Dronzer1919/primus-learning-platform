import { TestBed } from '@angular/core/testing';
import { IndexedDbService, PLAYGROUND_STORE, FLOWCHART_STORE } from './indexed-db.service';

interface Row {
  _id: string;
  value: string;
}

// Runs against the real browser IndexedDB (available in headless Chrome) rather than a
// mock/fake — for a thin wrapper like this one, the actual persistence semantics (does a
// put() really overwrite, does delete() of a missing key really not throw) are exactly
// what's worth verifying, and a hand-rolled fake could easily "pass" while diverging from
// real IndexedDB behavior.
describe('IndexedDbService', () => {
  let service: IndexedDbService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IndexedDbService);
  });

  afterEach(async () => {
    await service.clear(PLAYGROUND_STORE);
    await service.clear(FLOWCHART_STORE);
  });

  it('creates', () => {
    expect(service).toBeTruthy();
  });

  it('isSupported() reflects that IndexedDB is available in this (real browser) test environment', () => {
    expect(service.isSupported()).toBeTrue();
  });

  describe('put() / get() / getAll()', () => {
    it('returns undefined for a key that was never written', async () => {
      const result = await service.get<Row>(PLAYGROUND_STORE, 'missing-id');
      expect(result).toBeUndefined();
    });

    it('stores and retrieves a record by its _id keyPath', async () => {
      await service.put<Row>(PLAYGROUND_STORE, { _id: 'a1', value: 'hello' });
      const result = await service.get<Row>(PLAYGROUND_STORE, 'a1');
      expect(result).toEqual({ _id: 'a1', value: 'hello' });
    });

    it('overwrites an existing record sharing the same _id', async () => {
      await service.put<Row>(PLAYGROUND_STORE, { _id: 'a1', value: 'first' });
      await service.put<Row>(PLAYGROUND_STORE, { _id: 'a1', value: 'second' });
      const result = await service.get<Row>(PLAYGROUND_STORE, 'a1');
      expect(result?.value).toBe('second');
    });

    it('getAll() returns an empty array when the store is empty', async () => {
      expect(await service.getAll<Row>(PLAYGROUND_STORE)).toEqual([]);
    });

    it('getAll() returns every stored record', async () => {
      await service.put<Row>(PLAYGROUND_STORE, { _id: 'a1', value: 'one' });
      await service.put<Row>(PLAYGROUND_STORE, { _id: 'a2', value: 'two' });
      const result = await service.getAll<Row>(PLAYGROUND_STORE);
      expect(result.length).toBe(2);
      expect(result.map((r) => r._id).sort()).toEqual(['a1', 'a2']);
    });

    it('keeps the playground and flowchart stores independent even with a colliding id', async () => {
      await service.put<Row>(PLAYGROUND_STORE, { _id: 'shared-id', value: 'pg' });
      await service.put<Row>(FLOWCHART_STORE, { _id: 'shared-id', value: 'fc' });
      expect((await service.get<Row>(PLAYGROUND_STORE, 'shared-id'))?.value).toBe('pg');
      expect((await service.get<Row>(FLOWCHART_STORE, 'shared-id'))?.value).toBe('fc');
    });
  });

  describe('delete()', () => {
    it('removes a stored record', async () => {
      await service.put<Row>(PLAYGROUND_STORE, { _id: 'a1', value: 'x' });
      await service.delete(PLAYGROUND_STORE, 'a1');
      expect(await service.get<Row>(PLAYGROUND_STORE, 'a1')).toBeUndefined();
    });

    it('does not throw when deleting a key that was never stored', async () => {
      await expectAsync(service.delete(PLAYGROUND_STORE, 'never-existed')).toBeResolved();
    });
  });

  describe('count()', () => {
    it('is 0 for an empty store', async () => {
      expect(await service.count(PLAYGROUND_STORE)).toBe(0);
    });

    it('reflects the number of stored records', async () => {
      await service.put<Row>(PLAYGROUND_STORE, { _id: 'a1', value: 'x' });
      await service.put<Row>(PLAYGROUND_STORE, { _id: 'a2', value: 'y' });
      expect(await service.count(PLAYGROUND_STORE)).toBe(2);
    });
  });

  describe('clear()', () => {
    it('empties only the given store, not the other one', async () => {
      await service.put<Row>(PLAYGROUND_STORE, { _id: 'a1', value: 'x' });
      await service.put<Row>(FLOWCHART_STORE, { _id: 'b1', value: 'y' });

      await service.clear(PLAYGROUND_STORE);

      expect(await service.count(PLAYGROUND_STORE)).toBe(0);
      expect(await service.count(FLOWCHART_STORE)).toBe(1);
    });
  });

  describe('when IndexedDB is unsupported (private-browsing / blocked)', () => {
    it('resolves empty/undefined results instead of throwing, on a fresh instance', async () => {
      const freshService = new IndexedDbService();
      spyOn(freshService, 'isSupported').and.returnValue(false);

      expect(await freshService.getAll(PLAYGROUND_STORE)).toEqual([]);
      expect(await freshService.count(PLAYGROUND_STORE)).toBe(0);
      expect(await freshService.get(PLAYGROUND_STORE, 'x')).toBeUndefined();
      await expectAsync(freshService.put(PLAYGROUND_STORE, { _id: 'x' })).toBeResolved();
      await expectAsync(freshService.delete(PLAYGROUND_STORE, 'x')).toBeResolved();
      await expectAsync(freshService.clear(PLAYGROUND_STORE)).toBeResolved();
    });
  });
});
