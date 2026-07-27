import { Component, Input, Output, EventEmitter, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';

import { IonicModule } from '@ionic/angular';
import { JsTraceService, TraceResult, TraceStep } from '../../services/js-trace.service';

interface CodeLine {
  number: number;
  text: string;
}

interface VarView {
  name: string;
  value: string;
}

/** Collapsible sections of the mobile accordion. 'code' is the host's editor pane. */
export type VizSection = 'code' | 'flow' | 'memory' | 'console';

@Component({
  selector: 'app-js-visualizer',
  templateUrl: './js-visualizer.component.html',
  styleUrls: ['./js-visualizer.component.scss'],
  standalone: true,
  imports: [IonicModule]
})
export class JsVisualizerComponent implements OnChanges, OnDestroy {
  /** JavaScript source to trace and step through. */
  @Input() code = '';
  /**
   * Mobile accordion mode. The host turns this on when the workspace is stacked, where
   * showing the code listing, memory and console at once leaves none of them readable.
   */
  @Input() accordion = false;
  /**
   * Which sections are expanded. Owned by the host because the accordion also contains
   * the host's own editor pane — one shared value is what lets a toggle here collapse
   * a section over there.
   *
   * Several may be open at once; they split the available height evenly rather than the
   * first one claiming all of it.
   */
  @Input() openSections: VizSection[] = ['flow', 'memory'];
  @Output() openSectionsChange = new EventEmitter<VizSection[]>();
  /** Ask the host to re-trace with the latest editor code. */
  @Output() refresh = new EventEmitter<void>();
  /** Ask the host to close the visualizer. */
  @Output() close = new EventEmitter<void>();

  result: TraceResult | null = null;
  codeLines: CodeLine[] = [];
  playing = false;
  speed = 600; // ms between steps in play mode

  /**
   * Set once stepping has reached the final step of a trace. Gates the console section
   * in accordion mode: output is only offered after the whole run has been seen.
   * Deliberately sticky across prev()/reset() — it would flicker away mid-review
   * otherwise — and cleared only when a new trace is built.
   */
  hasRunToEnd = false;

  private _current = 0;
  private timer: any = null;

  constructor(private traceService: JsTraceService) {}

  get current(): number {
    return this._current;
  }

  set current(value: number) {
    this._current = value;
    if (this.totalSteps > 0 && value >= this.totalSteps - 1) {
      this.hasRunToEnd = true;
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['code']) {
      this.build();
    }
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  /** (Re)runs the tracer against the current code. */
  build(): void {
    this.stopTimer();
    this.playing = false;
    this.current = 0;
    this.codeLines = this.code.split('\n').map((text, i) => ({ number: i + 1, text }));
    this.result = this.traceService.trace(this.code);
    // Cleared last: the `current` setter above still sees the previous trace's step
    // count, so an earlier reset could otherwise be undone by a stale `atEnd`.
    this.hasRunToEnd = false;
  }

  /** True while `section` is expanded (or whenever the accordion is off). */
  isOpen(section: VizSection): boolean {
    return !this.accordion || this.openSections.includes(section);
  }

  /** Expands `section`, or collapses it if it was already open. */
  toggleSection(section: VizSection): void {
    this.openSectionsChange.emit(
      this.openSections.includes(section)
        ? this.openSections.filter((s) => s !== section)
        : [...this.openSections, section]
    );
  }

  get steps(): TraceStep[] {
    return this.result?.steps ?? [];
  }

  get totalSteps(): number {
    return this.steps.length;
  }

  get step(): TraceStep | null {
    return this.steps[this.current] ?? null;
  }

  get activeLine(): number {
    return this.step?.line ?? -1;
  }

  get vars(): VarView[] {
    const s = this.step;
    if (!s) return [];
    return Object.keys(s.vars).map((name) => ({ name, value: s.vars[name] }));
  }

  /** Console output accumulated from step 0 up to and including the current step. */
  get consoleLines(): string[] {
    const out: string[] = [];
    for (let i = 0; i <= this.current && i < this.steps.length; i++) {
      for (const line of this.steps[i].logs) out.push(line);
    }
    return out;
  }

  /** True when the current step is executing inside at least one loop. */
  get inLoop(): boolean {
    return (this.step?.loops.length ?? 0) > 0;
  }

  get atStart(): boolean {
    return this.current <= 0;
  }

  get atEnd(): boolean {
    return this.current >= this.totalSteps - 1;
  }

  next(): void {
    if (!this.atEnd) {
      this.current++;
    } else {
      this.pause();
    }
  }

  prev(): void {
    if (!this.atStart) this.current--;
  }

  reset(): void {
    this.pause();
    this.current = 0;
  }

  play(): void {
    if (this.totalSteps === 0) return;
    if (this.atEnd) this.current = 0;
    this.playing = true;
    this.stopTimer();
    this.timer = setInterval(() => this.next(), this.speed);
  }

  pause(): void {
    this.playing = false;
    this.stopTimer();
  }

  togglePlay(): void {
    this.playing ? this.pause() : this.play();
  }

  /**
   * Skips to just after the innermost loop the current step sits in — handy when a
   * loop iterates many times and stepping one-by-one is tedious.
   */
  skipLoop(): void {
    const s = this.step;
    if (!s || s.loops.length === 0) return;
    const loopId = s.loops[s.loops.length - 1];
    let i = this.current;
    while (i < this.steps.length && this.steps[i].loops.includes(loopId)) i++;
    this.current = Math.min(i, this.totalSteps - 1);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
