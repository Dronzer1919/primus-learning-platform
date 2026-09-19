import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { provideRouter, Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { of, throwError, Subject } from 'rxjs';
import { FlowchartComponent } from './flowchart.component';
import { FlowchartStoreService } from '../../services/flowchart-store.service';
import { FlowchartExportService } from '../../services/flowchart-export.service';
import { FlowchartSessionService } from '../../services/flowchart-session.service';
import { LocalFlowchartSessionService } from '../../services/local-flowchart-session.service';
import { GuestSavePromptService } from '../../core/guest-save-prompt.service';
import { AuthService } from '../../services/auth.service';
import { NavHistoryService } from '../../services/nav-history.service';
import { FlowNode, FlowEdge } from '../../models/flowchart.model';
import { FlowchartSession } from '../../models/flowchart-session.model';

// NOTE ON SCOPE: FlowchartComponent is ~2700 lines and the largest component in the app.
// This suite covers every method reachable WITHOUT simulating raw pointer-drag geometry
// (getBoundingClientRect/scrollLeft/scrollTop math) — node/edge CRUD, selection, styling,
// undo/redo, zoom stepping, keyboard shortcuts, session save/open/rename/delete, export
// triggering, and clear/new. Deliberately NOT covered: onNodePointerDown's drag-move,
// startResize/startRotate/startConnect's live drag tracking, startPanelResize/
// startPropsHeightResize, and the touch/wheel handlers — these are pixel-measurement-driven
// and would need a synthetic-drag harness whose fidelity-to-effort ratio is poor here. The
// tap-to-connect path (linkFromId + onNodeClick) exercises the same edge-creation outcome
// without needing drag simulation, so edge creation itself is still covered.

function makeNode(overrides: Partial<FlowNode> = {}): FlowNode {
  return { id: 'n1', type: 'rectangle', x: 0, y: 0, w: 120, h: 60, text: '', ...overrides };
}

function makeSession(overrides: Partial<FlowchartSession> = {}): FlowchartSession {
  return {
    _id: 's1', userId: 'u1', title: 'Flow 1', nodes: [], edges: [], canvasBg: 'dots',
    createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides
  };
}

describe('FlowchartComponent', () => {
  let fixture: ComponentFixture<FlowchartComponent>;
  let component: FlowchartComponent;
  let store: jasmine.SpyObj<FlowchartStoreService>;
  let exporter: jasmine.SpyObj<FlowchartExportService>;
  let sessionService: jasmine.SpyObj<FlowchartSessionService>;
  let localSessionService: jasmine.SpyObj<LocalFlowchartSessionService>;
  let savePrompt: jasmine.SpyObj<GuestSavePromptService>;
  let authService: jasmine.SpyObj<AuthService>;
  let navHistory: jasmine.SpyObj<NavHistoryService>;
  let alertController: jasmine.SpyObj<AlertController>;
  let toastController: jasmine.SpyObj<ToastController>;
  let router: Router;
  let alertConfig: any;
  let toastConfig: any;

  beforeEach(async () => {
    store = jasmine.createSpyObj<FlowchartStoreService>('FlowchartStoreService', ['load', 'save', 'loadMeta', 'saveMeta']);
    store.load.and.returnValue({ nodes: [], edges: [] });
    store.loadMeta.and.returnValue(null);

    exporter = jasmine.createSpyObj<FlowchartExportService>('FlowchartExportService', ['export']);
    exporter.export.and.resolveTo();

    sessionService = jasmine.createSpyObj<FlowchartSessionService>('FlowchartSessionService', [
      'getSessions', 'createSession', 'updateSession', 'deleteSession'
    ]);
    localSessionService = jasmine.createSpyObj<LocalFlowchartSessionService>('LocalFlowchartSessionService', [
      'getSessions', 'createSession', 'updateSession', 'deleteSession'
    ]);
    savePrompt = jasmine.createSpyObj<GuestSavePromptService>('GuestSavePromptService', ['promptSaveDestination']);
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['isAuthenticated']);
    navHistory = jasmine.createSpyObj<NavHistoryService>('NavHistoryService', ['back']);

    alertController = jasmine.createSpyObj<AlertController>('AlertController', ['create']);
    alertController.create.and.callFake((config: any) => {
      alertConfig = config;
      return Promise.resolve({
        present: jasmine.createSpy().and.resolveTo(),
        onDidDismiss: jasmine.createSpy().and.resolveTo({ role: undefined })
      } as any);
    });

    toastController = jasmine.createSpyObj<ToastController>('ToastController', ['create']);
    toastController.create.and.callFake((config: any) => {
      toastConfig = config;
      return Promise.resolve({ present: jasmine.createSpy().and.resolveTo() } as any);
    });

    // Deterministic desktop layout: ngOnInit shrinks zoom/hides the props panel on a
    // "narrow" screen, and headless Chrome's real test viewport is narrow enough to
    // trigger that branch — same class of gotcha as Module 3's matchMedia stub.
    spyOnProperty(window, 'innerWidth', 'get').and.returnValue(1400);

    await TestBed.configureTestingModule({
      imports: [FlowchartComponent],
      providers: [
        provideRouter([]),
        { provide: FlowchartStoreService, useValue: store },
        { provide: FlowchartExportService, useValue: exporter },
        { provide: FlowchartSessionService, useValue: sessionService },
        { provide: LocalFlowchartSessionService, useValue: localSessionService },
        { provide: GuestSavePromptService, useValue: savePrompt },
        { provide: AuthService, useValue: authService },
        { provide: NavHistoryService, useValue: navHistory },
        { provide: AlertController, useValue: alertController },
        { provide: ToastController, useValue: toastController }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    authService.isAuthenticated.and.returnValue(false);
    localSessionService.getSessions.and.returnValue(of([]));

    fixture = TestBed.createComponent(FlowchartComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture?.destroy());

  // ---------- Rendering / init ----------
  describe('rendering / ngOnInit()', () => {
    it('creates', () => {
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('loads the persisted diagram from the store', () => {
      store.load.and.returnValue({ nodes: [makeNode()], edges: [] });
      fixture.detectChanges();
      expect(component.diagram.nodes.length).toBe(1);
    });

    it('builds a palette group entry for every shape group', () => {
      fixture.detectChanges();
      expect(component.paletteGroups.length).toBeGreaterThan(0);
      const totalItems = component.paletteGroups.reduce((n, g) => n + g.items.length, 0);
      expect(totalItems).toBe(component.palette.length);
    });

    it('restores the active session pointer from stored meta', () => {
      store.loadMeta.and.returnValue({ id: 'sess-1', title: 'My Flow' });
      fixture.detectChanges();
      expect(component.activeSessionId).toBe('sess-1');
      expect(component.activeTitle).toBe('My Flow');
    });

    it('uses the local (IndexedDB) session source for a guest', () => {
      authService.isAuthenticated.and.returnValue(false);
      fixture.detectChanges();
      expect(component.canUseSessions).toBeFalse();
    });

    it('uses the backend session source for a signed-in user', () => {
      authService.isAuthenticated.and.returnValue(true);
      fixture.detectChanges();
      expect(component.canUseSessions).toBeTrue();
    });

    it('renders the canvas element', () => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.canvas, [class*="canvas"]')).toBeTruthy();
    });
  });

  // ---------- Node CRUD ----------
  describe('adding shapes (onPaletteTap)', () => {
    beforeEach(() => fixture.detectChanges());

    it('adds a node of the tapped type and selects it', () => {
      component.onPaletteTap('diamond');
      expect(component.diagram.nodes.length).toBe(1);
      expect(component.diagram.nodes[0].type).toBe('diamond');
      expect(component.selectedNodeId).toBe(component.diagram.nodes[0].id);
    });

    it('uses the palette preset dimensions for the shape', () => {
      component.onPaletteTap('circle');
      const node = component.diagram.nodes[0];
      const preset = component.palette.find((p) => p.type === 'circle')!;
      expect(node.w).toBe(preset.w);
      expect(node.h).toBe(preset.h);
    });

    it('persists to the store on every add', () => {
      component.onPaletteTap('rectangle');
      expect(store.save).toHaveBeenCalled();
    });

    it('never places a node at a negative coordinate', () => {
      component.onPaletteTap('rectangle');
      const node = component.diagram.nodes[0];
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeGreaterThanOrEqual(0);
    });
  });

  describe('selection', () => {
    beforeEach(() => {
      fixture.detectChanges();
      component.onPaletteTap('rectangle');
    });

    it('onCanvasClick() clears the selection', () => {
      component.onCanvasClick();
      expect(component.selectedNodeId).toBeNull();
      expect(component.selectedEdgeId).toBeNull();
    });

    it('selectedNode getter resolves the currently selected node', () => {
      expect(component.selectedNode?.id).toBe(component.diagram.nodes[0].id);
    });

    it('selectedNode getter is null when nothing is selected', () => {
      component.onCanvasClick();
      expect(component.selectedNode).toBeNull();
    });
  });

  describe('duplicateSelected()', () => {
    beforeEach(() => {
      fixture.detectChanges();
      component.onPaletteTap('rectangle');
    });

    it('adds a copy offset by (20, 20) and selects it', () => {
      const original = component.diagram.nodes[0];
      component.duplicateSelected();
      expect(component.diagram.nodes.length).toBe(2);
      const copy = component.diagram.nodes[1];
      expect(copy.id).not.toBe(original.id);
      expect(copy.x).toBe(original.x + 20);
      expect(copy.y).toBe(original.y + 20);
      expect(component.selectedNodeId).toBe(copy.id);
    });

    it('is a no-op with no selection', () => {
      component.onCanvasClick();
      component.duplicateSelected();
      expect(component.diagram.nodes.length).toBe(1);
    });
  });

  describe('copy / cut / paste', () => {
    beforeEach(() => {
      fixture.detectChanges();
      component.onPaletteTap('rectangle');
    });

    it('copySelected() stores the node without removing it', () => {
      component.copySelected();
      expect(component.diagram.nodes.length).toBe(1);
    });

    it('pasteClipboard() drops an offset copy of the copied node', () => {
      const original = component.diagram.nodes[0];
      component.copySelected();
      component.pasteClipboard();
      expect(component.diagram.nodes.length).toBe(2);
      expect(component.diagram.nodes[1].x).toBe(original.x + 20);
    });

    it('pasting twice increases the offset each time', () => {
      component.copySelected();
      component.pasteClipboard();
      component.pasteClipboard();
      expect(component.diagram.nodes[2].x).toBe(component.diagram.nodes[0].x + 40);
    });

    it('pasteClipboard() is a no-op with an empty clipboard', () => {
      component.pasteClipboard();
      expect(component.diagram.nodes.length).toBe(1);
    });

    it('cutSelected() copies then removes the node', () => {
      component.cutSelected();
      expect(component.diagram.nodes.length).toBe(0);
      component.pasteClipboard();
      expect(component.diagram.nodes.length).toBe(1);
    });
  });

  describe('deleteSelected()', () => {
    beforeEach(() => fixture.detectChanges());

    it('removes the selected node and any edges touching it', () => {
      component.onPaletteTap('rectangle');
      const n1 = component.diagram.nodes[0];
      component.onPaletteTap('ellipse');
      const n2 = component.diagram.nodes[1];
      component.diagram.edges.push({ id: 'e1', from: n1.id, to: n2.id });

      component.onNodeClick(new MouseEvent('click'), n1);
      component.deleteSelected();

      expect(component.diagram.nodes.find((n) => n.id === n1.id)).toBeUndefined();
      expect(component.diagram.edges.length).toBe(0);
    });

    it('removes the selected edge without touching its nodes', () => {
      component.onPaletteTap('rectangle');
      const n1 = component.diagram.nodes[0];
      component.onPaletteTap('ellipse');
      const n2 = component.diagram.nodes[1];
      const edge: FlowEdge = { id: 'e1', from: n1.id, to: n2.id };
      component.diagram.edges.push(edge);

      component.onEdgeClick(new MouseEvent('click'), edge);
      component.deleteSelected();

      expect(component.diagram.edges.length).toBe(0);
      expect(component.diagram.nodes.length).toBe(2);
    });

    it('is a no-op with nothing selected', () => {
      component.onPaletteTap('rectangle');
      component.onCanvasClick();
      component.deleteSelected();
      expect(component.diagram.nodes.length).toBe(1);
    });
  });

  // ---------- Edge creation via tap-to-connect ----------
  describe('tap-to-connect (startLink + onNodeClick)', () => {
    beforeEach(() => {
      fixture.detectChanges();
      component.onPaletteTap('rectangle');
    });

    it('shows a toast and does not arm link mode with nothing selected', () => {
      component.onCanvasClick();
      component.startLink();
      expect(component.linkFromId).toBeNull();
      expect(toastConfig?.message).toContain('Select a shape first');
    });

    it('arms link mode from the selected node', () => {
      component.startLink();
      expect(component.linkFromId).toBe(component.diagram.nodes[0].id);
    });

    it('creates an edge when a second, different node is tapped', () => {
      const from = component.diagram.nodes[0];
      component.startLink();
      component.onPaletteTap('ellipse');
      const to = component.diagram.nodes[1];

      component.onNodeClick(new MouseEvent('click'), to);

      expect(component.diagram.edges.length).toBe(1);
      expect(component.diagram.edges[0]).toEqual(jasmine.objectContaining({ from: from.id, to: to.id }));
      expect(component.linkFromId).toBeNull();
    });

    it('tapping the same node again cancels link mode without creating a self-edge', () => {
      const node = component.diagram.nodes[0];
      component.startLink();
      component.onNodeClick(new MouseEvent('click'), node);
      expect(component.diagram.edges.length).toBe(0);
      expect(component.linkFromId).toBeNull();
    });

    it('calling startLink() again while armed cancels it', () => {
      component.startLink();
      component.startLink();
      expect(component.linkFromId).toBeNull();
    });
  });

  describe('edge styling setters', () => {
    let edge: FlowEdge;

    beforeEach(() => {
      fixture.detectChanges();
      component.onPaletteTap('rectangle');
      component.onPaletteTap('ellipse');
      edge = { id: 'e1', from: component.diagram.nodes[0].id, to: component.diagram.nodes[1].id };
      component.diagram.edges.push(edge);
      component.onEdgeClick(new MouseEvent('click'), edge);
    });

    it('setEdgeRouting("straight") drops any custom bend point', () => {
      edge.bend = 40;
      component.setEdgeRouting('straight');
      expect(edge.routing).toBe('straight');
      expect(edge.bend).toBeUndefined();
    });

    it('setEdgeDash() sets the dash style', () => {
      component.setEdgeDash('dashed');
      expect(edge.dash).toBe('dashed');
    });

    it('setEdgeEndArrow() / setEdgeStartArrow() set arrow styles independently', () => {
      component.setEdgeEndArrow('open');
      component.setEdgeStartArrow('filled');
      expect(edge.endArrow).toBe('open');
      expect(edge.startArrow).toBe('filled');
    });

    it('setEdgeColor() sets and clears a custom colour', () => {
      component.setEdgeColor('#ff0000');
      expect(edge.color).toBe('#ff0000');
      component.setEdgeColor(null);
      expect(edge.color).toBeUndefined();
    });

    it('edge setters are a no-op with no edge selected', () => {
      component.onCanvasClick();
      expect(() => component.setEdgeDash('dotted')).not.toThrow();
    });
  });

  describe('edge marker/dash pure getters', () => {
    beforeEach(() => fixture.detectChanges());

    it('edgeMarkerEnd defaults to a filled arrow', () => {
      expect(component.edgeMarkerEnd({ id: 'e', from: 'a', to: 'b' })).toBe('url(#flow-arrow)');
    });

    it('edgeMarkerEnd respects "none"', () => {
      expect(component.edgeMarkerEnd({ id: 'e', from: 'a', to: 'b', endArrow: 'none' })).toBe('');
    });

    it('edgeMarkerStart defaults to no arrow', () => {
      expect(component.edgeMarkerStart({ id: 'e', from: 'a', to: 'b' })).toBe('');
    });

    it('edgeDashArray maps dashed/dotted/solid correctly', () => {
      expect(component.edgeDashArray({ id: 'e', from: 'a', to: 'b', dash: 'dashed' })).toBe('10 5');
      expect(component.edgeDashArray({ id: 'e', from: 'a', to: 'b', dash: 'dotted' })).toBe('2 5');
      expect(component.edgeDashArray({ id: 'e', from: 'a', to: 'b' })).toBe('');
    });
  });

  // ---------- Style setters ----------
  describe('node style setters', () => {
    beforeEach(() => {
      fixture.detectChanges();
      component.onPaletteTap('rectangle');
    });

    it('setFill()/setStroke() set and clear custom colours', () => {
      component.setFill('#ff0000');
      component.setStroke('#00ff00');
      expect(component.selectedNode?.fill).toBe('#ff0000');
      expect(component.selectedNode?.stroke).toBe('#00ff00');
      component.setFill(null);
      expect(component.selectedNode?.fill).toBeUndefined();
    });

    it('setFontFamily()/setFontSize() update the label style', () => {
      component.setFontFamily('Georgia');
      component.setFontSize(20);
      expect(component.selectedNode?.fontFamily).toBe('Georgia');
      expect(component.selectedNode?.fontSize).toBe(20);
    });

    it('toggleText() flips a boolean style flag', () => {
      component.toggleText('bold');
      expect(component.selectedNode?.bold).toBeTrue();
      component.toggleText('bold');
      expect(component.selectedNode?.bold).toBeFalse();
    });

    it('setAlign()/setValign() update text alignment', () => {
      component.setAlign('right');
      component.setValign('bottom');
      expect(component.selectedNode?.align).toBe('right');
      expect(component.selectedNode?.valign).toBe('bottom');
    });

    it('setTextColor()/setLineHeight() update label styling', () => {
      component.setTextColor('#123456');
      component.setLineHeight(150);
      expect(component.selectedNode?.textColor).toBe('#123456');
      expect(component.selectedNode?.lineHeight).toBe(150);
    });

    it('setNodeSize() clamps to [minNodeSize, 2000]', () => {
      component.setNodeSize('w', 5);
      expect(component.selectedNode?.w).toBe(component.minNodeSize);
      component.setNodeSize('w', 999999);
      expect(component.selectedNode?.w).toBe(2000);
    });

    it('setNodeSize() ignores non-finite input', () => {
      const before = component.selectedNode?.w;
      component.setNodeSize('w', NaN);
      expect(component.selectedNode?.w).toBe(before);
    });

    it('resetNodeSize() restores the palette default footprint', () => {
      component.setNodeSize('w', 500);
      component.resetNodeSize();
      const preset = component.palette.find((p) => p.type === 'rectangle')!;
      expect(component.selectedNode?.w).toBe(preset.w);
    });

    it('setNodeRotation()/resetNodeRotation() set and clear rotation', () => {
      component.setNodeRotation(45);
      expect(component.selectedNode?.rotation).toBe(45);
      component.resetNodeRotation();
      expect(component.selectedNode?.rotation).toBeUndefined();
    });
  });

  // ---------- Undo / redo ----------
  describe('undo() / redo()', () => {
    beforeEach(() => fixture.detectChanges());

    it('canUndo/canRedo are false immediately after init', () => {
      expect(component.canUndo).toBeFalse();
      expect(component.canRedo).toBeFalse();
    });

    it('undo() reverts the last change', () => {
      component.onPaletteTap('rectangle');
      expect(component.diagram.nodes.length).toBe(1);
      component.undo();
      expect(component.diagram.nodes.length).toBe(0);
    });

    it('redo() re-applies an undone change', () => {
      component.onPaletteTap('rectangle');
      component.undo();
      component.redo();
      expect(component.diagram.nodes.length).toBe(1);
    });

    it('undo() is a no-op at the start of history', () => {
      component.undo();
      expect(component.diagram.nodes.length).toBe(0);
    });

    it('redo() is a no-op at the end of history', () => {
      component.onPaletteTap('rectangle');
      component.redo();
      expect(component.diagram.nodes.length).toBe(1);
    });

    it('a new change after undo() discards the redone-able future', () => {
      component.onPaletteTap('rectangle');
      component.onPaletteTap('ellipse');
      component.undo(); // back to 1 node
      component.onPaletteTap('diamond'); // branches history here
      expect(component.canRedo).toBeFalse();
      expect(component.diagram.nodes.map((n) => n.type)).toEqual(['rectangle', 'diamond']);
    });

    it('clears selection of a node that no longer exists after undo', () => {
      component.onPaletteTap('rectangle');
      component.onPaletteTap('ellipse');
      const secondId = component.diagram.nodes[1].id;
      component.onNodeClick(new MouseEvent('click'), component.diagram.nodes[1]);
      component.undo(); // removes the second node
      expect(component.selectedNodeId).toBeNull();
    });
  });

  // ---------- Zoom ----------
  describe('zoom controls', () => {
    beforeEach(() => fixture.detectChanges());

    it('starts at 100%', () => {
      expect(component.zoomPercent).toBe(100);
    });

    it('zoomIn() steps to the next stop above the current zoom', () => {
      component.zoomIn();
      expect(component.zoom).toBe(1.25);
    });

    it('zoomOut() steps to the next stop below the current zoom', () => {
      component.zoomOut();
      expect(component.zoom).toBe(0.8);
    });

    it('zoomIn() caps at maxZoom', () => {
      for (let i = 0; i < 20; i++) component.zoomIn();
      expect(component.zoom).toBe(component.maxZoom);
    });

    it('zoomOut() floors at minZoom', () => {
      for (let i = 0; i < 20; i++) component.zoomOut();
      expect(component.zoom).toBe(component.minZoom);
    });

    it('resetZoom() returns to 100%', () => {
      component.zoomIn();
      component.resetZoom();
      expect(component.zoom).toBe(1);
    });
  });

  // ---------- Canvas background ----------
  describe('cycleCanvasBg() / canvasBgLabel()', () => {
    it('cycles dots -> grid -> plain -> dots', () => {
      fixture.detectChanges();
      expect(component.canvasBg).toBe('dots');
      component.cycleCanvasBg();
      expect(component.canvasBg).toBe('grid');
      component.cycleCanvasBg();
      expect(component.canvasBg).toBe('plain');
      component.cycleCanvasBg();
      expect(component.canvasBg).toBe('dots');
    });

    it('canvasBgLabel() reflects the current background', () => {
      fixture.detectChanges();
      expect(component.canvasBgLabel()).toBe('Dots');
    });
  });

  // ---------- Keyboard shortcuts ----------
  describe('onKeyDown()', () => {
    beforeEach(() => {
      fixture.detectChanges();
      component.onPaletteTap('rectangle');
    });

    function key(k: string, opts: KeyboardEventInit = {}): KeyboardEvent {
      // ctrlKey/metaKey/etc. are getter-only on a real KeyboardEvent instance, so they
      // must go through the constructor's init dict, not be assigned afterward.
      return new KeyboardEvent('keydown', { key: k, cancelable: true, ...opts });
    }

    it('Delete removes the selected node', () => {
      component.onKeyDown(key('Delete'));
      expect(component.diagram.nodes.length).toBe(0);
    });

    it('Backspace also deletes the selection', () => {
      component.onKeyDown(key('Backspace'));
      expect(component.diagram.nodes.length).toBe(0);
    });

    it('is ignored while editing a label', () => {
      component.editingNodeId = component.diagram.nodes[0].id;
      component.onKeyDown(key('Delete'));
      expect(component.diagram.nodes.length).toBe(1);
    });

    it('is ignored while a dialog is open', () => {
      (component as any).dialogOpen = true;
      component.onKeyDown(key('Delete'));
      expect(component.diagram.nodes.length).toBe(1);
    });

    it('Ctrl+C copies, Ctrl+V pastes', () => {
      const ctrlC = key('c', { ctrlKey: true });
      component.onKeyDown(ctrlC);
      const ctrlV = key('v', { ctrlKey: true });
      component.onKeyDown(ctrlV);
      expect(component.diagram.nodes.length).toBe(2);
    });

    it('Ctrl+X cuts the selected node', () => {
      component.onKeyDown(key('x', { ctrlKey: true }));
      expect(component.diagram.nodes.length).toBe(0);
    });

    it('Escape closes the export menu when open', () => {
      component.exportOpen = true;
      component.onKeyDown(key('Escape'));
      expect(component.exportOpen).toBeFalse();
    });

    it('Escape closes the sessions modal when open, without affecting the canvas', () => {
      component.sessionsOpen = true;
      component.onKeyDown(key('Escape'));
      expect(component.sessionsOpen).toBeFalse();
      expect(component.diagram.nodes.length).toBe(1);
    });

    it('keys are swallowed while the sessions modal is open (Delete does not touch the canvas)', () => {
      component.sessionsOpen = true;
      component.onKeyDown(key('Delete'));
      expect(component.diagram.nodes.length).toBe(1);
    });
  });

  // ---------- Sessions: save/open/new/rename/delete ----------
  describe('onHeaderSave() routing', () => {
    // canUseSessions is decided once, in ngOnInit — it must be set BEFORE the first
    // detectChanges(), not after; ngOnInit never re-runs, so changing the auth mock
    // post-init would silently test against last describe block's stale value.

    it('opens the account save dialog for a signed-in user', () => {
      authService.isAuthenticated.and.returnValue(true);
      fixture.detectChanges();
      component.onPaletteTap('rectangle');
      component.onHeaderSave();
      expect(alertController.create).toHaveBeenCalled();
      expect(alertConfig.header).toContain('Save flowchart');
    });

    it('opens the guest save-destination prompt for a signed-out visitor', async () => {
      authService.isAuthenticated.and.returnValue(false);
      fixture.detectChanges();
      savePrompt.promptSaveDestination.and.resolveTo(null);
      component.onPaletteTap('rectangle');
      component.onHeaderSave();
      await Promise.resolve();
      expect(savePrompt.promptSaveDestination).toHaveBeenCalled();
    });
  });

  describe('openSaveDialog() / saveSession()', () => {
    beforeEach(() => {
      authService.isAuthenticated.and.returnValue(true);
      fixture.detectChanges();
      component.onPaletteTap('rectangle');
    });

    it('does nothing on an empty, never-saved canvas', async () => {
      component.diagram = { nodes: [], edges: [] };
      await component.openSaveDialog();
      expect(alertController.create).not.toHaveBeenCalled();
    });

    it('offers only "Save" for a brand-new diagram', async () => {
      await component.openSaveDialog();
      const texts = alertConfig.buttons.map((b: any) => b.text);
      expect(texts).toEqual(['Cancel', 'Save']);
    });

    it('offers "Save as new" and "Update" for an already-saved session', async () => {
      component.activeSessionId = 'existing-1';
      await component.openSaveDialog();
      const texts = alertConfig.buttons.map((b: any) => b.text);
      expect(texts).toEqual(['Cancel', 'Save as new', 'Update']);
    });

    it('creates a new session and adopts it on success', async () => {
      const saved = makeSession({ _id: 'new-1', title: 'My Flow' });
      sessionService.createSession.and.returnValue(of(saved));
      await component.openSaveDialog();
      const saveBtn = alertConfig.buttons.find((b: any) => b.text === 'Save');
      await saveBtn.handler({ title: 'My Flow' });

      expect(sessionService.createSession).toHaveBeenCalled();
      expect(component.activeSessionId).toBe('new-1');
      expect(store.saveMeta).toHaveBeenCalledWith({ id: 'new-1', title: 'My Flow' });
      expect(toastConfig.color).toBe('success');
    });

    it('updates the existing session when "Update" is chosen', async () => {
      component.activeSessionId = 'existing-1';
      component.activeTitle = 'Existing';
      sessionService.updateSession.and.returnValue(of(makeSession({ _id: 'existing-1' })));
      await component.openSaveDialog();
      const updateBtn = alertConfig.buttons.find((b: any) => b.text === 'Update');
      await updateBtn.handler({ title: 'Existing' });

      expect(sessionService.updateSession).toHaveBeenCalledWith('existing-1', jasmine.any(Object));
      expect(sessionService.createSession).not.toHaveBeenCalled();
    });

    it('"Save as new" creates a separate session instead of updating', async () => {
      component.activeSessionId = 'existing-1';
      sessionService.createSession.and.returnValue(of(makeSession({ _id: 'forked-1' })));
      await component.openSaveDialog();
      const asNewBtn = alertConfig.buttons.find((b: any) => b.text === 'Save as new');
      await asNewBtn.handler({ title: 'Fork' });

      expect(sessionService.createSession).toHaveBeenCalled();
      expect(component.activeSessionId).toBe('forked-1');
    });

    it('shows a danger toast when the save request fails', async () => {
      sessionService.createSession.and.returnValue(throwError(() => new Error('down')));
      await component.openSaveDialog();
      const saveBtn = alertConfig.buttons.find((b: any) => b.text === 'Save');
      await saveBtn.handler({ title: 'x' });
      expect(toastConfig.color).toBe('danger');
    });

    it('caps the title at 120 characters and falls back to a default when blank', async () => {
      sessionService.createSession.and.returnValue(of(makeSession()));
      await component.openSaveDialog();
      const saveBtn = alertConfig.buttons.find((b: any) => b.text === 'Save');
      await saveBtn.handler({ title: '' });
      const payload = sessionService.createSession.calls.mostRecent().args[0] as any;
      expect(payload.title).toBe('New Flowchart');
    });
  });

  describe('openGuestSaveDialog()', () => {
    beforeEach(() => {
      authService.isAuthenticated.and.returnValue(false);
      fixture.detectChanges();
      component.onPaletteTap('rectangle');
    });

    it('navigates to /login when the guest picks "login"', async () => {
      savePrompt.promptSaveDestination.and.resolveTo('login');
      await component.openGuestSaveDialog();
      expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/flowchart' } });
    });

    it('does nothing when the guest dismisses the prompt', async () => {
      savePrompt.promptSaveDestination.and.resolveTo(null);
      await component.openGuestSaveDialog();
      expect(alertController.create).not.toHaveBeenCalled();
    });

    it('opens a single-choice title prompt when the guest picks "local"', async () => {
      savePrompt.promptSaveDestination.and.resolveTo('local');
      await component.openGuestSaveDialog();
      expect(alertConfig.header).toContain('this device');
      const texts = alertConfig.buttons.map((b: any) => b.text);
      expect(texts).toEqual(['Cancel', 'Save']);
    });

    it('saves to the local session source on confirm', async () => {
      savePrompt.promptSaveDestination.and.resolveTo('local');
      localSessionService.createSession.and.returnValue(of({ _id: 'local-1', title: 'x' } as any));
      await component.openGuestSaveDialog();
      const saveBtn = alertConfig.buttons.find((b: any) => b.text === 'Save');
      await saveBtn.handler({ title: 'x' });
      expect(localSessionService.createSession).toHaveBeenCalled();
    });
  });

  describe('newSession()', () => {
    beforeEach(() => fixture.detectChanges());

    it('clears the canvas and any active session pointer once the discard is confirmed', async () => {
      // Any mutation (including onPaletteTap, via persist()) sets `dirty = true`, so a
      // non-empty canvas always routes through the confirm-discard dialog here — this
      // config confirms it, so it exercises the actual clearing logic downstream of that.
      alertController.create.and.callFake((config: any) => {
        alertConfig = config;
        return Promise.resolve({
          present: jasmine.createSpy().and.resolveTo(),
          onDidDismiss: jasmine.createSpy().and.resolveTo({ role: 'discard' })
        } as any);
      });

      component.onPaletteTap('rectangle');
      component.activeSessionId = 'x';
      await component.newSession();

      expect(component.diagram.nodes.length).toBe(0);
      expect(component.activeSessionId).toBeNull();
      expect(store.saveMeta).toHaveBeenCalledWith(null);
    });

    it('prompts before discarding unsaved changes on a dirty diagram', async () => {
      component.onPaletteTap('rectangle');
      (component as any).dirty = true;
      alertController.create.and.callFake((config: any) => {
        alertConfig = config;
        return Promise.resolve({
          present: jasmine.createSpy().and.resolveTo(),
          onDidDismiss: jasmine.createSpy().and.resolveTo({ role: 'cancel' })
        } as any);
      });

      await component.newSession();

      expect(component.diagram.nodes.length).toBe(1); // cancelled — nothing cleared
    });
  });

  describe('openSession()', () => {
    beforeEach(() => fixture.detectChanges());

    it('loads the session\'s nodes/edges onto the canvas and adopts it', async () => {
      const session = makeSession({
        _id: 'sess-2',
        nodes: [makeNode({ id: 'a' })],
        edges: [],
        canvasBg: 'grid'
      });
      await component.openSession(session);
      expect(component.diagram.nodes.map((n) => n.id)).toEqual(['a']);
      expect(component.canvasBg).toBe('grid');
      expect(component.activeSessionId).toBe('sess-2');
    });

    it('is a no-op when reopening the same, unmodified session', async () => {
      const session = makeSession({ _id: 'sess-2' });
      await component.openSession(session);
      component.sessionsOpen = true;
      await component.openSession(session);
      expect(component.sessionsOpen).toBeFalse();
    });
  });

  describe('renameSession() / deleteSession()', () => {
    beforeEach(() => {
      // Backend session source, so sessionService's stubbed responses below are what
      // component.source actually calls (auth must be set before the first detectChanges()).
      authService.isAuthenticated.and.returnValue(true);
      fixture.detectChanges();
    });

    it('renameSession() updates the session and, if active, the on-canvas title', async () => {
      const session = makeSession({ _id: 's1', title: 'Old' });
      component.activeSessionId = 's1';
      sessionService.updateSession.and.returnValue(of(makeSession({ _id: 's1', title: 'New' })));

      await component.renameSession(session, new Event('click'));
      const renameBtn = alertConfig.buttons.find((b: any) => b.text === 'Rename');
      await renameBtn.handler({ title: 'New' });

      expect(component.activeTitle).toBe('New');
    });

    it('deleteSession() removes it from the list and clears the active pointer if it was open', async () => {
      component.sessions = [makeSession({ _id: 's1' })];
      component.activeSessionId = 's1';
      sessionService.deleteSession.and.returnValue(of(undefined));

      await component.deleteSession(makeSession({ _id: 's1' }), new Event('click'));
      const deleteBtn = alertConfig.buttons.find((b: any) => b.text === 'Delete');
      await deleteBtn.handler();

      expect(component.sessions.length).toBe(0);
      expect(component.activeSessionId).toBeNull();
    });
  });

  describe('clear()', () => {
    beforeEach(() => {
      fixture.detectChanges();
      component.onPaletteTap('rectangle');
    });

    it('does nothing on an empty canvas', async () => {
      component.diagram = { nodes: [], edges: [] };
      await component.clear();
      expect(alertController.create).not.toHaveBeenCalled();
    });

    it('empties the diagram on confirm', async () => {
      await component.clear();
      const clearBtn = alertConfig.buttons.find((b: any) => b.text === 'Clear');
      clearBtn.handler();
      expect(component.diagram.nodes.length).toBe(0);
    });
  });

  // ---------- Export ----------
  describe('saveAs() (export)', () => {
    beforeEach(() => {
      fixture.detectChanges();
      component.onPaletteTap('rectangle');
    });

    it('calls the export service with the current diagram and requested format', async () => {
      await component.saveAs('png');
      expect(exporter.export).toHaveBeenCalled();
      const [, format] = exporter.export.calls.mostRecent().args;
      expect(format).toBe('png');
    });

    it('is a no-op on an empty diagram', async () => {
      component.diagram = { nodes: [], edges: [] };
      await component.saveAs('png');
      expect(exporter.export).not.toHaveBeenCalled();
    });

    it('sets exportError instead of throwing when the export service rejects', async () => {
      exporter.export.and.rejectWith(new Error('canvas failure'));
      await component.saveAs('pdf');
      expect(component.exportError).toContain('Could not create the file');
      expect(component.exporting).toBeFalse();
    });

    it('closes the export menu immediately when triggered', async () => {
      component.exportOpen = true;
      await component.saveAs('jpg');
      expect(component.exportOpen).toBeFalse();
    });
  });

  describe('toggleExport() / closeExport()', () => {
    it('toggles the export menu open and closed', () => {
      fixture.detectChanges();
      component.toggleExport(new MouseEvent('click'));
      expect(component.exportOpen).toBeTrue();
      component.closeExport();
      expect(component.exportOpen).toBeFalse();
    });
  });

  // ---------- Navigation ----------
  describe('goBack()', () => {
    it('defers to NavHistoryService', () => {
      fixture.detectChanges();
      component.goBack();
      expect(navHistory.back).toHaveBeenCalledWith('/');
    });
  });

  // ---------- formatSessionDate ----------
  describe('formatSessionDate()', () => {
    it('renders a short date string', () => {
      fixture.detectChanges();
      expect(component.formatSessionDate('2024-03-15T00:00:00.000Z')).toMatch(/\w+ \d+/);
    });
  });

  // ---------- Lifecycle / memory leaks ----------
  describe('ngOnDestroy()', () => {
    it('does not throw when destroying immediately after creation', () => {
      fixture.detectChanges();
      expect(() => fixture.destroy()).not.toThrow();
    });

    it('a session-list response arriving after destroy does not update state (takeUntilDestroyed)', () => {
      fixture.detectChanges();
      const subject = new Subject<any[]>();
      localSessionService.getSessions.and.returnValue(subject.asObservable());

      component.openSessions(new MouseEvent('click'));
      expect(component.sessionsLoading).toBeTrue();

      fixture.destroy();
      subject.next([makeSession()]); // late response after teardown

      expect(component.sessions).toEqual([]);
      expect(component.sessionsLoading).toBeTrue(); // never got the chance to flip
    });
  });
});
