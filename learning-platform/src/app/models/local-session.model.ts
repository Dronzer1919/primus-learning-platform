import { PlaygroundModeId } from './playground.model';
import { FlowEdge, FlowNode } from './flowchart.model';

/** A playground session saved on-device for a signed-out visitor. */
export interface LocalPlaygroundSession {
  _id: string;
  title: string;
  mode: PlaygroundModeId;
  htmlCode: string;
  cssCode: string;
  jsCode: string;
  jsOnlyCode: string;
  tsCode: string;
  selectedTab: 'html' | 'css' | 'js';
  createdAt: string;
  updatedAt: string;
}

/** A flowchart saved on-device for a signed-out visitor. */
export interface LocalFlowchartSession {
  _id: string;
  title: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  canvasBg: 'plain' | 'dots' | 'grid';
  createdAt: string;
  updatedAt: string;
}
