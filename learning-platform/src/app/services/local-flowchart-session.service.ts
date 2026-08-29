import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { IndexedDbService, FLOWCHART_STORE } from '../core/indexed-db.service';
import { LocalFlowchartSession } from '../models/local-session.model';

export type LocalFlowchartSessionPayload = Partial<
  Pick<LocalFlowchartSession, 'title' | 'nodes' | 'edges' | 'canvasBg'>
>;

/**
 * Flowcharts for a signed-out visitor, kept on-device via IndexedDB. Method
 * names/shapes mirror FlowchartSessionService so callers can swap between the
 * two without branching on every call.
 */
@Injectable({ providedIn: 'root' })
export class LocalFlowchartSessionService {
  constructor(private db: IndexedDbService) {}

  getSessions(): Observable<LocalFlowchartSession[]> {
    return from(
      this.db.getAll<LocalFlowchartSession>(FLOWCHART_STORE).then((sessions) =>
        sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      )
    );
  }

  getSession(id: string): Observable<LocalFlowchartSession | undefined> {
    return from(this.db.get<LocalFlowchartSession>(FLOWCHART_STORE, id));
  }

  createSession(payload: LocalFlowchartSessionPayload): Observable<LocalFlowchartSession> {
    const now = new Date().toISOString();
    const session: LocalFlowchartSession = {
      _id: crypto.randomUUID(),
      title: payload.title?.trim() || 'New Flowchart',
      nodes: payload.nodes ?? [],
      edges: payload.edges ?? [],
      canvasBg: payload.canvasBg ?? 'dots',
      createdAt: now,
      updatedAt: now
    };
    return from(this.db.put(FLOWCHART_STORE, session).then(() => session));
  }

  updateSession(id: string, payload: LocalFlowchartSessionPayload): Observable<LocalFlowchartSession> {
    return from(
      this.db.get<LocalFlowchartSession>(FLOWCHART_STORE, id).then(async (existing) => {
        const updated: LocalFlowchartSession = {
          ...(existing as LocalFlowchartSession),
          ...payload,
          _id: id,
          updatedAt: new Date().toISOString()
        };
        await this.db.put(FLOWCHART_STORE, updated);
        return updated;
      })
    );
  }

  deleteSession(id: string): Observable<void> {
    return from(this.db.delete(FLOWCHART_STORE, id));
  }

  count(): Observable<number> {
    return from(this.db.count(FLOWCHART_STORE));
  }

  clearAll(): Observable<void> {
    return from(this.db.clear(FLOWCHART_STORE));
  }
}
