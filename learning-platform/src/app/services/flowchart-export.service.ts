import { Injectable } from '@angular/core';
import { FlowNode, RenderShape, ShapeType } from '../models/flowchart.model';

export type ExportFormat = 'png' | 'jpg' | 'pdf';

/** Everything the exporter needs that only the component knows. */
export interface ExportRequest {
  nodes: FlowNode[];
  /** Edge polylines, already routed — "x,y x,y …" in canvas coordinates. */
  edges: string[];
  /** The component's shape geometry, so exported shapes match the canvas exactly. */
  shapeFor: (type: ShapeType, w: number, h: number) => RenderShape;
  /** Resolved theme colours (concrete rgb() strings, never CSS variables). */
  colors: {
    background: string;
    fill: string;
    stroke: string;
    text: string;
  };
  /** Default label metrics, matching the on-canvas CSS. */
  fontSize: number;
  lineHeight: number;
}

/** Blank margin around the diagram in the exported file, in px. */
const PADDING = 24;
/** Raster scale — 2× keeps text crisp without producing enormous files. */
const SCALE = 2;
/** Browsers refuse canvases beyond a few thousand px per side; stay well under. */
const MAX_PIXELS = 8000;

/**
 * Saves a diagram as a PNG, JPG or PDF.
 *
 * The canvas is a tree of HTML nodes with inline SVG, which the browser cannot
 * rasterise directly, so the diagram is re-drawn from the model as a single
 * standalone SVG and that is painted into a <canvas>. Re-drawing (rather than
 * scraping the DOM) also means selection outlines, connect handles and resize
 * grips never end up in the file.
 *
 * The PDF is written by hand — one page holding one JPEG — to avoid pulling in
 * a PDF library for a single feature.
 */
