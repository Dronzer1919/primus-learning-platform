import { Injectable } from '@angular/core';
import { FlowDiagram } from '../models/flowchart.model';

const STORAGE_KEY = 'flowchart-diagram';

/**
 * Persists the flowchart diagram to the browser's localStorage so it survives
 * refreshes. Deliberately tiny — no backend involved.
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
}
