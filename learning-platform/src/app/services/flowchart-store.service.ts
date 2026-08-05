import { Injectable } from '@angular/core';
import { FlowDiagram } from '../models/flowchart.model';

const STORAGE_KEY = 'flowchart-diagram';
const META_KEY = 'flowchart-session-meta';

/** Which saved session the canvas is currently editing, if any. */
export interface FlowchartSessionMeta {
  id: string;
  title: string;
}

/**
 * Persists the flowchart diagram to the browser's localStorage so it survives
 * refreshes. This stays the working scratch buffer even for signed-in users —
 * saved sessions live in the backend (FlowchartSessionService), and the meta
 * below is only the pointer telling a reloaded page which one is open.
 */
@Injectable({ providedIn: 'root' })
export class FlowchartStoreService {
  load(): FlowDiagram {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return { nodes: [], edges: [] };
      }
      const parsed = JSON.parse(raw) as Partial<FlowDiagram>;
      return {
        nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
        edges: Array.isArray(parsed.edges) ? parsed.edges : []
      };
    } catch {
      return { nodes: [], edges: [] };
    }
  }

  save(diagram: FlowDiagram): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(diagram));
    } catch {
      // Storage full or unavailable (e.g. private mode) — fail silently.
    }
  }

  loadMeta(): FlowchartSessionMeta | null {
    try {
      const raw = localStorage.getItem(META_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as Partial<FlowchartSessionMeta>;
      // Half-written meta (an id without a title, say) is worse than none: it
      // would have the toolbar offering to update a session it cannot name.
      return typeof parsed.id === 'string' && typeof parsed.title === 'string'
        ? { id: parsed.id, title: parsed.title }
        : null;
    } catch {
      return null;
    }
  }

  /** Pass null to forget the open session (e.g. after "New flowchart"). */
  saveMeta(meta: FlowchartSessionMeta | null): void {
    try {
      if (meta) {
        localStorage.setItem(META_KEY, JSON.stringify(meta));
      } else {
        localStorage.removeItem(META_KEY);
      }
    } catch {
      // Same as above — persistence here is a convenience, never a requirement.
    }
  }
}
