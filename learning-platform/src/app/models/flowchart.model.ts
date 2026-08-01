export type ShapeType =
  | 'rectangle'
  | 'rounded'
  | 'square'
  | 'ellipse'
  | 'circle'
  | 'process'
  | 'diamond'
  | 'parallelogram'
  | 'triangle'
  | 'hexagon'
  | 'trapezoid'
  | 'step'
  | 'cylinder'
  | 'document'
  | 'internal-storage'
  | 'cube'
  | 'tape'
  | 'note'
  | 'card'
  | 'callout'
  | 'cloud'
  | 'actor'
  | 'or'
  | 'and'
  | 'data-storage'
  | 'list'
  | 'text'
  | 'arrow'
  | 'arrow-double'
  | 'arrow-curved'
  | 'line'
  | 'line-dashed'
  | 'line-dotted'
  | 'line-arrow'
  | 'line-double-arrow';

export interface FlowNode {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  /** Custom fill colour; falls back to the theme default when unset. */
  fill?: string;
  /** Custom border/line colour; falls back to the theme default when unset. */
  stroke?: string;

  // --- Label text styling (all optional; unset means the theme default) ---
  /** Font family for the label. */
  fontFamily?: string;
  /** Font size in px. */
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  /** Horizontal alignment of the label text. */
  align?: 'left' | 'center' | 'right';
  /** Text colour. */
  textColor?: string;
  /** Line height as a percentage, e.g. 120 for 120%. */
  lineHeight?: number;
}

/** Font families offered in the Text panel. */
export const FONT_FAMILIES: string[] = [
  'Helvetica',
  'Arial',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Verdana',
  'Trebuchet MS',
  'Comic Sans MS'
];

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  /** Overrides the natural mid-point of the elbow connector (canvas px). */
  bend?: number;
  /** How the connector is routed. Defaults to 'elbow'. */
  routing?: 'elbow' | 'straight';
  /** Line dash pattern. Defaults to 'solid'. */
  dash?: 'solid' | 'dashed' | 'dotted';
  /** Arrowhead at the end of the line. Defaults to 'filled'. */
  endArrow?: 'filled' | 'open' | 'none';
  /** Arrowhead at the start of the line. Defaults to 'none'. */
  startArrow?: 'none' | 'filled' | 'open';
  /** Custom stroke colour. Falls back to theme colour when absent. */
  color?: string;
}

