import { Injectable } from '@angular/core';
// acorn ships its own TS types; the parser is used purely in the browser to
// build an AST we can instrument. Typed loosely as `any` because we only touch
// a handful of well-known Node fields.
import { parse } from 'acorn';

export interface TraceStep {
  /** 1-based source line about to execute at this step. */
  line: number;
  /** Snapshot of in-scope variables (name -> display string) BEFORE the line runs. */
  vars: Record<string, string>;
  /** Stack of enclosing loop ids (source offsets) — used to "skip" a loop. */
  loops: number[];
  /** console.* output produced since the previous step. */
  logs: string[];
}

export interface TraceComplexity {
  time: string;
  space: string;
  loopDepth: number;
}

export interface TraceResult {
  steps: TraceStep[];
  complexity: TraceComplexity;
  /** True when execution hit the step cap (e.g. an unbounded loop). */
  truncated: boolean;
  /** Parse/runtime error message, if any. */
  error: string | null;
}

// Hard cap so an infinite/huge loop can never freeze the tab.
const MAX_STEPS = 4000;
const MAX_NAMES_PER_STEP = 40;

@Injectable({ providedIn: 'root' })
export class JsTraceService {
  /**
   * Parses `code`, instruments every statement inside a block/program body with a
   * step-recording call, runs the result in a lightweight sandbox, and returns the
   * ordered list of execution steps plus an estimated complexity.
   */
  trace(code: string): TraceResult {
    let ast: any;
    try {
      ast = parse(code, { ecmaVersion: 2020, locations: true });
    } catch (e: any) {
      return {
        steps: [],
        complexity: { time: 'O(1)', space: 'O(1)', loopDepth: 0 },
        error: 'Syntax error: ' + (e?.message ?? String(e)),
        truncated: false
      };
    }

    const positions: Array<{ line: number; loops: number[] }> = [];
    const insertions: Array<{ offset: number; text: string }> = [];
    const scopeStack: string[][] = [];
    const loopStack: number[] = [];
    let maxLoopDepth = 0;

    const topScope = () => scopeStack[scopeStack.length - 1];
    const inScopeNames = (): string[] => {
      const seen: Record<string, true> = {};
      const names: string[] = [];
      for (const scope of scopeStack) {
        for (const n of scope) {
          if (!seen[n]) {
            seen[n] = true;
            names.push(n);
          }
        }
      }
      return names.slice(-MAX_NAMES_PER_STEP);
    };

    const addPatternNames = (pattern: any, into: string[]): void => {
      if (!pattern) return;
      switch (pattern.type) {
        case 'Identifier':
          into.push(pattern.name);
          break;
        case 'ObjectPattern':
          for (const prop of pattern.properties) {
            addPatternNames(prop.value ?? prop.argument, into);
          }
          break;
        case 'ArrayPattern':
          for (const el of pattern.elements) addPatternNames(el, into);
          break;
        case 'AssignmentPattern':
          addPatternNames(pattern.left, into);
          break;
        case 'RestElement':
          addPatternNames(pattern.argument, into);
          break;
      }
    };

    const collectDeclNames = (stmt: any, into: string[]): void => {
      if (!stmt) return;
      if (stmt.type === 'VariableDeclaration') {
        for (const d of stmt.declarations) addPatternNames(d.id, into);
      } else if (stmt.type === 'FunctionDeclaration' && stmt.id) {
        into.push(stmt.id.name);
      } else if (stmt.type === 'ClassDeclaration' && stmt.id) {
        into.push(stmt.id.name);
      }
    };

    const makeStepCall = (posIndex: number, names: string[]): string => {
      const assigns = names
        .map((n) => `try{__s[${JSON.stringify(n)}]=${n};}catch(e){}`)
        .join('');
      return `__step(${posIndex},function(){var __s={};${assigns}return __s;});`;
    };

    const instrumentStmt = (stmt: any): void => {
      // Only statements that can safely be prefixed by another statement are
      // instrumented (i.e. members of a block/program body). Bare single-line
      // bodies (`for (…) x++;`) are skipped so we never produce invalid code.
      const posIndex = positions.length;
      positions.push({ line: stmt.loc.start.line, loops: loopStack.slice() });
      insertions.push({ offset: stmt.start, text: makeStepCall(posIndex, inScopeNames()) });
    };

    const processBody = (statements: any[]): void => {
      for (const stmt of statements) {
        instrumentStmt(stmt);
        collectDeclNames(stmt, topScope());
        visit(stmt);
      }
    };

    const handleBlock = (node: any): void => {
      scopeStack.push([]);
      processBody(node.body);
      scopeStack.pop();
    };

    const handleFunction = (node: any): void => {
      scopeStack.push([]);
      for (const p of node.params) addPatternNames(p, topScope());
      if (node.body && node.body.type === 'BlockStatement') {
        processBody(node.body.body);
      } else if (node.body) {
        visit(node.body);
      }
      scopeStack.pop();
    };

    const handleLoop = (node: any): void => {
      scopeStack.push([]);
      if (node.init && node.init.type === 'VariableDeclaration') {
        collectDeclNames(node.init, topScope());
      }
      if (node.left && node.left.type === 'VariableDeclaration') {
        collectDeclNames(node.left, topScope());
      }
      loopStack.push(node.start);
      maxLoopDepth = Math.max(maxLoopDepth, loopStack.length);
      if (node.body && node.body.type === 'BlockStatement') {
        processBody(node.body.body);
      } else if (node.body) {
        visit(node.body);
      }
      loopStack.pop();
      scopeStack.pop();
    };

    const LOOP_TYPES: Record<string, true> = {
      ForStatement: true,
      ForInStatement: true,
      ForOfStatement: true,
      WhileStatement: true,
      DoWhileStatement: true
    };
    const FN_TYPES: Record<string, true> = {
      FunctionDeclaration: true,
      FunctionExpression: true,
      ArrowFunctionExpression: true
    };

    const visit = (node: any): void => {
      if (!node || typeof node.type !== 'string') return;
      if (node.type === 'BlockStatement') {
        handleBlock(node);
        return;
      }
      if (FN_TYPES[node.type]) {
        handleFunction(node);
        return;
      }
      if (LOOP_TYPES[node.type]) {
        handleLoop(node);
        return;
      }
      // Generic descent: keep looking for nested blocks/loops/functions
      // (if/else branches, callbacks passed as arguments, etc.).
      for (const key of Object.keys(node)) {
        if (key === 'type' || key === 'loc' || key === 'start' || key === 'end') continue;
        const child = (node as any)[key];
        if (Array.isArray(child)) {
          for (const c of child) if (c && typeof c.type === 'string') visit(c);
        } else if (child && typeof child.type === 'string') {
          visit(child);
        }
      }
    };

    // Walk the program body as the global scope.
    scopeStack.push([]);
    processBody(ast.body);
    const globalNames = inScopeNames();
    scopeStack.pop();

    // Trailing snapshot so the effect of the final statement is visible too.
    const finalIndex = positions.length;
    positions.push({ line: this.lastLine(code), loops: [] });
    insertions.push({ offset: code.length, text: ';' + makeStepCall(finalIndex, globalNames) });

    const instrumented = this.applyInsertions(code, insertions);
    const runtime = this.run(instrumented, positions);

    return {
      steps: runtime.steps,
      complexity: {
        time: this.timeComplexity(maxLoopDepth),
        space: this.spaceComplexity(code),
        loopDepth: maxLoopDepth
      },
      truncated: runtime.truncated,
      error: runtime.error
    };
  }