@Injectable({ providedIn: 'root' })
export class FlowchartExportService {
  async export(request: ExportRequest, format: ExportFormat): Promise<void> {
    const bounds = this.bounds(request);
    const svg = this.buildSvg(request, bounds);
    const scale = Math.min(SCALE, MAX_PIXELS / Math.max(bounds.width, bounds.height));
    const canvas = await this.rasterize(svg, bounds.width, bounds.height, scale, request.colors.background);
    const name = `flowchart-${new Date().toISOString().slice(0, 10)}`;

    if (format === 'png') {
      this.download(canvas.toDataURL('image/png'), `${name}.png`);
      return;
    }
    if (format === 'jpg') {
      this.download(canvas.toDataURL('image/jpeg', 0.92), `${name}.jpg`);
      return;
    }

    const jpeg = this.dataUrlToBytes(canvas.toDataURL('image/jpeg', 0.92));
    const pdf = this.buildPdf(jpeg, canvas.width, canvas.height, bounds.width, bounds.height);
    const url = URL.createObjectURL(pdf);
    this.download(url, `${name}.pdf`);
    // The click is synchronous, so the object URL is safe to release next tick.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // --- Geometry ----------------------------------------------------------

  /** Tight box around every node and edge, plus a margin. */
  private bounds(request: ExportRequest): { x: number; y: number; width: number; height: number } {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const stretch = (x: number, y: number) => {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    };
    for (const node of request.nodes) {
      stretch(node.x, node.y);
      stretch(node.x + node.w, node.y + node.h);
    }
    for (const points of request.edges) {
      for (const pair of points.split(' ')) {
        const [x, y] = pair.split(',').map(Number);
        if (Number.isFinite(x) && Number.isFinite(y)) {
          stretch(x, y);
        }
      }
    }
    if (!Number.isFinite(minX)) {
      return { x: 0, y: 0, width: 200, height: 120 };
    }
    return {
      x: minX - PADDING,
      y: minY - PADDING,
      width: maxX - minX + PADDING * 2,
      height: maxY - minY + PADDING * 2
    };
  }

  // --- SVG ---------------------------------------------------------------

  private buildSvg(
    request: ExportRequest,
    bounds: { x: number; y: number; width: number; height: number }
  ): string {
    // One arrowhead marker per colour in use: SVG markers do not inherit the
    // stroke of the line they sit on, so each colour needs its own definition.
    const markers = new Map<string, string>();
    const markerId = (color: string): string => {
      let id = markers.get(color);
      if (!id) {
        id = `arrow${markers.size}`;
        markers.set(color, id);
      }
      return id;
    };

    const edgeColor = request.colors.stroke;
    const body: string[] = [];

    for (const points of request.edges) {
      body.push(
        `<polyline points="${points}" fill="none" stroke="${edgeColor}" stroke-opacity="0.8" ` +
          `stroke-width="2" stroke-linejoin="round" marker-end="url(#${markerId(edgeColor)})"/>`
      );
    }

    for (const node of request.nodes) {
      const shape = request.shapeFor(node.type, node.w, node.h);
      const fill = node.fill || request.colors.fill;
      const stroke = node.stroke || request.colors.stroke;
      const parts = this.shapeMarkup(shape, node, fill, stroke, markerId);
      const label = this.labelMarkup(node, request);
      const rotate = node.rotation
        ? ` rotate(${this.round(node.rotation)},${this.round(node.w / 2)},${this.round(node.h / 2)})`
        : '';
      body.push(
        `<g transform="translate(${this.round(node.x)},${this.round(node.y)})${rotate}">${parts}${label}</g>`
      );
    }

    const defs = [...markers.entries()]
      .map(
        ([color, id]) =>
          `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" ` +
          `orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${color}"/></marker>`
      )
      .join('');

    return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="${this.round(bounds.width)}" ` +
      `height="${this.round(bounds.height)}" ` +
      `viewBox="${this.round(bounds.x)} ${this.round(bounds.y)} ${this.round(bounds.width)} ${this.round(bounds.height)}">` +
      `<defs>${defs}</defs>` +
      `<rect x="${this.round(bounds.x)}" y="${this.round(bounds.y)}" width="${this.round(bounds.width)}" ` +
      `height="${this.round(bounds.height)}" fill="${request.colors.background}"/>` +
      body.join('') +
      `</svg>`
    );
  }

  /** Mirrors the shape template in the component, one kind at a time. */
  private shapeMarkup(
    shape: RenderShape,
    node: FlowNode,
    fill: string,
    stroke: string,
    markerId: (color: string) => string
  ): string {
    const paint =
      `fill="${shape.noFill ? 'none' : fill}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"`;
    const start = shape.arrowStart ? ` marker-start="url(#${markerId(stroke)})"` : '';
    const end = shape.arrowEnd ? ` marker-end="url(#${markerId(stroke)})"` : '';
    const w = node.w;
    const h = node.h;

    switch (shape.kind) {
      case 'rect':
        return `<rect x="0" y="0" width="${w}" height="${h}" rx="${shape.rx ?? 0}" ${paint}/>`;
      case 'ellipse':
        return `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}" ${paint}/>`;
      case 'polygon':
        return `<polygon points="${shape.points}" ${paint}${start}${end}/>`;
      case 'path':
        return `<path d="${shape.d}" ${paint}${start}${end}/>`;
      case 'line':
        return (
          `<line x1="0" y1="${h / 2}" x2="${w}" y2="${h / 2}" fill="none" stroke="${stroke}" ` +
          `stroke-width="2"${shape.dash ? ` stroke-dasharray="${shape.dash}"` : ''}${start}${end}/>`
        );
      case 'process':
        return (
          `<rect x="0" y="0" width="${w}" height="${h}" ${paint}/>` +
          `<line x1="8" y1="0" x2="8" y2="${h}" stroke="${stroke}" stroke-width="2"/>` +
          `<line x1="${w - 8}" y1="0" x2="${w - 8}" y2="${h}" stroke="${stroke}" stroke-width="2"/>`
        );
      default:
        return '';
    }
  }

  /**
   * The label as <text>/<tspan> lines. HTML wrapping cannot be reused here —
   * <foreignObject> is not rendered when an SVG is rasterised through an
   * <img> — so lines are broken on an average character width instead.
   */
  private labelMarkup(node: FlowNode, request: ExportRequest): string {
    if (!node.text) {
      return '';
    }
    const size = node.fontSize ?? request.fontSize;
    const align = node.align ?? 'center';
    const lineHeight = ((node.lineHeight ?? request.lineHeight) / 100) * size;
    const lines = this.wrap(node.text, node.w, size);
    const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
    const x = align === 'left' ? 4 : align === 'right' ? node.w - 4 : node.w / 2;
    // Centre the block vertically, then drop to the first baseline.
    const top = node.h / 2 - (lines.length * lineHeight) / 2 + size * 0.8;

    const decorations = [
      node.underline ? 'underline' : '',
      node.strikethrough ? 'line-through' : ''
    ].filter(Boolean);

    const attrs = [
      `x="${this.round(x)}"`,
      `text-anchor="${anchor}"`,
      `font-family="${this.escape(node.fontFamily || 'Helvetica, Arial, sans-serif')}"`,
      `font-size="${size}"`,
      `fill="${node.textColor || request.colors.text}"`,
      node.bold ? 'font-weight="700"' : '',
      node.italic ? 'font-style="italic"' : '',
      decorations.length ? `text-decoration="${decorations.join(' ')}"` : ''
    ].filter(Boolean);

    const tspans = lines
      .map(
        (line, i) =>
          `<tspan x="${this.round(x)}" y="${this.round(top + i * lineHeight)}">${this.escape(line)}</tspan>`
      )
      .join('');
    return `<text ${attrs.join(' ')}>${tspans}</text>`;
  }

  private wrap(text: string, width: number, fontSize: number): string[] {
    // 0.55em is a fair average for the proportional fonts on offer.
    const maxChars = Math.max(1, Math.floor((width - 8) / (fontSize * 0.55)));
    const lines: string[] = [];
    for (const paragraph of text.split('\n')) {
      let line = '';
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (candidate.length <= maxChars || !line) {
          line = candidate;
        } else {
          lines.push(line);
          line = word;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  // --- Rasterising -------------------------------------------------------

  private rasterize(
    svg: string,
    width: number,
    height: number,
    scale: number,
    background: string
  ): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D is unavailable'));
          return;
        }
        // JPEG has no alpha, so the background must be painted, not assumed.
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas);
      };
      image.onerror = () => reject(new Error('Could not render the diagram'));
      // A data URL keeps the image same-origin, so the canvas stays untainted
      // and toDataURL() is allowed.
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    });
  }

  // --- PDF ---------------------------------------------------------------

  /**
   * A minimal one-page PDF wrapping `jpeg` as a DCTDecode image XObject. The
   * page is sized in points from the diagram's CSS pixels, and the (larger)
   * raster is scaled onto it, so the file prints sharply at a sane page size.
   */
  private buildPdf(
    jpeg: Uint8Array,
    pixelWidth: number,
    pixelHeight: number,
    pageWidth: number,
    pageHeight: number
  ): Blob {
    const parts: BlobPart[] = [];
    const offsets: number[] = [];
    let length = 0;
    const push = (part: string | Uint8Array): void => {
      parts.push(part as BlobPart);
      length += part.length;
    };
    const obj = (id: number, body: string): void => {
      offsets[id] = length;
      push(`${id} 0 obj\n${body}\nendobj\n`);
    };

    const w = Math.round(pageWidth);
    const h = Math.round(pageHeight);
    const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;

    push('%PDF-1.4\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(
      3,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] ` +
        `/Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`
    );
    obj(4, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);

    // Written by hand rather than through obj(): the body is binary.
    offsets[5] = length;
    push(
      `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`
    );
    push(jpeg);
    push('\nendstream\nendobj\n');

    // Cross-reference table: every entry is exactly 20 bytes.
    const startxref = length;
    let xref = 'xref\n0 6\n0000000000 65535 f \n';
    for (let id = 1; id <= 5; id++) {
      xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
    }
    push(xref);
    push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`);

    return new Blob(parts, { type: 'application/pdf' });
  }

  // --- Helpers -----------------------------------------------------------

  private dataUrlToBytes(dataUrl: string): Uint8Array {
    const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  private download(href: string, filename: string): void {
    const link = document.createElement('a');
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  private escape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private round(n: number): number {
    return Math.round(n * 100) / 100;
  }
}
