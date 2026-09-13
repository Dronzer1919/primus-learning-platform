import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { IndexedDbService, PLAYGROUND_STORE } from '../core/indexed-db.service';
import { LocalPlaygroundSession } from '../models/local-session.model';

/**
 * Playground sessions for a signed-out visitor, kept on-device via IndexedDB.
 * Method names/shapes mirror PlaygroundSessionService so callers can swap
 * between the two without branching on every call.
 */
@Injectable({ providedIn: 'root' })
export class LocalPlaygroundSessionService {
  constructor(private db: IndexedDbService) {}

  getSessions(): Observable<LocalPlaygroundSession[]> {
    return from(
      this.db.getAll<LocalPlaygroundSession>(PLAYGROUND_STORE).then((sessions) =>
        sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      )
    );
  }

  getSession(id: string): Observable<LocalPlaygroundSession | undefined> {
    return from(this.db.get<LocalPlaygroundSession>(PLAYGROUND_STORE, id));
  }

  createSession(title?: string): Observable<LocalPlaygroundSession> {
    const now = new Date().toISOString();
    const session: LocalPlaygroundSession = {
      _id: crypto.randomUUID(),
      title: title?.trim() || 'New Playground',
      mode: 'web',
      htmlCode: '',
      cssCode: '',
      jsCode: '',
      jsOnlyCode: '',
      tsCode: '',
      selectedTab: 'html',
      createdAt: now,
      updatedAt: now
    };
    return from(this.db.put(PLAYGROUND_STORE, session).then(() => session));
  }

  updateSession(id: string, data: Partial<LocalPlaygroundSession>): Observable<LocalPlaygroundSession> {
    return from(
      this.db.get<LocalPlaygroundSession>(PLAYGROUND_STORE, id).then(async (existing) => {
        const updated: LocalPlaygroundSession = {
          ...(existing as LocalPlaygroundSession),
          ...data,
          _id: id,
          updatedAt: new Date().toISOString()
        };
        await this.db.put(PLAYGROUND_STORE, updated);
        return updated;
      })
    );
  }

  deleteSession(id: string): Observable<void> {
    return from(this.db.delete(PLAYGROUND_STORE, id));
  }

  count(): Observable<number> {
    return from(this.db.count(PLAYGROUND_STORE));
  }

  clearAll(): Observable<void> {
    return from(this.db.clear(PLAYGROUND_STORE));
  }
}
