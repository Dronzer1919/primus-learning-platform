import { TestBed } from '@angular/core/testing';
import { FlowchartExportService, ExportRequest } from './flowchart-export.service';
import { FlowNode, RenderShape } from '../models/flowchart.model';

function makeNode(overrides: Partial<FlowNode> = {}): FlowNode {
  return { id: 'n1', type: 'rectangle', x: 100, y: 100, w: 120, h: 60, text: '', ...overrides };
}

const colors = { background: 'rgb(255,255,255)', fill: 'rgb(240,240,240)', stroke: 'rgb(17,24,39)', text: 'rgb(17,24,39)' };

function baseRequest(overrides: Partial<ExportRequest> = {}): ExportRequest {
  return {
    nodes: [makeNode()],
    edges: [],
    shapeFor: (): RenderShape => ({ kind: 'rect', rx: 4 }),
    colors,
    fontSize: 13,
    lineHeight: 125,
    ...overrides
  };
}

describe('FlowchartExportService', () => {
  let service: FlowchartExportService;
  let capturedSvg: string;
  let originalImageSrcDescriptor: PropertyDescriptor;
  let clickSpy: jasmine.Spy;
  let createObjectURLSpy: jasmine.Spy;
  let revokeObjectURLSpy: jasmine.Spy;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FlowchartExportService);
    capturedSvg = '';

    // Lets the real Image load (and the real rasterization pipeline run — canvas,
    // toDataURL etc. are all genuine in headless Chrome), while also recording the
    // exact SVG markup passed in, so its content can be asserted directly instead of
    // only "did export() resolve".
    originalImageSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')!;
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      configurable: true,
      get(this: HTMLImageElement) {
        return originalImageSrcDescriptor.get!.call(this);
      },
      set(this: HTMLImageElement, value: string) {
        if (value.startsWith('data:image/svg+xml')) {
          capturedSvg = decodeURIComponent(value.replace(/^data:image\/svg\+xml;charset=utf-8,/, ''));
        }
        originalImageSrcDescriptor.set!.call(this, value);
      }
    });

    // The download click would otherwise be a real (harmless but noisy) browser action.
    clickSpy = spyOn(HTMLAnchorElement.prototype, 'click');

    createObjectURLSpy = spyOn(URL, 'createObjectURL').and.returnValue('blob:mock-url');
    revokeObjectURLSpy = spyOn(URL, 'revokeObjectURL');
  });

  afterEach(() => {
    Object.defineProperty(HTMLImageElement.prototype, 'src', originalImageSrcDescriptor);
  });

  function lastDownloadedAnchor(): HTMLAnchorElement {
    return clickSpy.calls.mostRecent().object as HTMLAnchorElement;
  }

  describe('export() — file output', () => {
    it('downloads a PNG with a data URL and a dated filename', async () => {
      await service.export(baseRequest(), 'png');
      const anchor = lastDownloadedAnchor();
      expect(anchor.href).toMatch(/^data:image\/png/);
      expect(anchor.download).toMatch(/^flowchart-\d{4}-\d{2}-\d{2}\.png$/);
    });

    it('downloads a JPG with a data URL', async () => {
      await service.export(baseRequest(), 'jpg');
      const anchor = lastDownloadedAnchor();
      expect(anchor.href).toMatch(/^data:image\/jpeg/);
      expect(anchor.download).toMatch(/\.jpg$/);
    });

    it('downloads a PDF as a blob URL built from a real Blob', async () => {
      await service.export(baseRequest(), 'pdf');
      const anchor = lastDownloadedAnchor();
      expect(anchor.href).toBe('blob:mock-url');
      expect(anchor.download).toMatch(/\.pdf$/);
      expect(createObjectURLSpy).toHaveBeenCalled();
      const blob = createObjectURLSpy.calls.mostRecent().args[0] as Blob;
      expect(blob.type).toBe('application/pdf');
    });

    it('revokes the PDF object URL shortly after download', async () => {
      jasmine.clock().install();
      try {
        await service.export(baseRequest(), 'pdf');
        jasmine.clock().tick(1000);
        expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
      } finally {
        jasmine.clock().uninstall();
      }
    });

    it('does not throw for an empty diagram (no nodes, no edges)', async () => {
      await expectAsync(service.export(baseRequest({ nodes: [], edges: [] }), 'png')).toBeResolved();
    });
  });

  describe('SVG content', () => {
    it('sizes the viewBox to the node bounds plus padding', async () => {
      await service.export(baseRequest({ nodes: [makeNode({ x: 0, y: 0, w: 100, h: 50 })] }), 'png');
      // bounds: x=-24 y=-24 width=100+48=148 height=50+48=98 (PADDING=24 each side)
      expect(capturedSvg).toContain('viewBox="-24 -24 148 98"');
    });

    it('falls back to a fixed 200x120 box for a completely empty diagram', async () => {
      await service.export(baseRequest({ nodes: [], edges: [] }), 'png');
      expect(capturedSvg).toContain('width="200" height="120"');
    });

    it('paints the background rect with the requested background colour', async () => {
      await service.export(baseRequest({ colors: { ...colors, background: 'rgb(10,20,30)' } }), 'png');
      expect(capturedSvg).toContain('fill="rgb(10,20,30)"');
    });

    it('escapes HTML-significant characters in node text (XSS safety)', async () => {
      await service.export(baseRequest({ nodes: [makeNode({ text: '<script>alert(1)</script>' })] }), 'png');
      expect(capturedSvg).not.toContain('<script>');
      expect(capturedSvg).toContain('&lt;script&gt;');
    });

    it('escapes an ampersand and quotes in node text', async () => {
      await service.export(baseRequest({ nodes: [makeNode({ text: 'Tom & "Jerry"' })] }), 'png');
      expect(capturedSvg).toContain('Tom &amp;');
    });

    it('uses a node\'s custom fill/stroke over the theme default', async () => {
      await service.export(
        baseRequest({ nodes: [makeNode({ fill: '#ff00ff', stroke: '#00ffff' })] }),
        'png'
      );
      expect(capturedSvg).toContain('fill="#ff00ff"');
      expect(capturedSvg).toContain('stroke="#00ffff"');
    });

    it('draws one polyline per edge, using the theme stroke colour', async () => {
      await service.export(
        baseRequest({ nodes: [makeNode({ id: 'a' }), makeNode({ id: 'b', x: 300 })], edges: ['100,130 300,130'] }),
        'png'
      );
      expect(capturedSvg).toContain('<polyline points="100,130 300,130"');
      expect(capturedSvg).toContain(`stroke="${colors.stroke}"`);
    });

    it('defines an arrowhead marker only when there is at least one edge', async () => {
      const withEdge = await captureFor(baseRequest({ edges: ['0,0 10,10'] }));
      const withoutEdge = await captureFor(baseRequest({ edges: [] }));
      expect(withEdge).toContain('<marker');
      expect(withoutEdge).not.toContain('<marker');
    });

    it('applies a rotate transform only when the node has a rotation', async () => {
      const rotated = await captureFor(baseRequest({ nodes: [makeNode({ rotation: 45 })] }));
      const unrotated = await captureFor(baseRequest({ nodes: [makeNode()] }));
      expect(rotated).toContain('rotate(45');
      expect(unrotated).not.toContain('rotate(');
    });

    async function captureFor(request: ExportRequest): Promise<string> {
      await service.export(request, 'png');
      return capturedSvg;
    }
  });
});