export interface FlowDiagram {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface PaletteShape {
  type: ShapeType;
  label: string;
  w: number;
  h: number;
  /** What the symbol conventionally stands for — shown as the palette tooltip. */
  meaning: string;
}

/** Palette shapes are grouped into collapsible-looking sections in the sidebar. */
export interface PaletteGroup {
  title: string;
  shapes: PaletteShape[];
}

/** How a node is drawn inside its SVG box. */
export interface RenderShape {
  kind: 'rect' | 'ellipse' | 'polygon' | 'path' | 'process' | 'line' | 'none';
  rx?: number;
  points?: string;
  d?: string;
  noFill?: boolean;
  /** SVG stroke-dasharray, used by the line shapes. */
  dash?: string;
  arrowStart?: boolean;
  arrowEnd?: boolean;
}

export const DEFAULT_NODE_WIDTH = 120;
export const DEFAULT_NODE_HEIGHT = 60;

// Every shape shown in the palette, with a sensible default footprint. Ordered
// to mirror the General / Arrows sections of a standard diagram editor.
export const SHAPE_GROUPS: PaletteGroup[] = [
  {
    title: 'General',
    shapes: [
      {
        type: 'rectangle',
        label: 'Rectangle',
        w: 120,
        h: 60,
        meaning: 'A step or action — the default box for "do this".'
      },
      {
        type: 'rounded',
        label: 'Rounded',
        w: 120,
        h: 60,
        meaning: 'Start or End of the flow (terminator).'
      },
      { type: 'text', label: 'Text', w: 100, h: 40, meaning: 'A plain label or annotation, no box.' },
      {
        type: 'ellipse',
        label: 'Ellipse',
        w: 120,
        h: 70,
        meaning: 'Start or End point of the flow.'
      },
      { type: 'square', label: 'Square', w: 80, h: 80, meaning: 'A step or action, equal-sided.' },
      {
        type: 'circle',
        label: 'Circle',
        w: 80,
        h: 80,
        meaning: 'Connector — jump to the matching circle elsewhere in the diagram.'
      },
      {
        type: 'process',
        label: 'Process',
        w: 120,
        h: 60,
        meaning: 'Predefined process — a subroutine defined in its own diagram.'
      },
      {
        type: 'diamond',
        label: 'Decision',
        w: 120,
        h: 80,
        meaning: 'A yes/no branch — one way in, several ways out.'
      },
      {
        type: 'parallelogram',
        label: 'Data',
        w: 120,
        h: 60,
        meaning: 'Input or Output — data entering or leaving the flow.'
      },
      {
        type: 'hexagon',
        label: 'Preparation',
        w: 120,
        h: 70,
        meaning: 'Setup before a step — initialise a value or start a loop.'
      },
      {
        type: 'triangle',
        label: 'Triangle',
        w: 100,
        h: 80,
        meaning: 'Extract or merge — splitting one flow or joining several.'
      },
      {
        type: 'cylinder',
        label: 'Database',
        w: 100,
        h: 80,
        meaning: 'Stored data — a database or table.'
      },
      {
        type: 'cloud',
        label: 'Cloud',
        w: 120,
        h: 80,
        meaning: 'A network, the internet, or an external service.'
      },
      {
        type: 'document',
        label: 'Document',
        w: 120,
        h: 70,
        meaning: 'A document, report, or printed output.'
      },
      {
        type: 'internal-storage',
        label: 'Internal Storage',
        w: 120,
        h: 70,
        meaning: 'Data held in working memory rather than on disk.'
      },
      {
        type: 'cube',
        label: 'Cube',
        w: 100,
        h: 80,
        meaning: 'A system, server, or deployable component.'
      },
      {
        type: 'step',
        label: 'Step',
        w: 120,
        h: 60,
        meaning: 'One stage in a sequence — chevrons chain left to right.'
      },
      {
        type: 'trapezoid',
        label: 'Manual Op',
        w: 120,
        h: 60,
        meaning: 'A manual operation — a person does this, not the system.'
      },
      {
        type: 'tape',
        label: 'Tape',
        w: 120,
        h: 70,
        meaning: 'Sequential data — a tape, log, or stream.'
      },
      {
        type: 'note',
        label: 'Note',
        w: 110,
        h: 80,
        meaning: 'A comment attached to the diagram, outside the flow.'
      },
      {
        type: 'card',
        label: 'Card',
        w: 120,
        h: 70,
        meaning: 'A punched card — legacy input record.'
      },
      {
        type: 'callout',
        label: 'Callout',
        w: 120,
        h: 80,
        meaning: 'A speech bubble pointing at whatever it explains.'
      },
      {
        type: 'actor',
        label: 'Actor',
        w: 60,
        h: 90,
        meaning: 'A person or external role using the system.'
      },
      {
        type: 'or',
        label: 'Or',
        w: 90,
        h: 70,
        meaning: 'Logical OR — any one incoming path is enough to continue.'
      },
      {
        type: 'and',
        label: 'And',
        w: 90,
        h: 70,
        meaning: 'Logical AND — every incoming path must arrive to continue.'
      },
      {
        type: 'data-storage',
        label: 'Data Storage',
        w: 120,
        h: 70,
        meaning: 'Generic stored data, not tied to a specific medium.'
      },
      {
        type: 'list',
        label: 'List',
        w: 140,
        h: 100,
        meaning: 'A titled container grouping related items.'
      }
    ]
  },
  {
    title: 'Arrows & Lines',
    shapes: [
      {
        type: 'arrow',
        label: 'Arrow',
        w: 120,
        h: 60,
        meaning: 'Direction of flow, as a solid block you can label.'
      },
      {
        type: 'arrow-double',
        label: 'Bidirectional',
        w: 120,
        h: 60,
        meaning: 'A two-way relationship between both sides.'
      },
      {
        type: 'arrow-curved',
        label: 'Curved Arrow',
        w: 100,
        h: 70,
        meaning: 'Flow that loops back or bends around other shapes.'
      },
      {
        type: 'line',
        label: 'Line',
        w: 120,
        h: 20,
        meaning: 'A plain association between two things — no direction.'
      },
      {
        type: 'line-dashed',
        label: 'Dashed',
        w: 120,
        h: 20,
        meaning: 'A weaker or optional link.'
      },
      {
        type: 'line-dotted',
        label: 'Dotted',
        w: 120,
        h: 20,
        meaning: 'An indirect or implied link, e.g. a reference.'
      },
      {
        type: 'line-arrow',
        label: 'Directional',
        w: 120,
        h: 20,
        meaning: 'Flow or dependency pointing one way.'
      },
      {
        type: 'line-double-arrow',
        label: 'Bidirectional Line',
        w: 120,
        h: 20,
        meaning: 'Flow or exchange running both ways.'
      }
    ]
  }
];

/** Flat view of every palette shape, for default-size lookups. */
export const SHAPE_PALETTE: PaletteShape[] = SHAPE_GROUPS.reduce(
  (all: PaletteShape[], group) => all.concat(group.shapes),
  []
);
