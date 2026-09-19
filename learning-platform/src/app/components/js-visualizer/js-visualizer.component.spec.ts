import { ComponentFixture, TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { JsVisualizerComponent } from './js-visualizer.component';

describe('JsVisualizerComponent', () => {
  let fixture: ComponentFixture<JsVisualizerComponent>;
  let component: JsVisualizerComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JsVisualizerComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(JsVisualizerComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture?.destroy());

  function setCode(code: string): void {
    component.code = code;
    component.ngOnChanges({ code: new SimpleChange(undefined, code, false) });
  }

  it('creates', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('build() / ngOnChanges()', () => {
    it('splits the code into numbered lines', () => {
      setCode('let a = 1;\nlet b = 2;');
      expect(component.codeLines).toEqual([
        { number: 1, text: 'let a = 1;' },
        { number: 2, text: 'let b = 2;' }
      ]);
    });

    it('populates a real trace result via JsTraceService', () => {
      setCode('let a = 1;\nlet b = 2;');
      expect(component.result?.error).toBeNull();
      expect(component.totalSteps).toBeGreaterThan(0);
    });

    it('resets the step cursor to 0 on every rebuild', () => {
      setCode('let a = 1;\nlet b = 2;');
      component.next();
      expect(component.current).toBe(1);
      setCode('let c = 3;');
      expect(component.current).toBe(0);
    });

    it('surfaces a syntax error from the trace service', () => {
      setCode('const x = ;');
      expect(component.result?.error).toContain('Syntax error');
    });

    it('resets hasRunToEnd on a fresh build even if the previous trace had reached the end', () => {
      setCode('let a = 1;');
      component.current = component.totalSteps - 1;
      expect(component.hasRunToEnd).toBeTrue();

      setCode('let b = 2;\nlet c = 3;');
      expect(component.hasRunToEnd).toBeFalse();
    });
  });

  describe('dry-run table', () => {
    it('builds one column per distinct variable name, in order of first appearance', () => {
      setCode('let a = 1;\nlet b = 2;');
      expect(component.dryRunColumns).toEqual(['a', 'b']);
    });

    it('builds one row per step', () => {
      setCode('let a = 1;\nlet b = 2;');
      expect(component.dryRunRows.length).toBe(component.totalSteps);
    });

    it('marks a cell "—" when the variable is not yet in scope at that step', () => {
      setCode('let a = 1;\nlet b = 2;');
      // Before `let a = 1;` runs, `a` is not in scope yet.
      expect(component.dryRunRows[0].cells[0].value).toBe('—');
    });

    it('marks a cell changed when its value differs from the previous row', () => {
      setCode('let a = 1;\na = 2;');
      const changedSomewhere = component.dryRunRows.some((r) => r.cells.some((c) => c.changed));
      expect(changedSomewhere).toBeTrue();
    });

    it('never marks the first row as changed (nothing to compare against)', () => {
      setCode('let a = 1;');
      expect(component.dryRunRows[0].cells.every((c) => !c.changed)).toBeTrue();
    });
  });

  describe('navigation: next() / prev() / reset() / selectRow()', () => {
    beforeEach(() => setCode('let a = 1;\nlet b = 2;\nlet c = 3;'));

    it('atStart is true and atEnd is false right after build()', () => {
      expect(component.atStart).toBeTrue();
      expect(component.atEnd).toBeFalse();
    });

    it('next() advances the cursor', () => {
      component.next();
      expect(component.current).toBe(1);
    });

    it('next() stops advancing (and pauses) once atEnd', () => {
      for (let i = 0; i < component.totalSteps + 3; i++) component.next();
      expect(component.current).toBe(component.totalSteps - 1);
      expect(component.playing).toBeFalse();
    });

    it('prev() does not go below 0', () => {
      component.prev();
      expect(component.current).toBe(0);
    });

    it('prev() moves back one step', () => {
      component.next();
      component.next();
      component.prev();
      expect(component.current).toBe(1);
    });

    it('reset() returns to step 0 and pauses', () => {
      component.next();
      component.play();
      component.reset();
      expect(component.current).toBe(0);
      expect(component.playing).toBeFalse();
    });

    it('selectRow() pauses playback and jumps to the given index', () => {
      component.play();
      component.selectRow(2);
      expect(component.playing).toBeFalse();
      expect(component.current).toBe(2);
    });

    it('sets hasRunToEnd once the cursor reaches the final step', () => {
      expect(component.hasRunToEnd).toBeFalse();
      component.current = component.totalSteps - 1;
      expect(component.hasRunToEnd).toBeTrue();
    });

    it('hasRunToEnd stays true after stepping back (sticky)', () => {
      component.current = component.totalSteps - 1;
      component.prev();
      expect(component.hasRunToEnd).toBeTrue();
    });
  });

  describe('play() / pause() / togglePlay()', () => {
    beforeEach(() => setCode('let a = 1;\nlet b = 2;\nlet c = 3;'));

    it('play() advances the cursor automatically at the configured speed', fakeAsync(() => {
      component.play();
      expect(component.playing).toBeTrue();
      tick(component.speed);
      expect(component.current).toBe(1);
      discardPeriodicTasks();
    }));

    it('pause() stops automatic advancement', fakeAsync(() => {
      component.play();
      tick(component.speed);
      component.pause();
      const atPause = component.current;
      tick(component.speed * 3);
      expect(component.current).toBe(atPause);
    }));

    it('play() restarts from 0 when called again after reaching the end', fakeAsync(() => {
      for (let i = 0; i < component.totalSteps; i++) component.next();
      expect(component.atEnd).toBeTrue();

      component.play();
      expect(component.current).toBe(0);
      discardPeriodicTasks();
    }));

    it('is a no-op when there are no steps to play', () => {
      setCode(''); // empty program: zero steps besides possibly a trailing snapshot with no statements
      component.result = { steps: [], complexity: { time: 'O(1)', space: 'O(1)', loopDepth: 0 }, truncated: false, error: null };
      component.play();
      expect(component.playing).toBeFalse();
    });

    it('togglePlay() flips between playing and paused', fakeAsync(() => {
      component.togglePlay();
      expect(component.playing).toBeTrue();
      component.togglePlay();
      expect(component.playing).toBeFalse();
      discardPeriodicTasks();
    }));

    it('auto-pauses once play() reaches the final step', fakeAsync(() => {
      component.play();
      tick(component.speed * (component.totalSteps + 2));
      expect(component.playing).toBeFalse();
      expect(component.current).toBe(component.totalSteps - 1);
    }));
  });

  describe('skipLoop()', () => {
    it('jumps past all steps belonging to the innermost loop at the current step', () => {
      setCode('for (let i = 0; i < 5; i++) { let x = i; }');
      // Step into the loop body.
      component.current = 1;
      expect(component.inLoop).toBeTrue();

      component.skipLoop();

      expect(component.inLoop).toBeFalse();
    });

    it('is a no-op when the current step is not inside a loop', () => {
      setCode('let a = 1;\nlet b = 2;');
      component.current = 0;
      const before = component.current;
      component.skipLoop();
      expect(component.current).toBe(before);
    });
  });

  describe('consoleLines', () => {
    it('accumulates logs from step 0 up to and including the current step', () => {
      setCode("console.log('a');\nconsole.log('b');\nlet z = 1;");
      component.current = component.totalSteps - 1;
      expect(component.consoleLines).toEqual(['a', 'b']);
    });

    it('is empty at step 0 before any console output has occurred', () => {
      setCode("let z = 1;\nconsole.log('after');");
      component.current = 0;
      expect(component.consoleLines).toEqual([]);
    });
  });

  describe('accordion sections', () => {
    it('isOpen() is always true when accordion mode is off', () => {
      component.accordion = false;
      component.openSections = [];
      expect(component.isOpen('flow')).toBeTrue();
    });

    it('isOpen() reflects openSections when accordion mode is on', () => {
      component.accordion = true;
      component.openSections = ['flow'];
      expect(component.isOpen('flow')).toBeTrue();
      expect(component.isOpen('memory')).toBeFalse();
    });

    it('toggleSection() emits the section added when it was closed', () => {
      component.accordion = true;
      component.openSections = ['flow'];
      const emitted: string[][] = [];
      component.openSectionsChange.subscribe((v) => emitted.push(v));

      component.toggleSection('memory');

      expect(emitted[0]).toEqual(['flow', 'memory']);
    });

    it('toggleSection() emits the section removed when it was open', () => {
      component.accordion = true;
      component.openSections = ['flow', 'memory'];
      const emitted: string[][] = [];
      component.openSectionsChange.subscribe((v) => emitted.push(v));

      component.toggleSection('flow');

      expect(emitted[0]).toEqual(['memory']);
    });
  });

  describe('ngOnDestroy() / memory leak', () => {
    it('stops the play timer so it does not keep firing after destroy', fakeAsync(() => {
      setCode('let a = 1;\nlet b = 2;\nlet c = 3;');
      component.play();
      fixture.destroy();
      const atDestroy = component.current;
      tick(component.speed * 5);
      expect(component.current).toBe(atDestroy);
    }));
  });
});