  private lastLine(code: string): number {
    let n = 1;
    for (let i = 0; i < code.length; i++) if (code[i] === '\n') n++;
    return n;
  }

  private applyInsertions(code: string, insertions: Array<{ offset: number; text: string }>): string {
    // Splice from the end so earlier offsets stay valid.
    const sorted = insertions.slice().sort((a, b) => b.offset - a.offset);
    let out = code;
    for (const ins of sorted) {
      out = out.slice(0, ins.offset) + ins.text + out.slice(ins.offset);
    }
    return out;
  }

  private run(
    instrumented: string,
    positions: Array<{ line: number; loops: number[] }>
  ): { steps: TraceStep[]; truncated: boolean; error: string | null } {
    const steps: TraceStep[] = [];
    let pending: string[] = [];
    let truncated = false;
    let error: string | null = null;

    const fmt = (v: any) => this.formatValue(v, 0);

    const step = (posIndex: number, snap: () => Record<string, any>): void => {
      if (steps.length >= MAX_STEPS) {
        truncated = true;
        const stop: any = new Error('step-limit');
        stop.__stepLimit = true;
        throw stop;
      }
      const vars: Record<string, string> = {};
      try {
        const raw = snap();
        for (const key in raw) vars[key] = this.formatValue(raw[key], 1);
      } catch (e) {
        /* ignore snapshot failures */
      }
      const pos = positions[posIndex];
      steps.push({ line: pos.line, vars, loops: pos.loops, logs: pending });
      pending = [];
    };

    const sandboxConsole = {
      log: (...args: any[]) => pending.push(args.map(fmt).join(' ')),
      info: (...args: any[]) => pending.push(args.map(fmt).join(' ')),
      warn: (...args: any[]) => pending.push(args.map(fmt).join(' ')),
      error: (...args: any[]) => pending.push('Error: ' + args.map(fmt).join(' '))
    };

    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('__step', 'console', instrumented);
      fn(step, sandboxConsole);
    } catch (e: any) {
      if (!e || !e.__stepLimit) {
        error = e?.message ? e.message : String(e);
      }
    }

