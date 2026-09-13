import { ChangeDetectorRef, Component, DestroyRef, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AlertButton, AlertController, IonicModule, ToastController } from '@ionic/angular';
import { ThemeSelectorComponent } from '../theme-selector/theme-selector.component';
import { FlowchartStoreService } from '../../services/flowchart-store.service';
import { ExportFormat, FlowchartExportService } from '../../services/flowchart-export.service';
import { FlowchartSessionService } from '../../services/flowchart-session.service';
import { AuthService } from '../../services/auth.service';
import { FlowchartSession } from '../../models/flowchart-session.model';
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
  bendPt: { x: number; y: number };
  isHoriz: boolean;
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
  canvasBg: 'plain' | 'dots' | 'grid' = 'dots';

  cycleCanvasBg(): void {
    const order: Array<'plain' | 'dots' | 'grid'> = ['dots', 'grid', 'plain'];
    const next = order[(order.indexOf(this.canvasBg) + 1) % order.length];
    this.canvasBg = next;
  }

  canvasBgLabel(): string {
    return { plain: 'Plain', dots: 'Dots', grid: 'Grid' }[this.canvasBg];
  }

  togglePalette(): void {
    this.showPalette = !this.showPalette;
  }

  toggleProps(): void {
    this.showProps = !this.showProps;
  }

  // --- Canvas zoom --------------------------------------------------------
  // The canvas draws at a fixed logical scale (a 160px shape is 160 model px at
  // every zoom level) and `.canvas-content` is CSS-scaled on top of that, so
  // nothing in the geometry below has to know about zoom — only the two places
  // that convert between screen pixels and canvas coordinates do.
  /** Matches the `lg` breakpoint in the .scss, where the panels stop being columns. */
  private static readonly STACKED_MAX_WIDTH = 992;

  private get isNarrowScreen(): boolean {
    return window.innerWidth <= FlowchartComponent.STACKED_MAX_WIDTH;
  }

  readonly minZoom = 0.25;
  readonly maxZoom = 3;
  zoom = 1;
  /** Fixed stops so the +/- buttons step through familiar percentages. */
  private readonly zoomStops = [0.25, 0.4, 0.5, 0.65, 0.8, 1, 1.25, 1.5, 2, 2.5, 3];

  get zoomPercent(): number {
    return Math.round(this.zoom * 100);
  }

  /**
   * The drawing area, in unzoomed px: far enough right/down to hold every shape
   * plus room to keep building. `.canvas-sizer` is this multiplied by the zoom,
   * which is what actually gives the canvas its scrollbars — a CSS transform
   * alone does not reliably grow a scroll container's scrollable area.
   */
  get contentWidth(): number {
    let max = 0;
    for (const n of this.diagram.nodes) {
      max = Math.max(max, n.x + n.w);
    }
    return Math.ceil(max + 400);
  }

  get contentHeight(): number {
    let max = 0;
    for (const n of this.diagram.nodes) {
      max = Math.max(max, n.y + n.h);
    }
    return Math.ceil(max + 400);
  }

  zoomIn(): void {
    const next = this.zoomStops.find((z) => z > this.zoom + 0.001);
    this.setZoom(next ?? this.maxZoom);
  }

  zoomOut(): void {
    const next = [...this.zoomStops].reverse().find((z) => z < this.zoom - 0.001);
    this.setZoom(next ?? this.minZoom);
  }

  resetZoom(): void {
    this.setZoom(1);
  }

  /**
   * Scales the view so the whole diagram fits, and scrolls to its top-left.
   * Never zooms past 100%: a two-shape diagram blown up to fill a phone screen
   * is more disorienting than a small one.
   */
  zoomToFit(): void {
    const el = this.canvasRef.nativeElement;
    if (this.diagram.nodes.length === 0) {
      this.setZoom(1);
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of this.diagram.nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.w);
      maxY = Math.max(maxY, n.y + n.h);
    }
    const pad = 32;
    const w = maxX - minX + pad * 2;
    const h = maxY - minY + pad * 2;
    const fit = Math.min(el.clientWidth / w, el.clientHeight / h, 1);
    this.zoom = Math.min(this.maxZoom, Math.max(this.minZoom, fit));
    // The sizer's width/height are bindings, so they only take their new value
    // once change detection has run — assigning scroll offsets before that
    // would clamp them against the old (smaller) scrollable area.
    this.cdr.detectChanges();
    el.scrollLeft = Math.max(0, (minX - pad) * this.zoom);
    el.scrollTop = Math.max(0, (minY - pad) * this.zoom);
  }

  /**
   * Applies a new zoom level while keeping the canvas point under `anchor`
   * (default: the middle of the viewport) pinned to the same spot on screen —
   * otherwise every zoom step throws the user somewhere else in the diagram.
   */
  private setZoom(next: number, anchor?: { clientX: number; clientY: number }): void {
    const clamped = Math.min(this.maxZoom, Math.max(this.minZoom, next));
    if (Math.abs(clamped - this.zoom) < 0.0005) {
      return;
    }
    const el = this.canvasRef.nativeElement;
    const rect = el.getBoundingClientRect();
    const ax = anchor ? anchor.clientX - rect.left : el.clientWidth / 2;
    const ay = anchor ? anchor.clientY - rect.top : el.clientHeight / 2;
    const canvasX = (el.scrollLeft + ax) / this.zoom;
    const canvasY = (el.scrollTop + ay) / this.zoom;
    this.zoom = clamped;
    this.cdr.detectChanges();
    el.scrollLeft = Math.max(0, canvasX * clamped - ax);
    el.scrollTop = Math.max(0, canvasY * clamped - ay);
  }

  /** Ctrl/Cmd + wheel zooms about the pointer, as in every other diagram tool. */
  onCanvasWheel(event: WheelEvent): void {
    if (!event.ctrlKey && !event.metaKey) {
      return;
    }
    event.preventDefault();
    this.setZoom(this.zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12), event);
  }

  // Pinch-to-zoom. Touch events rather than pointer events here because the two
  // fingers have to be read together: the canvas needs the distance between
  // them, which `event.touches` gives directly and pointer events would make us
  // track by hand.
  private pinchStartDist = 0;
  private pinchStartZoom = 1;

  onCanvasTouchStart(event: TouchEvent): void {
    if (event.touches.length === 2) {
      // The first finger may well have landed on a shape and already started a
      // drag (or a resize, or a connection). A second finger means the gesture
      // was a pinch all along, so those are ended here — otherwise the shape
      // would go skidding across the canvas while the view zooms.
      this.endActiveDrag();
      this.pinchStartDist = this.touchDistance(event);
      this.pinchStartZoom = this.zoom;
    }
  }

  /** Finishes whatever drag is in flight, exactly as lifting the finger would. */
  private endActiveDrag(): void {
    if (this.movingNodeId) {
      this.onMoveEnd();
    }
    if (this.resizingNodeId) {
      this.onResizeEnd();
    }
    if (this.rotatingNodeId) {
      this.onRotateEnd();
    }
    if (this.connectFromId) {
      this.onConnectEnd();
    }
    if (this.movingEdgeId) {
      this.onEdgeMoveEnd();
    }
  }

  onCanvasTouchMove(event: TouchEvent): void {
    if (event.touches.length !== 2 || this.pinchStartDist <= 0) {
      return;
    }
    // Stops the browser from panning the canvas (or zooming the page) mid-pinch.
    event.preventDefault();
    const [a, b] = [event.touches[0], event.touches[1]];
    this.setZoom(this.pinchStartZoom * (this.touchDistance(event) / this.pinchStartDist), {
      clientX: (a.clientX + b.clientX) / 2,
      clientY: (a.clientY + b.clientY) / 2
    });
  }

  onCanvasTouchEnd(event: TouchEvent): void {
    if (event.touches.length < 2) {
      this.pinchStartDist = 0;
    }
  }

  private touchDistance(event: TouchEvent): number {
    const [a, b] = [event.touches[0], event.touches[1]];
    return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
  }

  // --- Side panel resize (palette / properties) ---------------------------
  // Desktop starts at a 15/70/15 split (see the .scss), but that's a starting
  // point, not a limit — these dividers let it be dragged within a sane range.
  // The floor matches that starting width: these panels can grow but not
  // shrink past it, so the canvas can't crowd them down to an unusable sliver.
  readonly panelMinPct = 15;
  readonly panelMaxPct = 35;
  paletteWidthPercent = 15;
  propsWidthPercent = 15;
  private resizingPanel: 'palette' | 'props' | null = null;
  private panelResizeStartX = 0;
  private panelResizeStartPct = 0;
  private panelResizeHostW = 0;
  private readonly onPanelResizeMoveRef = (e: PointerEvent) => this.onPanelResizeMove(e);
  private readonly onPanelResizeEndRef = () => this.onPanelResizeEnd();

  /**
   * Pointer events (not mouse events) so dragging either divider resizes its
   * panel from a finger drag too — `touch-action: none` on `.panel-resize-divider`
   * stops the canvas from scrolling underneath it.
   */
  startPanelResize(event: PointerEvent, panel: 'palette' | 'props'): void {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    event.preventDefault();
    this.resizingPanel = panel;
    this.panelResizeStartX = event.clientX;
    this.panelResizeStartPct = panel === 'palette' ? this.paletteWidthPercent : this.propsWidthPercent;
    // The divider's parent is `.flow-body`, whose width the percentages are relative to.
    this.panelResizeHostW = (event.currentTarget as HTMLElement).parentElement?.offsetWidth ?? 900;
    document.addEventListener('pointermove', this.onPanelResizeMoveRef);
    document.addEventListener('pointerup', this.onPanelResizeEndRef);
    document.addEventListener('pointercancel', this.onPanelResizeEndRef);
  }

  private onPanelResizeMove(event: PointerEvent): void {
    if (!this.resizingPanel) {
      return;
    }
    const dPercent = ((event.clientX - this.panelResizeStartX) / this.panelResizeHostW) * 100;
    // The palette's divider sits on its right edge (dragging right grows it);
    // the properties panel's divider sits on its left edge (dragging right
    // shrinks it) — so the same rightward drag has opposite sign for each.
    const signed = this.resizingPanel === 'palette' ? dPercent : -dPercent;
    const next = Math.min(this.panelMaxPct, Math.max(this.panelMinPct, this.panelResizeStartPct + signed));
    if (this.resizingPanel === 'palette') {
      this.paletteWidthPercent = next;
    } else {
      this.propsWidthPercent = next;
    }
  }

  private onPanelResizeEnd(): void {
    this.resizingPanel = null;
    document.removeEventListener('pointermove', this.onPanelResizeMoveRef);
    document.removeEventListener('pointerup', this.onPanelResizeEndRef);
    document.removeEventListener('pointercancel', this.onPanelResizeEndRef);
  }

  // --- Properties panel height resize (mobile/stacked bottom sheet) -------
  // Below `lg` the properties panel becomes a bottom sheet capped at a max
  // height (see the .scss) instead of a side column, so its handle drags
  // vertically and resizes height, not width.
  readonly propsHeightMinVh = 20;
  // Below this the canvas band would be squeezed to its own floor and the sheet
  // would start eating into the toolbar above it.
  readonly propsHeightMaxVh = 60;
  propsHeightVh = 40;
  private resizingPropsHeight = false;
  private propsHeightStartY = 0;
  private propsHeightStartVh = 0;
  private readonly onPropsHeightMoveRef = (e: PointerEvent) => this.onPropsHeightResizeMove(e);
  private readonly onPropsHeightEndRef = () => this.onPropsHeightResizeEnd();

  startPropsHeightResize(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    event.preventDefault();
    this.resizingPropsHeight = true;
    this.propsHeightStartY = event.clientY;
    this.propsHeightStartVh = this.propsHeightVh;
    document.addEventListener('pointermove', this.onPropsHeightMoveRef);
    document.addEventListener('pointerup', this.onPropsHeightEndRef);
    document.addEventListener('pointercancel', this.onPropsHeightEndRef);
  }

  private onPropsHeightResizeMove(event: PointerEvent): void {
    if (!this.resizingPropsHeight) {
      return;
    }
    // The sheet sits below the handle, so dragging UP (negative dy) should grow it.
    const dVh = (-(event.clientY - this.propsHeightStartY) / window.innerHeight) * 100;
    this.propsHeightVh = Math.min(
      this.propsHeightMaxVh,
      Math.max(this.propsHeightMinVh, this.propsHeightStartVh + dVh)
    );
  }

  private onPropsHeightResizeEnd(): void {
    this.resizingPropsHeight = false;
    document.removeEventListener('pointermove', this.onPropsHeightMoveRef);
    document.removeEventListener('pointerup', this.onPropsHeightEndRef);
    document.removeEventListener('pointercancel', this.onPropsHeightEndRef);
  }

  // Drag-to-connect state. `connectFromId` is the source node while dragging a new
  // arrow; `connectX/Y` track the loose end (canvas coords); `connectTargetId` is
  // the node currently under the pointer (highlighted green as a drop target).
  connectFromId: string | null = null;
  connectTargetId: string | null = null;
  connectX = 0;
  connectY = 0;

  // Node move bookkeeping. Pointer events (not mouse events) so a finger drag on a
  // touch screen moves the shape too — `touch-action: none` on .node stops the
  // canvas from scrolling underneath the finger instead.
  private movingNodeId: string | null = null;
  private moveOffsetX = 0;
  private moveOffsetY = 0;
  private moved = false;
  private readonly onMoveRef = (e: PointerEvent) => this.onMove(e);
  private readonly onMoveEndRef = () => this.onMoveEnd();
  private readonly onConnectMoveRef = (e: PointerEvent) => this.onConnectMove(e);
  private readonly onConnectEndRef = () => this.onConnectEnd();

  // Rotate bookkeeping. Same pointer-event pattern as resize below.
  readonly minRotateStep = 15;
  private rotatingNodeId: string | null = null;
  private rotateStart = { pointerAngle: 0, centerX: 0, centerY: 0, nodeAngle: 0 };
  private rotated = false;
  private readonly onRotateMoveRef = (e: PointerEvent) => this.onRotateMove(e);
  private readonly onRotateEndRef = () => this.onRotateEnd();

  // Edge midpoint drag bookkeeping.
  private movingEdgeId: string | null = null;
  private edgeDragIsHoriz = false;
  private edgeDragStartBend = 0;
  private edgeDragStartCanvasPt = { x: 0, y: 0 };
  private readonly onEdgeMoveRef = (e: PointerEvent) => this.onEdgeMove(e);
  private readonly onEdgeMoveEndRef = () => this.onEdgeMoveEnd();

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

  // Ties every session request to this component's lifetime: leaving the page
  // mid-request must not land a response on a destroyed component.
  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private store: FlowchartStoreService,
    private exporter: FlowchartExportService,
    private sessionService: FlowchartSessionService,
    private auth: AuthService,
    private location: Location,
    private router: Router,
    private alertController: AlertController,
    private toastController: ToastController,
    private cdr: ChangeDetectorRef
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

    // Phones and small tablets stack the panels into bands, so an open
    // properties sheet costs the canvas half its height before a single shape
    // has been placed — it opens from the toolbar the moment something is
    // selected instead. The starting zoom shrinks with the screen for the same
    // reason: a 160px-wide shape dropped at 100% on a 360px phone fills nearly
    // half the visible canvas, which makes the diagram impossible to lay out.
    if (this.isNarrowScreen) {
      this.showProps = false;
      this.zoom = Math.min(1, Math.max(0.5, window.innerWidth / 560));
    }

    // The route is public, but the sessions API is not. Signed-out visitors keep
    // the localStorage-only behaviour and never see the two session controls.
    this.canUseSessions = this.auth.isAuthenticated();
    if (this.canUseSessions) {
      // Which saved diagram the canvas is showing, so a refresh still knows
      // whether "Save" means update-this-one or create-a-new-one. The list
      // itself is only fetched when the modal opens.
      const meta = this.store.loadMeta();
      if (meta) {
        this.activeSessionId = meta.id;
        this.activeTitle = meta.title;
      }
    }

    this.paletteGroups = SHAPE_GROUPS.map((group) => ({
      title: group.title,
      items: group.shapes.map((shape) => ({
        shape,
        render: this.shapeFor(shape.type, this.previewW, this.previewH)
      }))
    }));
  }

  ngOnDestroy(): void {
    document.removeEventListener('pointermove', this.onMoveRef);
    document.removeEventListener('pointerup', this.onMoveEndRef);
    document.removeEventListener('pointercancel', this.onMoveEndRef);
    document.removeEventListener('pointermove', this.onConnectMoveRef);
    document.removeEventListener('pointerup', this.onConnectEndRef);
    document.removeEventListener('pointercancel', this.onConnectEndRef);
    document.removeEventListener('pointermove', this.onEdgeMoveRef);
    document.removeEventListener('pointerup', this.onEdgeMoveEndRef);
    document.removeEventListener('pointercancel', this.onEdgeMoveEndRef);
    this.detachResizeListeners();
    this.detachRotateListeners();
    document.removeEventListener('pointermove', this.onPanelResizeMoveRef);
    document.removeEventListener('pointerup', this.onPanelResizeEndRef);
    document.removeEventListener('pointercancel', this.onPanelResizeEndRef);
    document.removeEventListener('pointermove', this.onPropsHeightMoveRef);
    document.removeEventListener('pointerup', this.onPropsHeightEndRef);
    document.removeEventListener('pointercancel', this.onPropsHeightEndRef);
  }

  /**
   * Pointer position in canvas coordinates — i.e. the same space the nodes'
   * x/y/w/h live in, so every drag, resize and rotate below can ignore zoom.
   * Dividing by the zoom is what converts the (scaled) screen offset back into
   * that space; without it a drag at 50% zoom would move a shape twice as far
   * as the finger.
   */
  private canvasPoint(event: MouseEvent): { x: number; y: number } {
    const el = this.canvasRef.nativeElement;
    const rect = el.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left + el.scrollLeft) / this.zoom,
      y: (event.clientY - rect.top + el.scrollTop) / this.zoom
    };
  }

  /**
   * Scrolls the canvas just enough to bring a canvas-space rectangle fully
   * into view — called once a drag or resize ends. Without this, dragging or
   * resizing a shape past the currently-scrolled-into-view area leaves it
   * sitting off-screen with no indication it's still there: OS-default (and
   * especially mobile) scrollbars are invisible until actively touched, so it
   * can look like the shape was lost rather than merely scrolled out of view.
   *
   * Deliberately only called at drag-end, not on every pointermove: adjusting
   * scrollLeft/scrollTop mid-drag would feed back into canvasPoint() (which
   * factors in the current scroll offset), inflating the computed drag delta
   * on the very next pointermove and compounding into runaway growth/movement
   * even with a stationary pointer.
   */
  private scrollRectIntoView(
    leftCanvas: number,
    topCanvas: number,
    rightCanvas: number,
    bottomCanvas: number
  ): void {
    const el = this.canvasRef.nativeElement;
    const margin = 16;
    // scrollLeft/scrollTop are in scaled px, the arguments in canvas px.
    const z = this.zoom;
    const left = leftCanvas * z;
    const top = topCanvas * z;
    const right = rightCanvas * z;
    const bottom = bottomCanvas * z;
    if (right > el.scrollLeft + el.clientWidth - margin) {
      el.scrollLeft = right - el.clientWidth + margin;
    } else if (left < el.scrollLeft + margin) {
      el.scrollLeft = Math.max(0, left - margin);
    }
    if (bottom > el.scrollTop + el.clientHeight - margin) {
      el.scrollTop = bottom - el.clientHeight + margin;
    } else if (top < el.scrollTop + margin) {
      el.scrollTop = Math.max(0, top - margin);
    }
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
    this.addShape(
      type,
      (el.scrollLeft + el.clientWidth / 2) / this.zoom,
      (el.scrollTop + el.clientHeight / 2) / this.zoom
    );
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

  // Pointer events cover mouse, touch and pen from one handler — mouse-only
  // events never fire from a finger drag, which is why moving a shape used to
  // do nothing on a phone. `preventDefault()` is deliberately NOT called here:
  // on touch it would suppress the synthetic `click` a tap-without-drag relies
  // on for selection (see onNodeClick). Instead `.node` sets `touch-action: none`
  // in CSS, which stops the canvas from panning under the finger just as well.
  onNodePointerDown(event: PointerEvent, node: FlowNode): void {
    // Left button only for a mouse; ignore while editing the label.
    if ((event.pointerType === 'mouse' && event.button !== 0) || this.editingNodeId === node.id) {
      return;
    }
    event.stopPropagation();
    this.movingNodeId = node.id;
    this.moved = false;
    const point = this.canvasPoint(event);
    this.moveOffsetX = point.x - node.x;
    this.moveOffsetY = point.y - node.y;
    document.addEventListener('pointermove', this.onMoveRef);
    document.addEventListener('pointerup', this.onMoveEndRef);
    document.addEventListener('pointercancel', this.onMoveEndRef);
  }

  private onMove(event: PointerEvent): void {
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
    document.removeEventListener('pointermove', this.onMoveRef);
    document.removeEventListener('pointerup', this.onMoveEndRef);
    document.removeEventListener('pointercancel', this.onMoveEndRef);
    if (this.moved) {
      this.persist();
      const node = this.diagram.nodes.find((n) => n.id === this.movingNodeId);
      if (node) {
        this.scrollRectIntoView(node.x, node.y, node.x + node.w, node.y + node.h);
      }
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
    // Alt resizes from the shape's centre: the untouched edge mirrors the
    // dragged one instead of staying put, so growing 20px on the right also
    // grows 20px on the left. Doubling the raw delta here — rather than
    // splitting it after clamping — keeps the corner-drag / proportion-lock
    // maths below unchanged; only the final re-centring step (further down)
    // needs to know about Alt at all.
    const symMul = event.altKey ? 2 : 1;
    let { w, h } = start;
    let x = start.nodeX;
    let y = start.nodeY;

    if (dir.includes('e')) {
      w = Math.max(min, start.w + symMul * (point.x - start.x));
    } else if (dir.includes('w')) {
      // Dragging the left edge moves the origin as well, so the right edge stays put.
      w = Math.max(min, start.w - symMul * (point.x - start.x));
      x = start.nodeX + start.w - w;
    }
    if (dir.includes('s')) {
      h = Math.max(min, start.h + symMul * (point.y - start.y));
    } else if (dir.includes('n')) {
      h = Math.max(min, start.h - symMul * (point.y - start.y));
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

    // Re-centre on whichever axis this handle actually touches, using the
    // final (possibly proportion-locked) width/height — works the same for a
    // single-edge handle or a corner, and composes with Shift above.
    if (event.altKey) {
      if (dir.includes('e') || dir.includes('w')) {
        x = start.nodeX + start.w / 2 - w / 2;
      }
      if (dir.includes('n') || dir.includes('s')) {
        y = start.nodeY + start.h / 2 - h / 2;
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
      const node = this.diagram.nodes.find((n) => n.id === this.resizingNodeId);
      if (node) {
        this.scrollRectIntoView(node.x, node.y, node.x + node.w, node.y + node.h);
      }
    }
    this.resizingNodeId = null;
  }

  private detachResizeListeners(): void {
    document.removeEventListener('pointermove', this.onResizeMoveRef);
    document.removeEventListener('pointerup', this.onResizeEndRef);
    document.removeEventListener('pointercancel', this.onResizeEndRef);
  }

  // --- Rotating a node -----------------------------------------------------

  /**
   * Starts a free rotation drag from the handle above the selected shape.
   * The dragged angle is measured from the shape's centre (canvas coords), so
   * it works the same regardless of where the handle itself currently sits.
   * Hold Shift to snap to 15° steps.
   */
  startRotate(event: PointerEvent, node: FlowNode): void {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    event.stopPropagation();
    event.preventDefault();
    this.select(node.id, null);
    this.rotatingNodeId = node.id;
    this.rotated = false;
    const center = this.center(node);
    const point = this.canvasPoint(event);
    this.rotateStart = {
      pointerAngle: this.angleDeg(point, center),
      centerX: center.x,
      centerY: center.y,
      nodeAngle: node.rotation ?? 0
    };
    document.addEventListener('pointermove', this.onRotateMoveRef);
    document.addEventListener('pointerup', this.onRotateEndRef);
    document.addEventListener('pointercancel', this.onRotateEndRef);
  }

  private onRotateMove(event: PointerEvent): void {
    const node = this.diagram.nodes.find((n) => n.id === this.rotatingNodeId);
    if (!node) {
      return;
    }
    this.rotated = true;
    const start = this.rotateStart;
    const point = this.canvasPoint(event);
    const currentAngle = this.angleDeg(point, { x: start.centerX, y: start.centerY });
    let deg = start.nodeAngle + (currentAngle - start.pointerAngle);
    if (event.shiftKey) {
      deg = Math.round(deg / this.minRotateStep) * this.minRotateStep;
    }
    node.rotation = this.normalizeDeg(deg);
  }

  private onRotateEnd(): void {
    this.detachRotateListeners();
    if (this.rotated) {
      this.persist();
    }
    this.rotatingNodeId = null;
  }

  private detachRotateListeners(): void {
    document.removeEventListener('pointermove', this.onRotateMoveRef);
    document.removeEventListener('pointerup', this.onRotateEndRef);
    document.removeEventListener('pointercancel', this.onRotateEndRef);
  }

  /** Angle in degrees from `origin` to `point`, clockwise from 3 o'clock (matches CSS rotate()). */
  private angleDeg(point: { x: number; y: number }, origin: { x: number; y: number }): number {
    return (Math.atan2(point.y - origin.y, point.x - origin.x) * 180) / Math.PI;
  }

  private normalizeDeg(deg: number): number {
    return ((Math.round(deg) % 360) + 360) % 360;
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

  /** Rotation field in the properties panel — the keyboard route to rotating. */
  setNodeRotation(value: number): void {
    const node = this.selectedNode;
    if (!node || !Number.isFinite(value)) {
      return;
    }
    node.rotation = this.normalizeDeg(value);
    this.persist();
  }

  resetNodeRotation(): void {
    const node = this.selectedNode;
    if (!node) {
      return;
    }
    delete node.rotation;
    this.persist();
  }

  // --- Selection ---------------------------------------------------------

  // Manual double-tap bookkeeping for `onNodeClick` below. Real touch browsers
  // are inconsistent about firing a native `dblclick` from two taps — on several
  // Android/Chrome combinations each synthesized `click` keeps `event.detail`
  // at 1 instead of incrementing on the second tap, so `dblclick` never fires
  // at all and double-tap-to-edit silently does nothing. Tracking the timing of
  // plain `click` events ourselves works identically for a mouse and a finger.
  private lastTapNodeId: string | null = null;
  private lastTapAt = 0;
  private static readonly DOUBLE_TAP_MS = 400;

  onNodeClick(event: MouseEvent, node: FlowNode): void {
    event.stopPropagation();
    if (this.moved) {
      // This click concludes a drag — don't treat it as a select toggle.
      return;
    }
    const now = Date.now();
    const isDoubleTap =
      this.lastTapNodeId === node.id && now - this.lastTapAt < FlowchartComponent.DOUBLE_TAP_MS;
    // Reset rather than re-arm on a hit, so a third rapid tap needs a fresh pair
    // instead of instantly re-triggering edit mode.
    this.lastTapNodeId = isDoubleTap ? null : node.id;
    this.lastTapAt = now;
    this.select(node.id, null);
    if (isDoubleTap && this.editingNodeId !== node.id) {
      this.beginEdit(node.id);
    }
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

  /** The currently selected edge, or null. */
  get selectedEdge(): FlowEdge | null {
    return this.selectedEdgeId
      ? this.diagram.edges.find((e) => e.id === this.selectedEdgeId) ?? null
      : null;
  }

  setEdgeRouting(routing: 'elbow' | 'straight'): void {
    const edge = this.selectedEdge;
    if (!edge) return;
    edge.routing = routing;
    if (routing === 'straight') delete edge.bend;
    this.persist();
  }

  setEdgeDash(dash: 'solid' | 'dashed' | 'dotted'): void {
    const edge = this.selectedEdge;
    if (!edge) return;
    edge.dash = dash;
    this.persist();
  }

  setEdgeEndArrow(style: 'filled' | 'open' | 'none'): void {
    const edge = this.selectedEdge;
    if (!edge) return;
    edge.endArrow = style;
    this.persist();
  }

  setEdgeStartArrow(style: 'none' | 'filled' | 'open'): void {
    const edge = this.selectedEdge;
    if (!edge) return;
    edge.startArrow = style;
    this.persist();
  }

  /** Shortcut that sets both start + end arrows at once. */
  setEdgeDirection(dir: 'forward' | 'backward' | 'both' | 'none'): void {
    const edge = this.selectedEdge;
    if (!edge) return;
    switch (dir) {
      case 'forward':  edge.endArrow = 'filled'; edge.startArrow = 'none'; break;
      case 'backward': edge.endArrow = 'none';   edge.startArrow = 'filled'; break;
      case 'both':     edge.endArrow = 'filled'; edge.startArrow = 'filled'; break;
      case 'none':     edge.endArrow = 'none';   edge.startArrow = 'none'; break;
    }
    this.persist();
  }

  setEdgeColor(color: string | null): void {
    const edge = this.selectedEdge;
    if (!edge) return;
    if (color === null) delete edge.color;
    else edge.color = color;
    this.persist();
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
   * Extra padding (beyond the base 4px) so the label's rectangular text box
   * stays inside the shape's actual drawn outline instead of its full bounding
   * box — e.g. a parallelogram's slanted sides cut into the top-left and
   * bottom-right corners of its bounding rectangle, so text laid out edge to
   * edge visibly spills past the outline there. The `x`/`top` figures mirror
   * the exact corner-cut formulas `shapeFor()` uses to draw each shape, so the
   * safe area actually lines up with what's on screen; shapes not listed here
   * are already safe at their full bounding box (rect, ellipse, line, ...).
   */
  private textInset(node: FlowNode): { x: number; top: number } {
    const w = node.w;
    const h = node.h;
    switch (node.type) {
      case 'parallelogram':
        return { x: Math.min(w * 0.25, 36), top: 0 };
      case 'trapezoid':
        return { x: Math.min(w * 0.2, 30), top: 0 };
      case 'hexagon':
        return { x: Math.min(w * 0.22, 28), top: 0 };
      case 'step':
        // Only the left edge notches inward (the right side's point sits
        // outside the bounding box, so it never cuts into the text area).
        return { x: Math.min(w * 0.2, 24), top: 0 };
      // Diamond/triangle taper to a point, so no fixed inset makes every line
      // fully safe — these percentages are a practical compromise (matches how
      // most diagram tools handle it) rather than a mathematical guarantee.
      case 'diamond':
        return { x: w * 0.18, top: h * 0.18 };
      case 'triangle':
        return { x: w * 0.16, top: h * 0.32 };
      default:
        return { x: 0, top: 0 };
    }
  }

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
    const inset = this.textInset(node);
    style['padding'] = `${4 + inset.top}px ${4 + inset.x}px 4px`;
    return style;
  }

  /**
   * How many whole lines of this node's text fit inside its shape. The label
   * is clipped to exactly this many, so a line is either fully shown or not
   * shown at all.
   */
  private labelLineFit(node: FlowNode): { maxLines: number; lineHeightPx: number } {
    const fontSize = node.fontSize ?? this.defaultFontSize;
    const lineHeightPx = fontSize * ((node.lineHeight ?? this.defaultLineHeight) / 100);
    const inset = this.textInset(node);
    const availableH = node.h - (4 + inset.top) - 4;
    return { maxLines: Math.max(1, Math.floor(availableH / lineHeightPx)), lineHeightPx };
  }

  /**
   * The label's outer box: everything from labelStyle() plus the vertical
   * alignment. This is a real flexbox rather than the legacy `-webkit-box`
   * the clamp below needs, because the two cannot share one element —
   * `-webkit-box-pack` (the old model's equivalent of align-items) is ignored
   * outright once `-webkit-line-clamp` is on the same box, which is why every
   * label used to sit at the top of its shape whatever its valign said.
   */
  labelBoxStyle(node: FlowNode): { [prop: string]: string } {
    const style = this.labelStyle(node);
    style['display'] = 'flex';
    style['align-items'] = { top: 'flex-start', middle: 'center', bottom: 'flex-end' }[
      node.valign ?? 'middle'
    ];
    return style;
  }

  /**
   * The clamped text itself, the single flex item inside labelBoxStyle().
   * `-webkit-line-clamp` ends the last visible line in "…" instead of cutting
   * it off with no indication — but it only marks that line, it does not stop
   * the lines after it from being laid out and painted, so on its own it lets
   * the next line bleed half-visible past the shape's outline. The max-height
   * is what actually guarantees the clip lands on a line boundary: an exact
   * multiple of the line height, so a line is never sliced through the middle.
   */
  labelClampStyle(node: FlowNode): { [prop: string]: string } {
    const { maxLines, lineHeightPx } = this.labelLineFit(node);
    return {
      display: '-webkit-box',
      '-webkit-box-orient': 'vertical',
      '-webkit-line-clamp': String(maxLines),
      'max-height': `${maxLines * lineHeightPx}px`,
      overflow: 'hidden',
      width: '100%'
    };
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

  /** Vertical alignment options, top to bottom. Drives the vertical-align radiogroup. */
  readonly valignments: Array<'top' | 'middle' | 'bottom'> = ['top', 'middle', 'bottom'];

  setValign(valign: 'top' | 'middle' | 'bottom'): void {
    const node = this.selectedNode;
    if (!node) {
      return;
    }
    node.valign = valign;
    this.persist();
  }

  /** Same WAI-ARIA radio pattern as onAlignKeydown, but Up/Left = previous, Down/Right = next. */
  onValignKeydown(event: KeyboardEvent): void {
    const order = this.valignments;
    const current = this.selectedNode?.valign ?? 'middle';
    let idx = order.indexOf(current);
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      idx = (idx + 1) % order.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      idx = (idx - 1 + order.length) % order.length;
    } else {
      return;
    }
    event.preventDefault();
    this.setValign(order[idx]);
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

  /**
   * Begins dragging a new arrow out of `node` from one of its side handles.
   * Pointer events (not mouse events) so dragging a connection works from a
   * finger drag too — `touch-action: none` on `.connect-handle` stops the
   * canvas from scrolling underneath it, same as the move/resize/rotate handles.
   */
  startConnect(event: PointerEvent, node: FlowNode): void {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    event.stopPropagation();
    event.preventDefault();
    this.connectFromId = node.id;
    this.connectTargetId = null;
    const point = this.canvasPoint(event);
    this.connectX = point.x;
    this.connectY = point.y;
    document.addEventListener('pointermove', this.onConnectMoveRef);
    document.addEventListener('pointerup', this.onConnectEndRef);
    document.addEventListener('pointercancel', this.onConnectEndRef);
  }

  private onConnectMove(event: PointerEvent): void {
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
    document.removeEventListener('pointermove', this.onConnectMoveRef);
    document.removeEventListener('pointerup', this.onConnectEndRef);
    document.removeEventListener('pointercancel', this.onConnectEndRef);
    const from = this.connectFromId;
    const to = this.connectTargetId;
    this.connectFromId = null;
    this.connectTargetId = null;
    if (!from || !to || from === to) {
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
  // Entered via the double-tap detection in onNodeClick (above) or the F2/Enter
  // shortcut in onKeyDown (below) — both call beginEdit() directly.

  /**
   * Shows a real <textarea> over the node and focuses it. A native form control
   * is used instead of a contenteditable div because contenteditable silently
   * refuses input when an ancestor sets `user-select: none` (as the draggable
   * node does), which varies by browser and is hard to get right. The <textarea>
   * only exists in the DOM once `editingNodeId` is set, so it needs a render
   * before it can be focused — but that render must happen *synchronously*
   * (`detectChanges()`, not a `setTimeout`/microtask hop) because mobile
   * browsers only auto-show the on-screen keyboard for a `focus()` called
   * within the same call stack as the original tap; deferring it even by a
   * macrotask drops out of that user-activation window and the keyboard
   * silently never opens, even though focus "succeeds" programmatically.
   */
  private beginEdit(nodeId: string): void {
    this.editingNodeId = nodeId;
    // Double-tapping a shape is the "work on this one" gesture, so on the
    // stacked layout — where the properties sheet starts closed to leave the
    // canvas its full height — this is also the moment to raise the sheet.
    // What it holds (font, size, colour, alignment) applies to the text about
    // to be typed, and unlike the desktop side column there is nothing
    // permanently on screen to show it otherwise.
    const raisingSheet = this.isNarrowScreen && !this.showProps;
    if (raisingSheet) {
      this.showProps = true;
    }
    this.cdr.detectChanges();
    const input = this.canvasRef.nativeElement.querySelector(
      `[data-node-id="${nodeId}"] .node-input`
    ) as HTMLTextAreaElement | null;
    if (input) {
      input.focus();
      input.select();
    }
    // The sheet takes its height out of the canvas band, which can push the
    // shape being edited off the top of what is left of it.
    if (raisingSheet) {
      const node = this.diagram.nodes.find((n) => n.id === nodeId);
      if (node) {
        this.scrollRectIntoView(node.x, node.y, node.x + node.w, node.y + node.h);
      }
    }
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
    if (event.key === 'Enter') {
      // Enter always inserts a newline like an ordinary textarea — stopPropagation
      // just keeps the window keydown handler from treating it as "rename again".
      // Tap/click elsewhere (blur) is what commits the label.
      event.stopPropagation();
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
    // `dialogOpen` matters as much as `editingNodeId` here: the save and rename
    // alerts contain a text field, and this listener is on the window — without
    // the guard, a Backspace while correcting a title deletes the selected shape
    // and Enter starts editing its label.
    if (this.editingNodeId || this.dialogOpen) {
      return;
    }
    if (event.key === 'Escape' && this.exportOpen) {
      this.exportOpen = false;
      return;
    }
    // The sessions modal owns the keyboard while it is open: Delete typed in
    // its rename field must not delete a shape behind it.
    if (this.sessionsOpen) {
      if (event.key === 'Escape') {
        this.sessionsOpen = false;
      }
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

  async clear(): Promise<void> {
    if (this.diagram.nodes.length === 0 && this.diagram.edges.length === 0) {
      return;
    }
    // Naming the shape count makes the consequence concrete — the canvas may be
    // scrolled away from whatever is about to be deleted.
    const count = this.diagram.nodes.length;
    const alert = await this.alertController.create({
      header: 'Clear flowchart',
      cssClass: 'app-confirm-alert app-confirm-danger',
      message: `Delete all ${count} shape${count === 1 ? '' : 's'} and their connections? This cannot be undone.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Clear',
          role: 'destructive',
          cssClass: 'alert-button-danger',
          handler: () => {
            this.diagram = { nodes: [], edges: [] };
            this.connectFromId = null;
            this.select(null, null);
            this.persist();
            this.showToast('Flowchart cleared', 'success');
          }
        }
      ]
    });
    await alert.present();
  }

  // --- Saved sessions ----------------------------------------------------
  // The diagram above is always mirrored to localStorage; this is the separate,
  // per-user store that lets one person keep several named flowcharts and pick
  // up any of them later. Mirrors the playground-sessions feature.

  /** Gates both session controls — false for signed-out visitors. */
  canUseSessions = false;
  sessionsOpen = false;
  sessions: FlowchartSession[] = [];
  sessionsLoading = false;
  activeSessionId: string | null = null;
  activeTitle = '';
  isSavingSession = false;
  /** True when the canvas has changed since the last save or open. */
  private dirty = false;
  /** True while an alert with a text input is up — see onKeyDown. */
  private dialogOpen = false;

  /** Present an alert and keep the canvas keyboard shortcuts out of its input. */
  private async presentDialog(alert: HTMLIonAlertElement): Promise<{ role?: string }> {
    this.dialogOpen = true;
    await alert.present();
    const detail = await alert.onDidDismiss();
    this.dialogOpen = false;
    return detail;
  }

  /** Nothing to save from a blank canvas — unless a saved session is open, in
   *  which case emptying it is itself a change worth keeping. */
  get canSaveSession(): boolean {
    return this.diagram.nodes.length > 0 || !!this.activeSessionId;
  }

  openSessions(event: MouseEvent): void {
    // The document:click listener that closes the export menu would otherwise
    // also see this click; it does no harm, but stopping it keeps the two menus
    // independent.
    event.stopPropagation();
    this.sessionsOpen = true;
    this.loadSessions();
  }

  closeSessions(): void {
    this.sessionsOpen = false;
  }

  private loadSessions(): void {
    this.sessionsLoading = true;
    this.sessionService
      .getSessions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sessions) => {
          // Normalised first: everything below indexes this list, and a
          // non-array response would throw inside the callback rather than
          // simply showing nothing.
          this.sessions = Array.isArray(sessions) ? sessions : [];
          this.sessionsLoading = false;
        },
        error: () => {
          // Keep whatever the list last had — a transient failure should not
          // look like "you have no saved flowcharts".
          this.sessionsLoading = false;
          this.showToast('Could not load your saved flowcharts.', 'danger');
        }
      });
  }

  async openSaveDialog(): Promise<void> {
    if (this.isSavingSession || !this.canSaveSession) {
      return;
    }

    const buttons: AlertButton[] = [{ text: 'Cancel', role: 'cancel' }];
    if (this.activeSessionId) {
      // Editing a saved diagram: offer both overwriting it and branching off a
      // copy, so "Save" can never silently fork or silently overwrite.
      buttons.push(
        {
          text: 'Save as new',
          handler: (data: { title?: string }) => {
            this.saveSession(data.title, true);
          }
        },
        {
          text: 'Update',
          cssClass: 'alert-save-btn',
          handler: (data: { title?: string }) => {
            this.saveSession(data.title, false);
          }
        }
      );
    } else {
      buttons.push({
        text: 'Save',
        cssClass: 'alert-save-btn',
        handler: (data: { title?: string }) => {
          this.saveSession(data.title, false);
        }
      });
    }

    const alert = await this.alertController.create({
      header: this.activeSessionId ? 'Save flowchart' : 'Save flowchart to your account',
      cssClass: 'app-confirm-alert',
      inputs: [
        {
          name: 'title',
          type: 'text',
          value: this.activeTitle || 'New Flowchart',
          placeholder: 'Flowchart name',
          attributes: { maxlength: 120, autofocus: true }
        }
      ],
      buttons
    });
    await this.presentDialog(alert);
  }

  private saveSession(title: string | undefined, asNew: boolean): void {
    // Writes are never de-duplicated at the HTTP layer — two saves are two
    // intents — so a double-tap has to be stopped here.
    if (this.isSavingSession) return;
    this.isSavingSession = true;

    const payload = {
      // Capped client-side as well as on the server: the API rejects an
      // over-long title with a 400, and there is no reason to make the trip.
      title: (title ?? '').trim().slice(0, 120) || this.activeTitle || 'New Flowchart',
      nodes: this.diagram.nodes,
      edges: this.diagram.edges,
      canvasBg: this.canvasBg
    };

    const request =
      this.activeSessionId && !asNew
        ? this.sessionService.updateSession(this.activeSessionId, payload)
        : this.sessionService.createSession(payload);

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (saved) => {
        this.isSavingSession = false;
        this.adoptSession(saved);
        this.sessions = this.sessions.some((s) => s._id === saved._id)
          ? this.sessions.map((s) => (s._id === saved._id ? saved : s))
          : [saved, ...this.sessions];
        this.showToast(`Saved as "${saved.title}"`, 'success');
      },
      error: () => {
        this.isSavingSession = false;
        this.showToast('Could not save your flowchart. Please try again.', 'danger');
      }
    });
  }

  /** Point the canvas at a saved session without touching the shapes on it. */
  private adoptSession(session: FlowchartSession): void {
    this.activeSessionId = session._id;
    this.activeTitle = session.title;
    this.store.saveMeta({ id: session._id, title: session.title });
    this.dirty = false;
  }

  /** Resume editing a saved flowchart. */
  async openSession(session: FlowchartSession): Promise<void> {
    if (session._id === this.activeSessionId && !this.dirty) {
      this.sessionsOpen = false;
      return;
    }
    if (this.dirty && this.diagram.nodes.length > 0) {
      const confirmed = await this.confirmDiscard(`"${session.title}"`);
      if (!confirmed) return;
    }

    // Replaced wholesale rather than mutated: the ids in the old diagram mean
    // nothing in the new one.
    this.diagram = {
      nodes: Array.isArray(session.nodes) ? session.nodes : [],
      edges: Array.isArray(session.edges) ? session.edges : []
    };
    this.canvasBg = session.canvasBg ?? 'dots';
    this.select(null, null);
    this.editingNodeId = null;
    this.connectFromId = null;
    this.connectTargetId = null;

    this.persist();
    this.adoptSession(session);
    this.sessionsOpen = false;
    // A diagram laid out on a desktop is usually wider than a phone screen, so
    // reopening it there would otherwise show one corner with no sign the rest
    // exists. Desktop keeps whatever zoom the user chose.
    if (this.isNarrowScreen) {
      this.zoomToFit();
    }
    this.showToast(`Opened "${session.title}"`, 'success');
  }

  private async confirmDiscard(nextTitle: string): Promise<boolean> {
    const alert = await this.alertController.create({
      header: 'Unsaved changes',
      cssClass: 'app-confirm-alert',
      message: `The flowchart on the canvas has changes that are not saved. Open ${nextTitle} anyway?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Discard and open', role: 'discard', cssClass: 'alert-button-danger' }
      ]
    });
    await alert.present();
    // Reading the role rather than using handlers means a backdrop tap or an
    // Escape — neither of which fires a handler — also counts as "cancel".
    const { role } = await alert.onDidDismiss();
    return role === 'discard';
  }

  /** Start a blank flowchart, detached from any saved session. */
  async newSession(): Promise<void> {
    if (this.dirty && this.diagram.nodes.length > 0) {
      const confirmed = await this.confirmDiscard('a new flowchart');
      if (!confirmed) return;
    }
    this.diagram = { nodes: [], edges: [] };
    this.select(null, null);
    this.editingNodeId = null;
    this.connectFromId = null;
    this.activeSessionId = null;
    this.activeTitle = '';
    this.store.saveMeta(null);
    this.persist();
    this.dirty = false;
    this.sessionsOpen = false;
  }

  async renameSession(session: FlowchartSession, event: Event): Promise<void> {
    event.stopPropagation();
    const alert = await this.alertController.create({
      header: 'Rename flowchart',
      cssClass: 'app-confirm-alert',
      inputs: [
        {
          name: 'title',
          type: 'text',
          value: session.title,
          placeholder: 'Flowchart name',
          attributes: { maxlength: 120, autofocus: true }
        }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Rename',
          cssClass: 'alert-save-btn',
          handler: (data: { title?: string }) => {
            const title = (data.title ?? '').trim().slice(0, 120);
            if (!title) return;
            this.sessionService
              .updateSession(session._id, { title })
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe({
                next: (updated) => {
                  this.sessions = this.sessions.map((s) => (s._id === updated._id ? updated : s));
                  if (this.activeSessionId === updated._id) {
                    this.adoptSession(updated);
                  }
                },
                error: () => this.showToast('Could not rename that flowchart.', 'danger')
              });
          }
        }
      ]
    });
    await this.presentDialog(alert);
  }

  async deleteSession(session: FlowchartSession, event: Event): Promise<void> {
    event.stopPropagation();
    const alert = await this.alertController.create({
      header: 'Delete flowchart',
      cssClass: 'app-confirm-alert app-confirm-danger',
      message: `Delete "${session.title}"? This cannot be undone.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          cssClass: 'alert-button-danger',
          handler: () => {
            this.sessionService
              .deleteSession(session._id)
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe({
                next: () => {
                  this.sessions = this.sessions.filter((s) => s._id !== session._id);
                  if (this.activeSessionId === session._id) {
                    // The canvas keeps its shapes — only the link to the saved
                    // copy is gone, so the next save creates a new one.
                    this.activeSessionId = null;
                    this.activeTitle = '';
                    this.store.saveMeta(null);
                    this.dirty = true;
                  }
                  this.showToast('Flowchart deleted', 'success');
                },
                // Without this the row would disappear only because nothing
                // said otherwise, and reappear on the next load.
                error: () => this.showToast('Could not delete that flowchart.', 'danger')
              });
          }
        }
      ]
    });
    await alert.present();
  }

  formatSessionDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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

  /** Helper: marker URL or empty string based on arrow style. */
  edgeMarkerEnd(edge: FlowEdge): string {
    switch (edge.endArrow ?? 'filled') {
      case 'filled': return 'url(#flow-arrow)';
      case 'open':   return 'url(#flow-arrow-open)';
      case 'none':   return '';
    }
  }

  edgeMarkerStart(edge: FlowEdge): string {
    switch (edge.startArrow ?? 'none') {
      case 'filled': return 'url(#flow-arrow)';
      case 'open':   return 'url(#flow-arrow-open)';
      case 'none':   return '';
    }
  }

  edgeDashArray(edge: FlowEdge): string {
    switch (edge.dash ?? 'solid') {
      case 'dashed': return '10 5';
      case 'dotted': return '2 5';
      default: return '';
    }
  }

  get edgeGeometries(): EdgeGeometry[] {
    const byId = new Map(this.diagram.nodes.map((n) => [n.id, n]));
    const geoms: EdgeGeometry[] = [];
    for (const edge of this.diagram.edges) {
      const from = byId.get(edge.from);
      const to = byId.get(edge.to);
      if (!from || !to) {
        continue;
      }
      const route = (edge.routing === 'straight')
        ? this.straightRoute(from, to)
        : this.orthRoute(from, to, edge.bend);
      geoms.push({ edge, points: this.poly(route.pts), bendPt: route.bendPt, isHoriz: route.isHoriz });
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

  /** Direct straight line between the nearest sides of two shapes. */
  private straightRoute(a: FlowNode, b: FlowNode): { pts: number[][], bendPt: { x: number; y: number }, isHoriz: boolean } {
    const ac = this.center(a);
    const bc = this.center(b);
    const dx = bc.x - ac.x;
    const dy = bc.y - ac.y;
    const isHoriz = Math.abs(dx) >= Math.abs(dy);
    let sx: number, sy: number, tx: number, ty: number;
    if (isHoriz) {
      sx = dx >= 0 ? a.x + a.w : a.x;
      sy = ac.y;
      tx = dx >= 0 ? b.x : b.x + b.w;
      ty = bc.y;
    } else {
      sx = ac.x;
      sy = dy >= 0 ? a.y + a.h : a.y;
      tx = bc.x;
      ty = dy >= 0 ? b.y : b.y + b.h;
    }
    return {
      pts: [[sx, sy], [tx, ty]],
      bendPt: { x: (sx + tx) / 2, y: (sy + ty) / 2 },
      isHoriz
    };
  }

  // Orthogonal (right-angle) route between two shapes: exits perpendicular to the
  // side facing the target and enters the target the same way, with the bend on the
  // half-way line — the classic flowchart "elbow" connector.
  // `bend` overrides the natural mid-point so the user can drag the elbow.
  private orthRoute(a: FlowNode, b: FlowNode, bend?: number): { pts: number[][], bendPt: { x: number; y: number }, isHoriz: boolean } {
    const ac = this.center(a);
    const bc = this.center(b);
    const dx = bc.x - ac.x;
    const dy = bc.y - ac.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      const sx = dx >= 0 ? a.x + a.w : a.x;
      const tx = dx >= 0 ? b.x : b.x + b.w;
      const mx = bend !== undefined ? bend : (sx + tx) / 2;
      return {
        pts: [[sx, ac.y], [mx, ac.y], [mx, bc.y], [tx, bc.y]],
        bendPt: { x: mx, y: (ac.y + bc.y) / 2 },
        isHoriz: true
      };
    }
    const sy = dy >= 0 ? a.y + a.h : a.y;
    const ty = dy >= 0 ? b.y : b.y + b.h;
    const my = bend !== undefined ? bend : (sy + ty) / 2;
    return {
      pts: [[ac.x, sy], [ac.x, my], [bc.x, my], [bc.x, ty]],
      bendPt: { x: (ac.x + bc.x) / 2, y: my },
      isHoriz: false
    };
  }

  // --- Edge midpoint drag -----------------------------------------------

  /**
   * Pointer events (not mouse events) so dragging the bend handle works from a
   * finger drag too — `touch-action: none` on `.edge-bend-handle` stops the
   * canvas from scrolling underneath it.
   */
  onEdgeMidPointerDown(event: PointerEvent, g: EdgeGeometry): void {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    event.stopPropagation();
    event.preventDefault();
    this.select(null, g.edge.id);
    this.movingEdgeId = g.edge.id;
    this.edgeDragIsHoriz = g.isHoriz;
    this.edgeDragStartBend = g.edge.bend !== undefined
      ? g.edge.bend
      : (g.isHoriz ? g.bendPt.x : g.bendPt.y);
    this.edgeDragStartCanvasPt = this.canvasPoint(event);
    document.addEventListener('pointermove', this.onEdgeMoveRef);
    document.addEventListener('pointerup', this.onEdgeMoveEndRef);
    document.addEventListener('pointercancel', this.onEdgeMoveEndRef);
  }

  private onEdgeMove(event: PointerEvent): void {
    const edge = this.diagram.edges.find((e) => e.id === this.movingEdgeId);
    if (!edge) return;
    const point = this.canvasPoint(event);
    if (this.edgeDragIsHoriz) {
      edge.bend = this.edgeDragStartBend + (point.x - this.edgeDragStartCanvasPt.x);
    } else {
      edge.bend = this.edgeDragStartBend + (point.y - this.edgeDragStartCanvasPt.y);
    }
  }

  private onEdgeMoveEnd(): void {
    document.removeEventListener('pointermove', this.onEdgeMoveRef);
    document.removeEventListener('pointerup', this.onEdgeMoveEndRef);
    document.removeEventListener('pointercancel', this.onEdgeMoveEndRef);
    if (this.movingEdgeId) {
      this.persist();
    }
    this.movingEdgeId = null;
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
    // Every mutation funnels through here, so this is the single place the
    // "changed since the last save" flag needs to be set.
    this.dirty = true;
  }

  /** Brief confirmation of an action that leaves no visible trace of itself. */
  private async showToast(message: string, color: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 1800,
      color,
      position: 'bottom',
      cssClass: 'app-toast'
    });
    toast.present();
  }
}
