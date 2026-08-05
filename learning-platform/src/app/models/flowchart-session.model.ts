import { FlowEdge, FlowNode } from './flowchart.model';

/** A diagram saved to the user's account. Mirrors the FlowchartSession schema. */
export interface FlowchartSession {
  _id: string;
  userId: string;
  title: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  canvasBg: 'plain' | 'dots' | 'grid';
  createdAt: string;
  updatedAt: string;
}

/** What a create/update request may carry — the server's editable fields. */
export type FlowchartSessionPayload = Partial<
  Pick<FlowchartSession, 'title' | 'nodes' | 'edges' | 'canvasBg'>
>;