    // Flush any trailing console output onto the last recorded step.
    if (pending.length && steps.length) {
      steps[steps.length - 1].logs = steps[steps.length - 1].logs.concat(pending);
    }

    return { steps, truncated, error };
  }

  private formatValue(v: any, depth: number): string {
    if (v === null) return 'null';
    if (v === undefined) return 'undefined';
    const t = typeof v;
    if (t === 'function') return 'ƒ ' + (v.name || '') + '()';
    if (t === 'string') return depth === 0 ? v : JSON.stringify(v);
    if (t === 'number' || t === 'boolean' || t === 'bigint') return String(v);
    if (t === 'symbol') return v.toString();
    if (Array.isArray(v)) {
      if (depth > 3) return '[…]';
      const head = v.slice(0, 20).map((x) => this.formatValue(x, depth + 1));
      return '[' + head.join(', ') + (v.length > 20 ? ', …' : '') + ']';
    }
    if (t === 'object') {
      if (v instanceof Map) {
        const entries = Array.from(v.entries()).slice(0, 10)
          .map(([k, val]) => this.formatValue(k, depth + 1) + ' => ' + this.formatValue(val, depth + 1));
        return 'Map(' + v.size + ') {' + entries.join(', ') + (v.size > 10 ? ', …' : '') + '}';
      }
      if (v instanceof Set) {
        const items = Array.from(v.values()).slice(0, 10).map((x) => this.formatValue(x, depth + 1));
        return 'Set(' + v.size + ') {' + items.join(', ') + (v.size > 10 ? ', …' : '') + '}';
      }
      if (depth > 3) return '{…}';
      const keys = Object.keys(v);
      const body = keys.slice(0, 20).map((k) => k + ': ' + this.formatValue(v[k], depth + 1));
      return '{' + body.join(', ') + (keys.length > 20 ? ', …' : '') + '}';
    }
    return String(v);
  }

  private timeComplexity(depth: number): string {
    switch (depth) {
      case 0:
        return 'O(1)';
      case 1:
        return 'O(n)';
      case 2:
        return 'O(n²)';
      case 3:
        return 'O(n³)';
      default:
        return 'O(n^' + depth + ')';
    }
  }

  private spaceComplexity(code: string): string {
    // Heuristic: a growing data structure (push/add/set on an array/Map/Set)
    // implies O(n) auxiliary space; otherwise assume O(1).
    if (/\.\s*push\s*\(|\.\s*add\s*\(|\.\s*set\s*\(|new\s+(Map|Set)\b|new\s+Array\s*\(/.test(code)) {
      return 'O(n)';
    }
    return 'O(1)';
  }
}
