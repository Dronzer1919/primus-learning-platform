import { JsTraceService } from './js-trace.service';

describe('JsTraceService', () => {
  let service: JsTraceService;

  beforeEach(() => {
    service = new JsTraceService();
  });

  it('creates', () => {
    expect(service).toBeTruthy();
  });

  describe('syntax errors', () => {
    it('reports a syntax error without throwing', () => {
      const result = service.trace('const x = ;');
      expect(result.error).toContain('Syntax error');
      expect(result.steps).toEqual([]);
      expect(result.complexity).toEqual({ time: 'O(1)', space: 'O(1)', loopDepth: 0 });
    });
  });

  describe('basic statement tracing', () => {
    it('records one step per top-level statement, plus a trailing snapshot', () => {
      const result = service.trace('let a = 1;\nlet b = 2;');
      // 2 statements + 1 trailing snapshot step.
      expect(result.steps.length).toBe(3);
      expect(result.error).toBeNull();
    });

    it('captures a variable\'s value snapshot at each step', () => {
      const result = service.trace('let a = 1;\na = 2;');
      // Step 0 runs before `let a = 1`, so `a` isn't set yet.
      expect(result.steps[0].vars['a']).toBeUndefined();
      // Step 1 runs before `a = 2`, after `let a = 1` executed — a is 1.
      expect(result.steps[1].vars['a']).toBe('1');
      // Trailing step sees the final value.
      expect(result.steps[2].vars['a']).toBe('2');
    });

    it('assigns increasing line numbers matching the source', () => {
      const result = service.trace('let a = 1;\nlet b = 2;\nlet c = 3;');
      expect(result.steps.map((s) => s.line)).toEqual([1, 2, 3, 3]);
    });
  });

  describe('console output capture', () => {
    it('attaches console.log output to the following step', () => {
      const result = service.trace("console.log('hi');\nlet a = 1;");
      expect(result.steps[1].logs).toEqual(['hi']);
    });

    it('flushes trailing console output onto the final step when nothing follows it', () => {
      const result = service.trace("let a = 1;\nconsole.log('done');");
      expect(result.steps[result.steps.length - 1].logs).toContain('done');
    });

    it('prefixes console.error output distinctly', () => {
      const result = service.trace("console.error('boom');\nlet a = 1;");
      expect(result.steps[1].logs).toEqual(['Error: boom']);
    });
  });

  describe('loops and complexity', () => {
    it('detects a single loop as O(n) time', () => {
      const result = service.trace('for (let i = 0; i < 3; i++) { let x = i; }');
      expect(result.complexity.time).toBe('O(n)');
      expect(result.complexity.loopDepth).toBe(1);
    });

    it('detects nested loops as O(n²)', () => {
      const result = service.trace(
        'for (let i = 0; i < 2; i++) { for (let j = 0; j < 2; j++) { let x = i + j; } }'
      );
      expect(result.complexity.time).toBe('O(n²)');
      expect(result.complexity.loopDepth).toBe(2);
    });

    it('detects triple-nested loops as O(n³)', () => {
      const result = service.trace(
        'for (let i=0;i<1;i++){for(let j=0;j<1;j++){for(let k=0;k<1;k++){let x=1;}}}'
      );
      expect(result.complexity.time).toBe('O(n³)');
    });

    it('records a loop id on every step inside it', () => {
      const result = service.trace('for (let i = 0; i < 3; i++) { let x = i; }');
      const insideLoop = result.steps.filter((s) => s.loops.length > 0);
      expect(insideLoop.length).toBeGreaterThan(0);
    });

    it('produces one step per iteration for a bounded loop', () => {
      const result = service.trace('for (let i = 0; i < 5; i++) { let x = i; }');
      // 5 iterations * 1 statement inside the body, plus the trailing snapshot.
      const bodySteps = result.steps.filter((s) => s.loops.length > 0);
      expect(bodySteps.length).toBe(5);
    });
  });

  describe('truncation (runaway loop safety)', () => {
    it('caps execution and reports truncated: true for an effectively infinite loop', () => {
      const result = service.trace('let i = 0; while (true) { i++; }');
      expect(result.truncated).toBeTrue();
      expect(result.steps.length).toBeGreaterThan(0);
    }, 10000);

    it('does not hang the test runner — completes within a bounded step count', () => {
      // The loop body must contain a statement to instrument: an empty `{}` body has
      // nothing for the tracer to record, so it runs to completion untraced instead of
      // ever reaching the step cap — that's exercised separately below.
      const result = service.trace('for (let i = 0; i < 1000000; i++) { let x = i; }');
      expect(result.truncated).toBeTrue();
      expect(result.steps.length).toBeLessThanOrEqual(4001);
    }, 10000);

    it('leaves an empty-bodied loop untraced (and unbounded) since there is nothing to instrument', () => {
      // Documents the actual (if non-obvious) behavior above rather than asserting it blind.
      const result = service.trace('for (let i = 0; i < 1000000; i++) {}');
      expect(result.truncated).toBeFalse();
      expect(result.error).toBeNull();
    }, 10000);
  });

  describe('runtime errors', () => {
    it('captures a runtime error message without throwing out of trace()', () => {
      const result = service.trace('null.foo;');
      expect(result.error).toBeTruthy();
      expect(() => service.trace('null.foo;')).not.toThrow();
    });
  });

  describe('space complexity heuristic', () => {
    it('flags Array.push as O(n) space', () => {
      const result = service.trace('let arr = []; arr.push(1);');
      expect(result.complexity.space).toBe('O(n)');
    });

    it('flags Set.add as O(n) space', () => {
      const result = service.trace('let s = new Set(); s.add(1);');
      expect(result.complexity.space).toBe('O(n)');
    });

    it('flags Map.set as O(n) space', () => {
      const result = service.trace('let m = new Map(); m.set("a", 1);');
      expect(result.complexity.space).toBe('O(n)');
    });

    it('defaults to O(1) space for code with no growing structures', () => {
      const result = service.trace('let a = 1; let b = a + 1;');
      expect(result.complexity.space).toBe('O(1)');
    });
  });

  describe('value formatting', () => {
    it('formats a string value with quotes (non-top-level)', () => {
      const result = service.trace('let a = "hi";\nlet b = 1;');
      expect(result.steps[1].vars['a']).toBe('"hi"');
    });

    it('formats null and undefined explicitly', () => {
      const result = service.trace('let a = null;\nlet b = a;');
      expect(result.steps[1].vars['a']).toBe('null');
    });

    it('formats an array compactly', () => {
      const result = service.trace('let a = [1, 2, 3];\nlet b = 1;');
      expect(result.steps[1].vars['a']).toBe('[1, 2, 3]');
    });

    it('formats a plain object compactly', () => {
      const result = service.trace('let a = { x: 1, y: 2 };\nlet b = 1;');
      expect(result.steps[1].vars['a']).toBe('{x: 1, y: 2}');
    });

    it('formats a function reference', () => {
      const result = service.trace('function f() {}\nlet b = 1;');
      expect(result.steps[1].vars['f']).toContain('ƒ');
    });

    it('formats a Map', () => {
      const result = service.trace('let m = new Map([["a", 1]]);\nlet b = 1;');
      expect(result.steps[1].vars['m']).toContain('Map(1)');
    });

    it('formats a Set', () => {
      const result = service.trace('let s = new Set([1, 2]);\nlet b = 1;');
      expect(result.steps[1].vars['s']).toContain('Set(2)');
    });
  });

  describe('scoping', () => {
    it('does not leak a block-scoped variable to the outer/global snapshot', () => {
      const result = service.trace('{ let inner = 1; }\nlet outer = 2;');
      const finalStep = result.steps[result.steps.length - 1];
      expect(finalStep.vars['inner']).toBeUndefined();
    });

    it('captures function parameters as in-scope variables inside the function body', () => {
      const result = service.trace('function f(x) { let y = x + 1; }\nf(5);');
      const insideFn = result.steps.find((s) => 'y' in s.vars || 'x' in s.vars);
      expect(insideFn).toBeTruthy();
    });
  });
});
