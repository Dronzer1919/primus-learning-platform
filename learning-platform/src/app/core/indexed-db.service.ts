import { Injectable } from '@angular/core';
import { logWarn } from './logger';

const DB_NAME = 'primuscodex-local';
const DB_VERSION = 1;

export const PLAYGROUND_STORE = 'playground-sessions';
export const FLOWCHART_STORE = 'flowchart-sessions';

/**
 * Guest-mode local storage, keyed the same way as the backend session
 * collections (`_id`) so the local and backend services can be swapped in for
 * one another without the calling component knowing which one it has.
 *
 * Every method resolves rather than rejects on an unsupported/blocked
 * browser (same spirit as auth.service.ts's localStorage wrapper): a guest
 * whose browser blocks IndexedDB just sees an empty local library instead of
 * a crash.
 */
@Injectable({ providedIn: 'root' })
export class IndexedDbService {
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  isSupported(): boolean {
    return typeof indexedDB !== 'undefined';
  }

  private open(): Promise<IDBDatabase | null> {
    if (!this.isSupported()) return Promise.resolve(null);

    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(PLAYGROUND_STORE)) {
            db.createObjectStore(PLAYGROUND_STORE, { keyPath: '_id' });
          }
          if (!db.objectStoreNames.contains(FLOWCHART_STORE)) {
            db.createObjectStore(FLOWCHART_STORE, { keyPath: '_id' });
          }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          logWarn('Could not open local session storage — guest saves will not persist', request.error);
          resolve(null);
        };
        request.onblocked = () => {
          logWarn('Local session storage upgrade blocked by another open tab');
          resolve(null);
        };
      });
    }
    return this.dbPromise;
  }

  private async withStore<T>(
    store: string,
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T>
  ): Promise<T | undefined> {
    const db = await this.open();
    if (!db) return undefined;

    return new Promise((resolve) => {
      const tx = db.transaction(store, mode);
      const request = run(tx.objectStore(store));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        logWarn(`Local session storage request failed on "${store}"`, request.error);
        resolve(undefined);
      };
    });
  }

  async getAll<T>(store: string): Promise<T[]> {
    const result = await this.withStore<T[]>(store, 'readonly', (s) => s.getAll());
    return result ?? [];
  }

  async get<T>(store: string, id: string): Promise<T | undefined> {
    return this.withStore<T>(store, 'readonly', (s) => s.get(id));
  }

  async put<T>(store: string, value: T): Promise<void> {
    await this.withStore(store, 'readwrite', (s) => s.put(value));
  }

  async delete(store: string, id: string): Promise<void> {
    await this.withStore(store, 'readwrite', (s) => s.delete(id));
  }

  async clear(store: string): Promise<void> {
    await this.withStore(store, 'readwrite', (s) => s.clear());
  }

  async count(store: string): Promise<number> {
    const result = await this.withStore<number>(store, 'readonly', (s) => s.count());
    return result ?? 0;
  }
}
