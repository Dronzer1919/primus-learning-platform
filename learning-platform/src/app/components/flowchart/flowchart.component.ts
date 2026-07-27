import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { ThemeSelectorComponent } from '../theme-selector/theme-selector.component';
import { FlowchartStoreService } from '../../services/flowchart-store.service';
import { ExportFormat, FlowchartExportService } from '../../services/flowchart-export.service';
import {
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
  FONT_FAMILIES,
  FlowDiagram,
  FlowEdge,
  FlowNode,
  PaletteShape,
  RenderShape,
  SHAPE_GROUPS,
  SHAPE_PALETTE,
  ShapeType
} from '../../models/flowchart.model';

interface EdgeGeometry {
  edge: FlowEdge;
  points: string;
}

interface NodeView {
  node: FlowNode;
  shape: RenderShape;
}

interface PaletteView {
  shape: PaletteShape;
  render: RenderShape;
}

interface PaletteGroupView {
  title: string;
  items: PaletteView[];
}

/** Which corner/edge of a shape a resize handle drags. */
type ResizeDir = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

@Component({
  selector: 'app-flowchart',
  templateUrl: './flowchart.component.html',
  styleUrls: ['./flowchart.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule, ThemeSelectorComponent]
})
export class FlowchartComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLElement>;

  palette = SHAPE_PALETTE;
  paletteGroups: PaletteGroupView[] = [];
  // Fixed footprint used for the mini palette previews.
  readonly previewW = 46;
  readonly previewH = 28;

  diagram: FlowDiagram = { nodes: [], edges: [] };

  // Quick-pick colours for the selected shape. The first entry (null) means
  // "use the theme default" and clears any custom colour.
  readonly fillSwatches: (string | null)[] = [
    null, '#ffffff', '#fde68a', '#bbf7d0', '#bfdbfe', '#ddd6fe', '#fbcfe8', '#fecaca', '#fed7aa', '#e5e7eb'
  ];
  readonly strokeSwatches: (string | null)[] = [
    null, '#111827', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#9ca3af'
  ];

  // Text-panel options and defaults. Defaults mirror the label CSS so the
  // number inputs show the effective value before the user overrides it.
  readonly fontFamilies = FONT_FAMILIES;
  readonly defaultFontSize = 13;
  readonly defaultLineHeight = 125;

  selectedNodeId: string | null = null;
  selectedEdgeId: string | null = null;
  editingNodeId: string | null = null;

  // Side panels start open. The toolbar toggles are always visible, so they are
  // also the way back once a panel has been collapsed.
  showPalette = true;
  showProps = true;

  togglePalette(): void {
    this.showPalette = !this.showPalette;
  }

  toggleProps(): void {
    this.showProps = !this.showProps;
  }

  // Drag-to-connect state. `connectFromId` is the source node while dragging a new
  // arrow; `connectX/Y` track the loose end (canvas coords); `connectTargetId` is
  // the node currently under the pointer (highlighted green as a drop target).
  connectFromId: string | null = null;
  connectTargetId: string | null = null;
  connectX = 0;
  connectY = 0;

  // Node move bookkeeping.
  private movingNodeId: string | null = null;
  private moveOffsetX = 0;
  private moveOffsetY = 0;
  private moved = false;
  private readonly onMoveRef = (e: MouseEvent) => this.onMove(e);
  private readonly onMoveEndRef = () => this.onMoveEnd();
  private readonly onConnectMoveRef = (e: MouseEvent) => this.onConnectMove(e);
  private readonly onConnectEndRef = () => this.onConnectEnd();

  // --- Resize bookkeeping ------------------------------------------------
  /** The eight handles drawn around a selected shape, in clockwise order. */
  readonly resizeHandles: ResizeDir[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  /** Nothing useful can be drawn or clicked below this, in px. */
  readonly minNodeSize = 20;
  private resizingNodeId: string | null = null;
  private resizeDir: ResizeDir = 'se';
  private resizeStart = { x: 0, y: 0, nodeX: 0, nodeY: 0, w: 0, h: 0 };
  private resized = false;
  private readonly onResizeMoveRef = (e: PointerEvent) => this.onResizeMove(e);
  private readonly onResizeEndRef = () => this.onResizeEnd();

  constructor(
    private store: FlowchartStoreService,
    private exporter: FlowchartExportService,
    private location: Location,
    private router: Router
  ) {}

  // Return to the page the user came from (e.g. /user/home), not a hardcoded route.
  // Falls back to the home page if the flowchart was opened directly (no history).
  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/']);
    }
  }

  ngOnInit(): void {
    this.diagram = this.store.load();
    this.paletteGroups = SHAPE_GROUPS.map((group) => ({
      title: group.title,
      items: group.shapes.map((shape) => ({
        shape,
        render: this.shapeFor(shape.type, this.previewW, this.previewH)
      }))
    }));
  }

  ngOnDestroy(): void {
    document.removeEventListener('mousemove', this.onMoveRef);
    document.removeEventListener('mouseup', this.onMoveEndRef);
    document.removeEventListener('mousemove', this.onConnectMoveRef);
    document.removeEventListener('mouseup', this.onConnectEndRef);
    this.detachResizeListeners();
  }

  /** Pointer position relative to the (possibly scrolled) canvas. */
  private canvasPoint(event: MouseEvent): { x: number; y: number } {
    const el = this.canvasRef.nativeElement;
    const rect = el.getBoundingClientRect();
    return {
      x: event.clientX - rect.left + el.scrollLeft,
      y: event.clientY - rect.top + el.scrollTop
    };
  }

  // --- Adding shapes via drag & drop from the palette --------------------

  onPaletteDragStart(event: DragEvent, type: ShapeType): void {
    event.dataTransfer?.setData('text/flow-shape', type);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
    }
  }

  onCanvasDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  onCanvasDrop(event: DragEvent): void {
    const type = event.dataTransfer?.getData('text/flow-shape') as ShapeType;
    if (!type) {
      return;
    }
    event.preventDefault();
    const point = this.canvasPoint(event);
    this.addShape(type, point.x, point.y);
  }

  // Tap-to-add fallback. HTML5 drag & drop does not fire on touch screens at all, so
  // on a phone the palette would be inert without this — the shape lands in the middle
  // of whatever part of the canvas is currently scrolled into view.
  onPaletteTap(type: ShapeType): void {
    const el = this.canvasRef.nativeElement;
    this.addShape(type, el.scrollLeft + el.clientWidth / 2, el.scrollTop + el.clientHeight / 2);
  }

  // Adds a shape of `type` centred on a point in canvas coordinates.
  private addShape(type: ShapeType, centerX: number, centerY: number): void {
    const preset = this.palette.find((p) => p.type === type);
    const w = preset?.w ?? DEFAULT_NODE_WIDTH;
    const h = preset?.h ?? DEFAULT_NODE_HEIGHT;
    const node: FlowNode = {
      id: this.newId(),
      type,
      x: Math.max(0, centerX - w / 2),
      y: Math.max(0, centerY - h / 2),
      w,
      h,
      text: ''
    };
    this.diagram.nodes.push(node);
    this.select(node.id, null);
    this.persist();
  }

  // --- Moving a node -----------------------------------------------------

  onNodeMouseDown(event: MouseEvent, node: FlowNode): void {
    // Left button only; ignore while editing the label.
    if (event.button !== 0 || this.editingNodeId === node.id) {
      return;
    }
    event.stopPropagation();
    this.movingNodeId = node.id;
    this.moved = false;
    const point = this.canvasPoint(event);
    this.moveOffsetX = point.x - node.x;
    this.moveOffsetY = point.y - node.y;
    document.addEventListener('mousemove', this.onMoveRef);
    document.addEventListener('mouseup', this.onMoveEndRef);
  }

  private onMove(event: MouseEvent): void {
    const node = this.diagram.nodes.find((n) => n.id === this.movingNodeId);
    if (!node) {
      return;
    }
    this.moved = true;
    const point = this.canvasPoint(event);
    node.x = Math.max(0, point.x - this.moveOffsetX);
    node.y = Math.max(0, point.y - this.moveOffsetY);
  }

  private onMoveEnd(): void {
    document.removeEventListener('mousemove', this.onMoveRef);
    document.removeEventListener('mouseup', this.onMoveEndRef);
    if (this.moved) {
      this.persist();
    }
    this.movingNodeId = null;
  }

  // --- Resizing a node ---------------------------------------------------

  /**
   * Starts a resize drag from one of the eight handles on the selected shape.
   * Pointer events (rather than the mouse events used elsewhere) so a finger
   * drag resizes too — `touch-action: none` on the handle stops the canvas from
   * scrolling underneath it.
   */
  startResize(event: PointerEvent, node: FlowNode, dir: ResizeDir): void {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    event.stopPropagation();
    event.preventDefault();
    this.select(node.id, null);
    this.resizingNodeId = node.id;
    this.resizeDir = dir;
    this.resized = false;
    const point = this.canvasPoint(event);
    this.resizeStart = { x: point.x, y: point.y, nodeX: node.x, nodeY: node.y, w: node.w, h: node.h };
    document.addEventListener('pointermove', this.onResizeMoveRef);
    document.addEventListener('pointerup', this.onResizeEndRef);
    document.addEventListener('pointercancel', this.onResizeEndRef);
  }

  private onResizeMove(event: PointerEvent): void {
    const node = this.diagram.nodes.find((n) => n.id === this.resizingNodeId);
    if (!node) {
      return;
    }
    this.resized = true;
    const start = this.resizeStart;
    const point = this.canvasPoint(event);
    const dir = this.resizeDir;
    const min = this.minNodeSize;
    let { w, h } = start;
    let x = start.nodeX;
    let y = start.nodeY;

    if (dir.includes('e')) {
      w = Math.max(min, start.w + (point.x - start.x));
    } else if (dir.includes('w')) {
      // Dragging the left edge moves the origin as well, so the right edge stays put.
      w = Math.max(min, start.w - (point.x - start.x));
      x = start.nodeX + start.w - w;
    }
    if (dir.includes('s')) {
      h = Math.max(min, start.h + (point.y - start.y));
    } else if (dir.includes('n')) {
      h = Math.max(min, start.h - (point.y - start.y));
      y = start.nodeY + start.h - h;
    }

    // Shift on a corner keeps the original proportions, as in most editors.
    if (event.shiftKey && dir.length === 2 && start.w > 0 && start.h > 0) {
      const ratio = start.w / start.h;
      if (w / h > ratio) {
        w = Math.max(min, h * ratio);
      } else {
        h = Math.max(min, w / ratio);
      }
      if (dir.includes('w')) {
        x = start.nodeX + start.w - w;
      }
      if (dir.includes('n')) {
        y = start.nodeY + start.h - h;
      }
    }

    // Never let a shape be dragged off the top/left of the canvas.
    if (x < 0) {
      w = Math.max(min, w + x);
      x = 0;
    }
    if (y < 0) {
      h = Math.max(min, h + y);
      y = 0;
    }

    node.x = x;
    node.y = y;
    node.w = Math.round(w);
    node.h = Math.round(h);
  }

  private onResizeEnd(): void {
    this.detachResizeListeners();
    if (this.resized) {
      this.persist();
    }
    this.resizingNodeId = null;
  }

  private detachResizeListeners(): void {
    document.removeEventListener('pointermove', this.onResizeMoveRef);
    document.removeEventListener('pointerup', this.onResizeEndRef);
    document.removeEventListener('pointercancel', this.onResizeEndRef);
  }

  /** Width/height fields in the properties panel — the keyboard route to resizing. */
  setNodeSize(dimension: 'w' | 'h', value: number): void {
    const node = this.selectedNode;
    if (!node || !Number.isFinite(value)) {
      return;
    }
    node[dimension] = Math.min(2000, Math.max(this.minNodeSize, Math.round(value)));
    this.persist();
  }

  /** Restores the shape's palette default footprint. */
  resetNodeSize(): void {
    const node = this.selectedNode;
    if (!node) {
      return;
    }
    const preset = this.palette.find((p) => p.type === node.type);
    node.w = preset?.w ?? DEFAULT_NODE_WIDTH;
    node.h = preset?.h ?? DEFAULT_NODE_HEIGHT;
    this.persist();
  }

  // --- Selection ---------------------------------------------------------

  onNodeClick(event: MouseEvent, node: FlowNode): void {
    event.stopPropagation();
    if (this.moved) {
      // This click concludes a drag — don't treat it as a select toggle.
      return;
    }
    this.select(node.id, null);
  }

  onEdgeClick(event: MouseEvent, edge: FlowEdge): void {
    event.stopPropagation();
    this.select(null, edge.id);
  }

  onCanvasClick(): void {
    this.select(null, null);
  }

  private select(nodeId: string | null, edgeId: string | null): void {
    this.selectedNodeId = nodeId;
    this.selectedEdgeId = edgeId;
  }

  // --- Shape colours -----------------------------------------------------

  /** The currently selected node, or null. Drives the colour toolbar. */
  get selectedNode(): FlowNode | null {
    return this.selectedNodeId
      ? this.diagram.nodes.find((n) => n.id === this.selectedNodeId) ?? null
      : null;
  }

  /** `null` clears the custom fill so the shape reverts to the theme default. */
  setFill(color: string | null): void {
    const node = this.selectedNode;
    if (!node) {
      return;
    }
    if (color === null) {
      delete node.fill;
    } else {
      node.fill = color;
    }
    this.persist();
  }

  setStroke(color: string | null): void {
    const node = this.selectedNode;
    if (!node) {
      return;
    }
    if (color === null) {
      delete node.stroke;
    } else {
      node.stroke = color;
    }
    this.persist();
  }

  // --- Label text styling ------------------------------------------------

  /**
   * Inline styles for a node's label/editor, derived from its text properties.
   * Shared by the rendered label and the editing <textarea> so what you type
   * looks exactly like what you get.
   */
  labelStyle(node: FlowNode): { [prop: string]: string } {
    const style: { [prop: string]: string } = {};
    if (node.fontFamily) {
      style['font-family'] = node.fontFamily;
    }
    style['font-size'] = `${node.fontSize ?? this.defaultFontSize}px`;
    if (node.bold) {
      style['font-weight'] = '700';
    }
    if (node.italic) {
      style['font-style'] = 'italic';
    }
    const decorations = [
      node.underline ? 'underline' : '',
      node.strikethrough ? 'line-through' : ''
    ].filter(Boolean);
    if (decorations.length) {
      style['text-decoration'] = decorations.join(' ');
    }
    style['text-align'] = node.align ?? 'center';
    if (node.textColor) {
      style['color'] = node.textColor;
    }
    style['line-height'] = `${(node.lineHeight ?? this.defaultLineHeight) / 100}`;
    return style;
  }

  setFontFamily(family: string): void {
    const node = this.selectedNode;
    if (!node) {
      return;
    }
    node.fontFamily = family;
    this.persist();
  }

  setFontSize(size: number): void {
    const node = this.selectedNode;
    if (!node || !Number.isFinite(size)) {
      return;
    }
    node.fontSize = Math.min(200, Math.max(6, Math.round(size)));
    this.persist();
  }

  /** Toggle a boolean text style (bold/italic/underline/strikethrough). */
  toggleText(prop: 'bold' | 'italic' | 'underline' | 'strikethrough'): void {
    const node = this.selectedNode;
    if (!node) {
      return;
    }
    node[prop] = !node[prop];
    this.persist();
  }

  /** Alignment options, in visual/tab order. Drives the align radiogroup. */
  readonly alignments: Array<'left' | 'center' | 'right'> = ['left', 'center', 'right'];

  setAlign(align: 'left' | 'center' | 'right'): void {
    const node = this.selectedNode;
    if (!node) {
      return;
    }
    node.align = align;
    this.persist();
  }

  /**
   * Arrow-key navigation for the alignment radiogroup (WAI-ARIA radio pattern):
   * Left/Up select the previous option, Right/Down the next, wrapping around,
   * and focus follows the selection so roving tabindex stays consistent.
   */
  onAlignKeydown(event: KeyboardEvent): void {
    const order = this.alignments;
    const current = this.selectedNode?.align ?? 'center';
    let idx = order.indexOf(current);
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      idx = (idx + 1) % order.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      idx = (idx - 1 + order.length) % order.length;
    } else {
      return;
    }
    event.preventDefault();
    this.setAlign(order[idx]);
    const radios = (event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role="radio"]');
    radios[idx]?.focus();
  }

  setTextColor(color: string): void {
    const node = this.selectedNode;
    if (!node) {
      return;
    }
    node.textColor = color;
    this.persist();
  }

  setLineHeight(percent: number): void {
    const node = this.selectedNode;
    if (!node || !Number.isFinite(percent)) {
      return;
    }
    node.lineHeight = Math.min(300, Math.max(50, Math.round(percent)));
    this.persist();
  }

  // --- Drag-to-connect ---------------------------------------------------

  /** Begins dragging a new arrow out of `node` from one of its side handles. */
  startConnect(event: MouseEvent, node: FlowNode): void {
    event.stopPropagation();
    event.preventDefault();
    this.connectFromId = node.id;
    this.connectTargetId = null;
    const point = this.canvasPoint(event);
    this.connectX = point.x;
    this.connectY = point.y;
    document.addEventListener('mousemove', this.onConnectMoveRef);
    document.addEventListener('mouseup', this.onConnectEndRef);
  }

  private onConnectMove(event: MouseEvent): void {
    if (!this.connectFromId) {
      return;
    }
    const point = this.canvasPoint(event);
    this.connectX = point.x;
    this.connectY = point.y;
    const hit = this.nodeAt(point.x, point.y);
    this.connectTargetId = hit && hit.id !== this.connectFromId ? hit.id : null;
  }

  private onConnectEnd(): void {
    document.removeEventListener('mousemove', this.onConnectMoveRef);
    document.removeEventListener('mouseup', this.onConnectEndRef);
    const from = this.connectFromId;
    const to = this.connectTargetId;
    this.connectFromId = null;
    this.connectTargetId = null;
    if (!from || !to || from === to) {
      return;
    }
    const exists = this.diagram.edges.some((e) => e.from === from && e.to === to);
    if (exists) {
      return;
    }
    this.diagram.edges.push({ id: this.newId(), from, to });
    this.persist();
  }

  /** Topmost node whose box contains the given canvas point, if any. */
  private nodeAt(x: number, y: number): FlowNode | null {
    for (let i = this.diagram.nodes.length - 1; i >= 0; i--) {
      const n = this.diagram.nodes[i];
      if (x >= n.x && x <= n.x + n.w && y >= n.y && y <= n.y + n.h) {
        return n;
      }
    }
    return null;
  }

  // --- Editing labels ----------------------------------------------------

  startEditing(event: MouseEvent, node: FlowNode): void {
    event.stopPropagation();
    event.preventDefault();
    this.select(node.id, null);
    this.beginEdit(node.id);
  }

  /**
   * Shows a real <textarea> over the node and focuses it. A native form control
   * is used instead of a contenteditable div because contenteditable silently
   * refuses input when an ancestor sets `user-select: none` (as the draggable
   * node does), which varies by browser and is hard to get right. The <textarea>
   * only exists in the DOM once `editingNodeId` is set, so focusing waits a tick
   * for change detection to render it.
   */
  private beginEdit(nodeId: string): void {
    this.editingNodeId = nodeId;
    setTimeout(() => {
      const input = this.canvasRef.nativeElement.querySelector(
        `[data-node-id="${nodeId}"] .node-input`
      ) as HTMLTextAreaElement | null;
      if (input) {
        input.focus();
        input.select();
      }
    });
  }

  /** Commit the typed text back to the node (called on blur / Enter). */
  commitEdit(event: Event, node: FlowNode): void {
    if (this.editingNodeId !== node.id) {
      return;
    }
    this.editingNodeId = null;
    const typed = (event.target as HTMLTextAreaElement).value.trim();
    if (typed !== node.text) {
      node.text = typed;
      this.persist();
    }
  }

  onInputKeydown(event: KeyboardEvent, node: FlowNode): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      // Enter commits; Shift+Enter inserts a newline. stopPropagation keeps the
      // window keydown handler from treating this Enter as "rename again".
      event.preventDefault();
      event.stopPropagation();
      (event.target as HTMLTextAreaElement).blur();
    } else if (event.key === 'Escape') {
      // Discard edits: clear the flag first so the blur handler skips the commit.
      event.preventDefault();
      event.stopPropagation();
      this.editingNodeId = null;
      (event.target as HTMLTextAreaElement).blur();
    }
  }

  // --- Copy / paste ------------------------------------------------------

  // A private clipboard rather than the system one: the copied value is a node
  // object, and reading the real clipboard needs a permission prompt.
  private clipboard: FlowNode | null = null;
  // Grows with each paste so repeated pastes cascade instead of stacking.
  private pasteOffset = 0;

  get canPaste(): boolean {
    return this.clipboard !== null;
  }

  copySelected(): void {
    const node = this.selectedNode;
    if (!node) {
      return;
    }
    this.clipboard = { ...node };
    this.pasteOffset = 0;
  }

  cutSelected(): void {
    if (!this.selectedNode) {
      return;
    }
    this.copySelected();
    this.deleteSelected();
  }

  /** Drops a copy of the clipboard shape, offset from the last one. */
  pasteClipboard(): void {
    if (!this.clipboard) {
      return;
    }
    this.pasteOffset += 20;
    const copy: FlowNode = {
      ...this.clipboard,
      id: this.newId(),
      x: Math.max(0, this.clipboard.x + this.pasteOffset),
      y: Math.max(0, this.clipboard.y + this.pasteOffset)
    };
    this.diagram.nodes.push(copy);
    this.select(copy.id, null);
    this.persist();
  }

  // --- Deletion ----------------------------------------------------------

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (this.editingNodeId) {
      return;
    }
    if (event.key === 'Escape' && this.exportOpen) {
      this.exportOpen = false;
      return;
    }
    // Ctrl on Windows/Linux, Cmd on a Mac. The editing guard above means these
    // never shadow the browser's own copy/paste inside a label.
    if (event.ctrlKey || event.metaKey) {
      const key = event.key.toLowerCase();
      if (key === 'c' && this.selectedNodeId) {
        event.preventDefault();
        this.copySelected();
      } else if (key === 'x' && this.selectedNodeId) {
        event.preventDefault();
        this.cutSelected();
      } else if (key === 'v' && this.clipboard) {
        event.preventDefault();
        this.pasteClipboard();
      }
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (this.selectedNodeId || this.selectedEdgeId) {
        event.preventDefault();
        this.deleteSelected();
      }
    } else if ((event.key === 'F2' || event.key === 'Enter') && this.selectedNodeId) {
      // Same shortcut as most diagram editors: rename the selected shape.
      event.preventDefault();
      this.beginEdit(this.selectedNodeId);
    }
  }

  deleteSelected(): void {
    if (this.selectedNodeId) {
      const id = this.selectedNodeId;
      this.diagram.nodes = this.diagram.nodes.filter((n) => n.id !== id);
      this.diagram.edges = this.diagram.edges.filter((e) => e.from !== id && e.to !== id);
    } else if (this.selectedEdgeId) {
      const id = this.selectedEdgeId;
      this.diagram.edges = this.diagram.edges.filter((e) => e.id !== id);
    } else {
      return;
    }
    this.select(null, null);
    this.persist();
  }

  // --- Exporting ---------------------------------------------------------

  exportOpen = false;
  exporting = false;
  exportError: string | null = null;

  toggleExport(event: MouseEvent): void {
    // Without this the document listener below would close the menu again.
    event.stopPropagation();
    this.exportError = null;
    this.exportOpen = !this.exportOpen;
  }

  @HostListener('document:click')
  closeExport(): void {
    this.exportOpen = false;
  }

  async saveAs(format: ExportFormat): Promise<void> {
    this.exportOpen = false;
    if (this.exporting || this.diagram.nodes.length === 0) {
      return;
    }
    this.exporting = true;
    this.exportError = null;
    try {
      await this.exporter.export(
        {
          nodes: this.diagram.nodes,
          edges: this.edgeGeometries.map((g) => g.points),
          shapeFor: (type, w, h) => this.shapeFor(type, w, h),
          colors: this.exportColors(),
          fontSize: this.defaultFontSize,
          lineHeight: this.defaultLineHeight
        },
        format
      );
    } catch {
      this.exportError = 'Could not create the file — please try again.';
    } finally {
      this.exporting = false;
    }
  }

  /**
   * The theme's diagram colours as concrete `rgb()` strings. Reading the custom
   * properties directly can hand back `color-mix(…)` or another `var(…)`, which
   * an exported SVG may not resolve — so each one is measured off a probe
   * element, whose computed background is always a plain colour.
   */
  private exportColors(): { background: string; fill: string; stroke: string; text: string } {
    const probe = document.createElement('div');
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.pointerEvents = 'none';
    this.canvasRef.nativeElement.appendChild(probe);
    const read = (variable: string, fallback: string): string => {
      probe.style.backgroundColor = '';
      probe.style.backgroundColor = `var(${variable})`;
      const value = getComputedStyle(probe).backgroundColor;
      return !value || value === 'rgba(0, 0, 0, 0)' ? fallback : value;
    };
    const colors = {
      background: read('--playground-page-bg', '#ffffff'),
      fill: read('--editor-header-bg', '#ffffff'),
      stroke: read('--editor-fg', '#111827'),
      text: read('--editor-fg', '#111827')
    };
    probe.remove();
    return colors;
  }

  clear(): void {
    if (this.diagram.nodes.length === 0 && this.diagram.edges.length === 0) {
      return;
    }
    if (!confirm('Clear the entire flowchart?')) {
      return;
    }
    this.diagram = { nodes: [], edges: [] };
    this.connectFromId = null;
    this.select(null, null);
    this.persist();
  }

  // --- Rendering ---------------------------------------------------------

  get nodeViews(): NodeView[] {
    return this.diagram.nodes.map((node) => ({
      node,
      shape: this.shapeFor(node.type, node.w, node.h)
    }));
  }

  // nodeViews/edgeGeometries build fresh wrapper objects on every read, so the
  // *ngFor MUST track by a stable id. Without this, Angular tears down and
  // rebuilds each node's DOM every change-detection cycle, which instantly
  // destroys a focused editor — the reason typing into a shape did nothing.
  trackNode = (_: number, v: NodeView): string => v.node.id;
  trackEdge = (_: number, g: EdgeGeometry): string => g.edge.id;

  get edgeGeometries(): EdgeGeometry[] {
    const byId = new Map(this.diagram.nodes.map((n) => [n.id, n]));
    const geoms: EdgeGeometry[] = [];
    for (const edge of this.diagram.edges) {
      const from = byId.get(edge.from);
      const to = byId.get(edge.to);
      if (!from || !to) {
        continue;
      }
      geoms.push({ edge, points: this.poly(this.orthRoute(from, to)) });
    }
    return geoms;
  }

  /** The dashed elbow drawn from the source shape to the pointer while connecting. */
  get connectPreview(): { points: string } | null {
    if (!this.connectFromId) {
      return null;
    }
    const from = this.diagram.nodes.find((n) => n.id === this.connectFromId);
    if (!from) {
      return null;
    }
    return { points: this.poly(this.orthRouteToPoint(from, { x: this.connectX, y: this.connectY })) };
  }

  // Orthogonal (right-angle) route between two shapes: exits perpendicular to the
  // side facing the target and enters the target the same way, with the bend on the
  // half-way line — the classic flowchart "elbow" connector.
  private orthRoute(a: FlowNode, b: FlowNode): number[][] {
    const ac = this.center(a);
    const bc = this.center(b);
    const dx = bc.x - ac.x;
    const dy = bc.y - ac.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      const sx = dx >= 0 ? a.x + a.w : a.x;
      const tx = dx >= 0 ? b.x : b.x + b.w;
      const mx = (sx + tx) / 2;
      return [[sx, ac.y], [mx, ac.y], [mx, bc.y], [tx, bc.y]];
    }
    const sy = dy >= 0 ? a.y + a.h : a.y;
    const ty = dy >= 0 ? b.y : b.y + b.h;
    const my = (sy + ty) / 2;
    return [[ac.x, sy], [ac.x, my], [bc.x, my], [bc.x, ty]];
  }

  private orthRouteToPoint(a: FlowNode, p: { x: number; y: number }): number[][] {
    const ac = this.center(a);
    const dx = p.x - ac.x;
    const dy = p.y - ac.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      const sx = dx >= 0 ? a.x + a.w : a.x;
      const mx = (sx + p.x) / 2;
      return [[sx, ac.y], [mx, ac.y], [mx, p.y], [p.x, p.y]];
    }
    const sy = dy >= 0 ? a.y + a.h : a.y;
    const my = (sy + p.y) / 2;
    return [[ac.x, sy], [ac.x, my], [p.x, my], [p.x, p.y]];
  }

  /** Describes how to draw a shape of the given type in a w×h box. */
  shapeFor(type: ShapeType, w: number, h: number): RenderShape {
    switch (type) {
      case 'rectangle':
      case 'square':
        return { kind: 'rect', rx: 0 };
      case 'rounded':
        return { kind: 'rect', rx: 12 };
      case 'ellipse':
      case 'circle':
        return { kind: 'ellipse' };
      case 'process':
        return { kind: 'process' };
      case 'diamond':
        return { kind: 'polygon', points: this.poly([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]) };
      case 'parallelogram': {
        const s = Math.min(w * 0.25, 36);
        return { kind: 'polygon', points: this.poly([[s, 0], [w, 0], [w - s, h], [0, h]]) };
      }
      case 'triangle':
        return { kind: 'polygon', points: this.poly([[w / 2, 0], [w, h], [0, h]]) };
      case 'hexagon': {
        const s = Math.min(w * 0.22, 28);
        return { kind: 'polygon', points: this.poly([[s, 0], [w - s, 0], [w, h / 2], [w - s, h], [s, h], [0, h / 2]]) };
      }
      case 'trapezoid': {
        const s = Math.min(w * 0.2, 30);
        return { kind: 'polygon', points: this.poly([[s, 0], [w - s, 0], [w, h], [0, h]]) };
      }
      case 'step': {
        const s = Math.min(w * 0.2, 24);
        return { kind: 'polygon', points: this.poly([[0, 0], [w - s, 0], [w, h / 2], [w - s, h], [0, h], [s, h / 2]]) };
      }
      case 'cylinder':
        return { kind: 'path', d: this.cylinderPath(w, h) };
      case 'document':
        return { kind: 'path', d: this.documentPath(w, h) };
      case 'internal-storage':
        return { kind: 'path', d: this.internalStoragePath(w, h) };
      case 'cube':
        return { kind: 'path', d: this.cubePath(w, h) };
      case 'tape':
        return { kind: 'path', d: this.tapePath(w, h) };
      case 'or':
        return { kind: 'path', d: this.orPath(w, h) };
      case 'and':
        return { kind: 'path', d: this.andPath(w, h) };
      case 'data-storage':
        return { kind: 'path', d: this.dataStoragePath(w, h) };
      case 'list':
        return { kind: 'path', d: this.listPath(w, h) };
      case 'note':
        return { kind: 'path', d: this.notePath(w, h) };
      case 'card':
        return { kind: 'path', d: this.cardPath(w, h) };
      case 'callout':
        return { kind: 'path', d: this.calloutPath(w, h) };
      case 'cloud':
        return { kind: 'path', d: this.cloudPath(w, h) };
      case 'actor':
        return { kind: 'path', d: this.actorPath(w, h), noFill: true };
      case 'arrow':
        return { kind: 'polygon', points: this.arrowPoints(w, h, false) };
      case 'arrow-double':
        return { kind: 'polygon', points: this.arrowPoints(w, h, true) };
      case 'arrow-curved':
        return { kind: 'path', d: this.curvedArrowPath(w, h), noFill: true, arrowEnd: true };
      case 'line':
        return { kind: 'line', noFill: true };
      case 'line-dashed':
        return { kind: 'line', noFill: true, dash: '8 5' };
      case 'line-dotted':
        return { kind: 'line', noFill: true, dash: '2 4' };
      case 'line-arrow':
        return { kind: 'line', noFill: true, arrowEnd: true };
      case 'line-double-arrow':
        return { kind: 'line', noFill: true, arrowStart: true, arrowEnd: true };
      case 'text':
        return { kind: 'none' };
      default:
        return { kind: 'rect', rx: 0 };
    }
  }

  private center(node: FlowNode): { x: number; y: number } {
    return { x: node.x + node.w / 2, y: node.y + node.h / 2 };
  }

  private poly(points: number[][]): string {
    return points.map((p) => `${this.round(p[0])},${this.round(p[1])}`).join(' ');
  }

  private cylinderPath(w: number, h: number): string {
    const rx = w / 2;
    const ry = Math.min(h * 0.18, 14);
    return (
      `M0,${ry} A${rx},${ry} 0 0 1 ${w},${ry} L${w},${h - ry} A${rx},${ry} 0 0 0 0,${h - ry} Z ` +
      `M${w},${ry} A${rx},${ry} 0 0 0 0,${ry}`
    );
  }

  private documentPath(w: number, h: number): string {
    const wave = h * 0.16;
    return (
      `M0,0 L${w},0 L${w},${this.round(h - wave)} ` +
      `C${this.round(w * 0.72)},${this.round(h + wave * 0.6)} ${this.round(w * 0.28)},${this.round(h - wave * 1.8)} 0,${this.round(h - wave)} Z`
    );
  }

  // A box with a title strip and a left margin rule. The extra subpaths are
  // straight lines, so they enclose no area and never disturb the fill.
  private internalStoragePath(w: number, h: number): string {
    const top = Math.min(h * 0.28, 20);
    const left = Math.min(w * 0.2, 20);
    return (
      `M0,0 L${w},0 L${w},${h} L0,${h} Z ` +
      `M0,${this.round(top)} L${w},${this.round(top)} ` +
      `M${this.round(left)},0 L${this.round(left)},${h}`
    );
  }

  private cubePath(w: number, h: number): string {
    const d = Math.min(w, h) * 0.25;
    return (
      `M0,${this.round(d)} L${this.round(d)},0 L${w},0 L${w},${this.round(h - d)} L${this.round(w - d)},${h} L0,${h} Z ` +
      `M0,${this.round(d)} L${this.round(w - d)},${this.round(d)} L${w},0 ` +
      `M${this.round(w - d)},${this.round(d)} L${this.round(w - d)},${h}`
    );
  }

  private tapePath(w: number, h: number): string {
    const wave = h * 0.14;
    return (
      `M0,${this.round(wave)} C${this.round(w * 0.28)},${this.round(-wave)} ${this.round(w * 0.72)},${this.round(wave * 2.4)} ${w},${this.round(wave * 0.5)} ` +
      `L${w},${this.round(h - wave)} ` +
      `C${this.round(w * 0.72)},${this.round(h + wave)} ${this.round(w * 0.28)},${this.round(h - wave * 2.4)} 0,${this.round(h - wave * 0.5)} Z`
    );
  }

  /** Logic "Or": flat left edge, bulging right edge. */
  private orPath(w: number, h: number): string {
    return `M0,0 Q${w},0 ${w},${this.round(h / 2)} Q${w},${h} 0,${h} Z`;
  }

  /** Logic "And": the Or body with the left edge scooped inwards. */
  private andPath(w: number, h: number): string {
    return (
      `M0,0 Q${w},0 ${w},${this.round(h / 2)} Q${w},${h} 0,${h} ` +
      `Q${this.round(w * 0.4)},${this.round(h / 2)} 0,0 Z`
    );
  }

  /** Both vertical edges curve to the right, like a drum seen side-on. */
  private dataStoragePath(w: number, h: number): string {
    const c = Math.min(w * 0.16, 20);
    return (
      `M${this.round(c)},0 L${w},0 Q${this.round(w - c)},${this.round(h / 2)} ${w},${h} ` +
      `L${this.round(c)},${h} Q0,${this.round(h / 2)} ${this.round(c)},0 Z`
    );
  }

  private listPath(w: number, h: number): string {
    const title = Math.min(h * 0.28, 28);
    return `M0,0 L${w},0 L${w},${h} L0,${h} Z M0,${this.round(title)} L${w},${this.round(title)}`;
  }

  /** Block arrow: single-headed, or double-headed when `both` is set. */
  private arrowPoints(w: number, h: number, both: boolean): string {
    const head = Math.min(w * (both ? 0.24 : 0.32), h * 0.9);
    const top = h * 0.28;
    const bottom = h * 0.72;
    const tail = both ? head : 0;
    const points: number[][] = [];
    if (both) {
      points.push([0, h / 2], [head, 0], [head, top]);
    } else {
      points.push([0, top]);
    }
    points.push([w - head, top], [w - head, 0], [w, h / 2], [w - head, h], [w - head, bottom]);
    if (both) {
      points.push([tail, bottom], [tail, h]);
    } else {
      points.push([0, bottom]);
    }
    return this.poly(points);
  }

  private curvedArrowPath(w: number, h: number): string {
    return (
      `M${this.round(w * 0.1)},${this.round(h * 0.92)} ` +
      `C${this.round(w * 0.1)},${this.round(h * 0.25)} ${this.round(w * 0.45)},${this.round(h * 0.1)} ${this.round(w * 0.92)},${this.round(h * 0.14)}`
    );
  }

  private notePath(w: number, h: number): string {
    const f = Math.min(w, h) * 0.28;
    return (
      `M0,0 L${this.round(w - f)},0 L${w},${this.round(f)} L${w},${h} L0,${h} Z ` +
      `M${this.round(w - f)},0 L${this.round(w - f)},${this.round(f)} L${w},${this.round(f)}`
    );
  }

  private cardPath(w: number, h: number): string {
    const c = Math.min(w, h) * 0.28;
    return `M${this.round(c)},0 L${w},0 L${w},${h} L0,${h} L0,${this.round(c)} Z`;
  }

  private calloutPath(w: number, h: number): string {
    const r = 10;
    const bodyH = h * 0.72;
    return (
      `M${r},0 L${w - r},0 Q${w},0 ${w},${r} L${w},${this.round(bodyH - r)} Q${w},${this.round(bodyH)} ${w - r},${this.round(bodyH)} ` +
      `L${this.round(w * 0.42)},${this.round(bodyH)} L${this.round(w * 0.24)},${h} L${this.round(w * 0.3)},${this.round(bodyH)} L${r},${this.round(bodyH)} ` +
      `Q0,${this.round(bodyH)} 0,${this.round(bodyH - r)} L0,${r} Q0,0 ${r},0 Z`
    );
  }

  private cloudPath(w: number, h: number): string {
    return (
      `M${this.round(0.28 * w)},${this.round(0.9 * h)} ` +
      `C${this.round(0.06 * w)},${this.round(0.9 * h)} ${this.round(0.04 * w)},${this.round(0.58 * h)} ${this.round(0.22 * w)},${this.round(0.52 * h)} ` +
      `C${this.round(0.16 * w)},${this.round(0.26 * h)} ${this.round(0.42 * w)},${this.round(0.14 * h)} ${this.round(0.52 * w)},${this.round(0.32 * h)} ` +
      `C${this.round(0.62 * w)},${this.round(0.12 * h)} ${this.round(0.92 * w)},${this.round(0.18 * h)} ${this.round(0.82 * w)},${this.round(0.44 * h)} ` +
      `C${this.round(1.0 * w)},${this.round(0.5 * h)} ${this.round(0.94 * w)},${this.round(0.86 * h)} ${this.round(0.74 * w)},${this.round(0.86 * h)} Z`
    );
  }

  private actorPath(w: number, h: number): string {
    const cx = w / 2;
    const headR = Math.min(w * 0.32, h * 0.16);
    const headCy = headR + 2;
    const shoulder = headCy + headR + 2;
    const hip = h * 0.62;
    const arms = shoulder + (hip - shoulder) * 0.3;
    return (
      `M${this.round(cx - headR)},${this.round(headCy)} a${this.round(headR)},${this.round(headR)} 0 1 0 ${this.round(headR * 2)},0 a${this.round(headR)},${this.round(headR)} 0 1 0 ${this.round(-headR * 2)},0 ` +
      `M${cx},${this.round(shoulder)} L${cx},${this.round(hip)} ` +
      `M${this.round(w * 0.18)},${this.round(arms)} L${this.round(w * 0.82)},${this.round(arms)} ` +
      `M${cx},${this.round(hip)} L${this.round(w * 0.24)},${h} ` +
      `M${cx},${this.round(hip)} L${this.round(w * 0.76)},${h}`
    );
  }

  private round(n: number): number {
    return Math.round(n * 100) / 100;
  }

  private newId(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  private persist(): void {
    this.store.save(this.diagram);
  }
}
