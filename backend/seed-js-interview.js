/*
 * Idempotent seed of JavaScript interview-prep topics for 3+ years experienced
 * developers. Mirrors the Angular/HTML/CSS seeds: ONE topic per difficulty level
 * (beginner / intermediate / advance / expert) on the existing "JavaScript" tab,
 * covering the important JS interview areas comprehensively.
 *
 * Run with:  node seed-js-interview.js   (or: npm run seed:js-interview)
 * Safe to re-run: removes only the topics THIS script seeds (by exact title) first.
 * Non-destructive: the beginner title "JavaScript Fundamentals" is distinct from the
 * seed.js "JavaScript Basics" sample, so both coexist.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const LanguageTab = require('./src/models/LanguageTab');
const Topic = require('./src/models/Topic');

// ---- content-block helpers ----
// Descriptions render via [innerHTML], so HTML-escape prose (angle brackets, &).
// Code blocks use {{ }} interpolation and are already safe, so they are NOT escaped.
let blockOrder = 0;
const escapeHtml = (s) => s
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');
const desc = (text) => ({ type: 'description', order: blockOrder++, data: { text: escapeHtml(text) } });
const code = (codeStr, language = 'javascript', title = '') => ({
  type: 'code',
  order: blockOrder++,
  data: { language, code: codeStr, title }
});
let stOrder = 0;
const sub = (title, blocks) => {
  blockOrder = 0;
  return { title, order: stOrder++, content: blocks };
};

// ============================ BEGINNER: JavaScript Fundamentals ============================
stOrder = 0;
const jsFundamentals = {
  title: 'JavaScript Fundamentals',
  description: 'Scope, data types, coercion & equality, hoisting/TDZ, functions & arrows, truthy/falsy, destructuring/spread/rest, optional chaining and template literals.',
  difficultyLevel: 'beginner',
  languagePlatform: 'javascript',
  order: 2,
  subtopics: [
    sub('var, let & const — Scope', [
      desc('var is function-scoped and hoisted (initialised as undefined), allows redeclaration, and leaks out of blocks. let and const are block-scoped, sit in the Temporal Dead Zone until declared, and cannot be redeclared in the same scope. const binds a constant REFERENCE — the variable cannot be reassigned, but a const object/array is still mutable. Default to const, use let when reassigning, avoid var.'),
      code(
        'if (true) {\n' +
        '  var a = 1;   // leaks out of the block\n' +
        '  let b = 2;   // block-scoped\n' +
        '  const c = 3; // block-scoped, no reassignment\n' +
        '}\n' +
        'console.log(a); // 1\n' +
        '// console.log(b); // ReferenceError\n\n' +
        'const user = { name: "Al" };\n' +
        'user.name = "Bo"; // OK — object is mutable\n' +
        '// user = {};      // TypeError — reassignment blocked',
        'javascript', 'Scope & reassignment'
      )
    ]),
    sub('Data Types: Primitives vs Reference', [
      desc('JS has 7 primitives (string, number, boolean, null, undefined, symbol, bigint) stored and copied BY VALUE, and objects (including arrays and functions) stored and copied BY REFERENCE. Comparing objects compares references, not contents. typeof quirks: typeof null is "object" (a historic bug) and typeof a function is "function". null is an intentional "no value"; undefined means "not assigned".'),
      code(
        'let a = 10, b = a; b++;               // primitives copied by value\n' +
        'console.log(a, b); // 10 11\n\n' +
        'let o1 = { x: 1 }, o2 = o1; o2.x = 9; // objects share a reference\n' +
        'console.log(o1.x); // 9\n\n' +
        'console.log([] === []); // false — different references\n' +
        'typeof null;      // "object" (legacy bug)\n' +
        'typeof undefined; // "undefined"',
        'javascript', 'Value vs reference'
      )
    ]),
    sub('Type Coercion & Equality (== vs ===)', [
      desc('== (loose) converts operands to a common type before comparing, causing surprises (0 == "", null == undefined, [] == false are all true). === (strict) compares value AND type with no coercion — always prefer it. Know the rules: + with a string concatenates, other arithmetic operators convert to number. Use Number()/String()/Boolean() for explicit conversion, and Object.is() for NaN and -0 edge cases.'),
      code(
        '0 == "";           // true  (coercion)\n' +
        'null == undefined; // true\n' +
        'NaN === NaN;       // false\n' +
        '1 + "2";           // "12"  (string concat)\n' +
        '"5" - 2;           // 3     (numeric)\n' +
        '0 === false;       // false (strict, no coercion)\n' +
        'Object.is(NaN, NaN); // true',
        'javascript', 'Coercion gotchas'
      )
    ]),
    sub('Hoisting & the Temporal Dead Zone', [
      desc('During the creation phase the engine hoists declarations. var is hoisted and initialised to undefined; function DECLARATIONS are fully hoisted (callable before their line). let/const are hoisted too but stay uninitialised in the Temporal Dead Zone (TDZ) until their declaration runs, so accessing them early throws ReferenceError. Function EXPRESSIONS and arrows follow their variable rules.'),
      code(
        'console.log(x); // undefined (var hoisted)\n' +
        'var x = 5;\n\n' +
        '// console.log(y); // ReferenceError — TDZ\n' +
        'let y = 10;\n\n' +
        'greet(); // works — declaration fully hoisted\n' +
        'function greet() { return "hi"; }',
        'javascript', 'Hoisting & TDZ'
      )
    ]),
    sub('Functions & Arrow Functions', [
      desc('Function declarations are hoisted; function expressions are not. Arrow functions are concise, have an implicit return for a single expression, and — crucially — do NOT have their own this, arguments or prototype: this is taken lexically from the enclosing scope. So arrows are ideal for callbacks but wrong for object methods or constructors. Default, rest and spread parameters round out modern function syntax.'),
      code(
        'const add = (a, b = 0) => a + b;                 // default + implicit return\n' +
        'const sum = (...nums) => nums.reduce((s, n) => s + n, 0); // rest params\n\n' +
        'const obj = {\n' +
        '  val: 42,\n' +
        '  regular() { return this.val; }, // this = obj\n' +
        '  arrow: () => this.val,          // this = outer scope (NOT obj)\n' +
        '};',
        'javascript', 'Arrows & this'
      )
    ]),
    sub('Truthy / Falsy & Logical Operators', [
      desc('The 8 falsy values are: false, 0, -0, 0n, "", null, undefined, NaN — everything else is truthy (including "0", "false", [], {}). && returns the first falsy operand (or the last); || returns the first truthy (or the last) — both short-circuit. ?? (nullish coalescing) only falls back on null/undefined, so it is safer than || when 0 or "" are valid values.'),
      code(
        'const name = userName || "Guest"; // falls back on ANY falsy\n' +
        'const count = value ?? 0;         // falls back only on null/undefined\n' +
        'isReady && render();              // run only when truthy\n\n' +
        'Boolean("0"); // true  (non-empty string)\n' +
        'Boolean([]);  // true  (objects are truthy)',
        'javascript', 'Short-circuit logic'
      )
    ]),
    sub('Destructuring, Spread & Rest', [
      desc('Destructuring unpacks arrays/objects into variables with defaults, renaming and nesting. The spread operator (...) expands an iterable/object into elements — the idiomatic way to COPY (shallow) and MERGE immutably. Rest (...) collects the remaining items into an array/object. Same syntax, opposite jobs: spread expands, rest gathers.'),
      code(
        'const { name, age = 18, address: { city } = {} } = user; // defaults + rename + nested\n' +
        'const [first, ...others] = [1, 2, 3]; // first=1, others=[2,3]\n\n' +
        'const copy = { ...user, active: true }; // shallow clone + override\n' +
        'const merged = [...a, ...b];            // concat immutably',
        'javascript', 'Spread vs rest'
      )
    ]),
    sub('Optional Chaining & Nullish Coalescing', [
      desc('Optional chaining (?.) short-circuits to undefined instead of throwing when a reference in a chain is null/undefined — great for deep/optional data and optional calls (obj?.fn?.()). Combine it with ?? to supply a default. It reads far cleaner than long && guards and prevents the classic "Cannot read properties of undefined" crash.'),
      code(
        'const city = user?.address?.city ?? "Unknown";\n' +
        'const len  = list?.length ?? 0;\n' +
        'socket?.close?.(); // call only if it exists\n' +
        'arr?.[0];          // optional index access',
        'javascript', 'Safe access'
      )
    ]),
    sub('Template Literals & Modern Syntax', [
      desc('Template literals use backticks for interpolation (${expr}), multi-line strings and tagged templates (a function receives the string parts and interpolated values — used by libraries like styled-components and for safe HTML building). They replace fragile string concatenation and greatly improve readability.'),
      code(
        'const msg = `Hi ${user.name}, you have ${count} new ${count === 1 ? "message" : "messages"}.`;\n\n' +
        'const html = `\n' +
        '  <li>${item.title}</li>\n' +
        '`;\n\n' +
        '// tagged template receives (strings, ...values)\n' +
        'function hi(strings, ...values) { return strings.join("_"); }',
        'javascript', 'Template literals'
      )
    ])
  ]
};

// ============================ INTERMEDIATE: Core Mechanics ============================
stOrder = 0;
const jsCore = {
  title: 'JavaScript Core Mechanics',
  description: 'Closures, the this keyword, call/apply/bind, prototypes & prototypal inheritance, ES6 classes, array higher-order methods, object descriptors and shallow vs deep copying.',
  difficultyLevel: 'intermediate',
  languagePlatform: 'javascript',
  order: 3,
  subtopics: [
    sub('Closures', [
      desc('A closure is a function bundled with references to its surrounding lexical scope, so it "remembers" outer variables even after the outer function returns. Closures power private state/encapsulation, factory functions, memoisation, currying and callbacks that retain context. The classic bug — a var loop variable shared by every callback — is fixed by let (per-iteration binding) or an IIFE.'),
      code(
        'function makeCounter() {\n' +
        '  let count = 0; // private\n' +
        '  return { inc: () => ++count, get: () => count };\n' +
        '}\n' +
        'const c = makeCounter();\n' +
        'c.inc(); c.inc(); c.get(); // 2\n\n' +
        '// let gives each iteration its own binding\n' +
        'for (let i = 0; i < 3; i++) setTimeout(() => console.log(i), 0); // 0 1 2',
        'javascript', 'Private state + loop fix'
      )
    ]),
    sub('The this Keyword', [
      desc('this is determined by HOW a function is CALLED, not where it is defined. Method call: the object before the dot. Plain function call: undefined in strict mode (else the global object). Constructor (new): the new instance. Arrow function: inherited lexically (cannot be rebound). Passing a method as a bare callback DETACHES it and loses this — a very common bug.'),
      code(
        'const user = {\n' +
        '  name: "Al",\n' +
        '  greet() { return `Hi ${this.name}`; },\n' +
        '};\n' +
        'const fn = user.greet;\n' +
        'fn();         // this is undefined — detached\n' +
        'user.greet(); // "Hi Al"\n' +
        'setTimeout(() => user.greet(), 0); // arrow keeps context',
        'javascript', 'How this is bound'
      )
    ]),
    sub('call, apply & bind', [
      desc('These explicitly set this. call(thisArg, ...args) invokes immediately with individual arguments; apply(thisArg, argsArray) is the same but takes an array; bind(thisArg, ...args) returns a NEW function permanently bound to thisArg (and can pre-fill arguments — partial application). Use bind to fix a callback this, and call/apply to borrow methods across objects.'),
      code(
        'function intro(greeting) { return `${greeting}, ${this.name}`; }\n' +
        'const u = { name: "Al" };\n' +
        'intro.call(u, "Hi");         // "Hi, Al"\n' +
        'intro.apply(u, ["Hey"]);     // "Hey, Al"\n' +
        'const bound = intro.bind(u); // fixed this\n' +
        'bound("Yo");                 // "Yo, Al"',
        'javascript', 'Explicit binding'
      )
    ]),
    sub('Prototypes & Prototypal Inheritance', [
      desc('Every object has an internal [[Prototype]] (via Object.getPrototypeOf / __proto__) linking to another object. Property lookups walk this prototype CHAIN until found or null. Functions have a prototype property used when called with new. This is how JS shares methods (arr.map lives on Array.prototype) and implements inheritance — classes are syntactic sugar over it.'),
      code(
        'const animal = { speak() { return `${this.name} makes a sound`; } };\n' +
        'const dog = Object.create(animal); // dog links to animal\n' +
        'dog.name = "Rex";\n' +
        'dog.speak(); // found by walking the chain to animal.speak\n\n' +
        'Object.getPrototypeOf([]) === Array.prototype; // true',
        'javascript', 'The prototype chain'
      )
    ]),
    sub('ES6 Classes', [
      desc('class is syntactic sugar over prototypes: methods go on the prototype (shared), the constructor initialises instance fields, extends + super set up inheritance, static members live on the class itself, and #private fields are truly private. Getters/setters and public class fields (including arrow methods that auto-bind this) are supported. Under the hood it is still prototypal.'),
      code(
        'class Animal {\n' +
        '  #id = crypto.randomUUID();          // private field\n' +
        '  constructor(name) { this.name = name; }\n' +
        '  speak() { return `${this.name} sounds`; }\n' +
        '  static create(n) { return new Animal(n); }\n' +
        '}\n' +
        'class Dog extends Animal {\n' +
        '  speak() { return `${super.speak()} — woof`; }\n' +
        '}',
        'javascript', 'Classes over prototypes'
      )
    ]),
    sub('Array Higher-Order Methods', [
      desc('map (transform to a new array), filter (keep matches), reduce (fold to one value), find/findIndex, some/every (boolean tests), flat/flatMap, sort (MUTATES, and sorts as strings by default — pass a comparator), forEach (side effects). They are declarative and chainable. Know which MUTATE (sort, reverse, splice, push) vs return new arrays (map, filter, slice, concat).'),
      code(
        'const nums = [1, 2, 3, 4];\n' +
        'const doubledEvens = nums.filter(n => n % 2 === 0).map(n => n * 2); // [4, 8]\n' +
        'const total = nums.reduce((sum, n) => sum + n, 0);                 // 10\n' +
        'const sorted = [...nums].sort((a, b) => b - a); // copy before sort!\n' +
        'nums.some(n => n > 3); // true',
        'javascript', 'map / filter / reduce'
      )
    ]),
    sub('Objects & Property Descriptors', [
      desc('Object utilities: Object.keys/values/entries (iterate), Object.assign (shallow merge), Object.freeze (shallow immutability), Object.defineProperty (fine control via descriptors: value, writable, enumerable, configurable, plus get/set). Object.getOwnPropertyDescriptor inspects them. Property shorthand, computed keys ([expr]) and getters/setters are everyday syntax.'),
      code(
        'const obj = {};\n' +
        'Object.defineProperty(obj, "id", {\n' +
        '  value: 42, writable: false, enumerable: false,\n' +
        '});\n\n' +
        'const frozen = Object.freeze({ a: 1 });\n' +
        'frozen.a = 9; // silently ignored (throws in strict mode)\n\n' +
        'Object.entries({ a: 1, b: 2 }); // [["a",1],["b",2]]',
        'javascript', 'Descriptors & freeze'
      )
    ]),
    sub('Copying: Shallow vs Deep', [
      desc('Spread and Object.assign make SHALLOW copies — nested objects are still shared by reference, so mutating them affects both copies. For a DEEP copy use structuredClone() (built-in; handles Dates/Maps/Sets/cycles) or JSON.parse(JSON.stringify(x)) (simple but drops functions and undefined, turns Dates into strings, and throws on cycles). This distinction prevents subtle shared-state bugs, especially in state management.'),
      code(
        'const state = { user: { name: "Al" }, tags: ["a"] };\n' +
        'const shallow = { ...state };\n' +
        'shallow.user.name = "Bo"; // also changes state.user.name!\n\n' +
        'const deep = structuredClone(state); // fully independent\n' +
        'deep.user.name = "Cy";               // state untouched',
        'javascript', 'Avoid shared references'
      )
    ])
  ]
};

// ============================ ADVANCE: Asynchronous & the Runtime ============================
stOrder = 0;
const jsAsync = {
  title: 'JavaScript Async & the Runtime',
  description: 'Single-threaded model & call stack, the event loop with tasks vs microtasks, callbacks, Promises, async/await, sequential vs parallel with combinators, timers, and debounce/throttle.',
  difficultyLevel: 'advance',
  languagePlatform: 'javascript',
  order: 4,
  subtopics: [
    sub('Sync vs Async & the Call Stack', [
      desc('JS is single-threaded with ONE call stack, so long synchronous work blocks everything (the UI freezes). Asynchronous APIs (timers, fetch, DOM events) are provided by the HOST (browser/Node), not the language — the engine offloads them and keeps running, then executes their callbacks later via the event loop. "Single-threaded but non-blocking" is the core idea behind every async question.'),
      code(
        'console.log("1");\n' +
        'setTimeout(() => console.log("2"), 0); // offloaded to the host\n' +
        'console.log("3");\n' +
        '// Output: 1, 3, 2 — the callback runs after the stack clears',
        'javascript', 'Non-blocking model'
      )
    ]),
    sub('The Event Loop: Tasks & Microtasks', [
      desc('The event loop runs synchronous code, then — whenever the call stack is empty — drains ALL microtasks (Promise callbacks, queueMicrotask, MutationObserver) before taking the NEXT macrotask (setTimeout, setInterval, I/O, UI events). So Promises always resolve before timers. Flooding the microtask queue can starve rendering. This ordering is a top interview question.'),
      code(
        'console.log("A");\n' +
        'setTimeout(() => console.log("B"), 0);          // macrotask\n' +
        'Promise.resolve().then(() => console.log("C")); // microtask\n' +
        'console.log("D");\n' +
        '// Order: A, D, C, B',
        'javascript', 'Microtasks before macrotasks'
      )
    ]),
    sub('Callbacks & Callback Hell', [
      desc('A callback is a function passed to run later. Nesting dependent async callbacks creates the deeply-indented "pyramid of doom" that is hard to read and error-handle (each level needs its own error branch). Node also uses the error-first convention: callback(err, result), where the first argument is null on success. Promises and async/await were introduced to flatten this.'),
      code(
        '// callback hell\n' +
        'getUser(id, (e, user) => {\n' +
        '  if (e) return handle(e);\n' +
        '  getOrders(user.id, (e, orders) => {\n' +
        '    if (e) return handle(e);\n' +
        '    getItems(orders[0], (e, items) => { /* ... */ });\n' +
        '  });\n' +
        '});',
        'javascript', 'Pyramid of doom'
      )
    ]),
    sub('Promises', [
      desc('A Promise represents a future value in one of three states: pending, then fulfilled (then) or rejected (catch); finally always runs. It is eager (starts immediately) and settles once. Chaining .then returns a NEW promise so steps sequence flatly, and a single trailing .catch handles errors from any prior step. In modern runtimes an unhandled rejection is treated as an error, so always handle it.'),
      code(
        'fetchUser(id)\n' +
        '  .then(user => fetchOrders(user.id)) // return a promise to chain\n' +
        '  .then(orders => render(orders))\n' +
        '  .catch(err => showError(err))       // catches any step above\n' +
        '  .finally(() => hideSpinner());',
        'javascript', 'Chaining & catch'
      )
    ]),
    sub('async / await', [
      desc('async/await is syntactic sugar over Promises: an async function always returns a Promise, and await pauses that function until the awaited Promise settles — WITHOUT blocking the thread. It reads like synchronous code; use try/catch for errors. Forgetting await is a silent bug (the variable holds a Promise, not the value). Top-level await works in ES modules.'),
      code(
        'async function load(id) {\n' +
        '  try {\n' +
        '    const user = await fetchUser(id);\n' +
        '    const orders = await fetchOrders(user.id);\n' +
        '    return orders;\n' +
        '  } catch (err) {\n' +
        '    showError(err);\n' +
        '    throw err; // let callers handle it too\n' +
        '  }\n' +
        '}',
        'javascript', 'try/catch await'
      )
    ]),
    sub('Sequential vs Parallel & Combinators', [
      desc('Awaiting one after another SUMS the times; independent tasks should run in PARALLEL. Promise.all runs all and fails fast on the first rejection (total time = slowest). Promise.allSettled waits for all and never rejects (returns status + value/reason). Promise.race settles with the first to finish (timeouts). Promise.any resolves with the first fulfilment. await inside forEach does NOT wait — use for...of (sequential) or Promise.all(map) (parallel).'),
      code(
        '// parallel — ~1s, not 3s\n' +
        'const [u, o, p] = await Promise.all([getUser(), getOrders(), getProducts()]);\n\n' +
        'const results = await Promise.allSettled(tasks); // never throws\n' +
        'const fastest = await Promise.race([fetchData(), timeout(5000)]);',
        'javascript', 'Promise combinators'
      )
    ]),
    sub('Timers & this in Callbacks', [
      desc('setTimeout(fn, ms) schedules one macrotask after a MINIMUM delay (even 0 is a few ms once the stack clears); setInterval repeats; clearTimeout/clearInterval cancel (always clean up to avoid leaks). Timers are not precise. A regular function passed to a timer loses this — use an arrow to keep the enclosing this. Prefer requestAnimationFrame for animation.'),
      code(
        'class Poller {\n' +
        '  count = 0;\n' +
        '  start() {\n' +
        '    this.id = setInterval(() => { this.count++; }, 1000); // arrow keeps this\n' +
        '  }\n' +
        '  stop() { clearInterval(this.id); }\n' +
        '}',
        'javascript', 'Timers keep this'
      )
    ]),
    sub('Debounce & Throttle', [
      desc('Two rate-limiting patterns you are often asked to implement, both built on a closure over a timer. Debounce delays running until a PAUSE in calls (search input, resize) — reset the timer on every call. Throttle runs at most once per interval (scroll, mousemove). Rule of thumb: debounce = wait for quiet; throttle = steady cap.'),
      code(
        'function debounce(fn, wait) {\n' +
        '  let t;\n' +
        '  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };\n' +
        '}\n' +
        'function throttle(fn, limit) {\n' +
        '  let ready = true;\n' +
        '  return (...args) => {\n' +
        '    if (!ready) return;\n' +
        '    ready = false; fn(...args);\n' +
        '    setTimeout(() => (ready = true), limit);\n' +
        '  };\n' +
        '}',
        'javascript', 'Implement both'
      )
    ])
  ]
};

// ============================ EXPERT: Advanced & Modern ES ============================
stOrder = 0;
const jsAdvanced = {
  title: 'JavaScript Advanced & Modern ES',
  description: 'ES Modules vs CommonJS, iterators & generators, Map/Set/WeakMap, Symbols, functional programming, memory & garbage collection, design patterns, Proxy/Reflect and event delegation.',
  difficultyLevel: 'expert',
  languagePlatform: 'javascript',
  order: 5,
  subtopics: [
    sub('ES Modules vs CommonJS', [
      desc('ES Modules (import/export) are the standard: static (analysable at parse time, enabling tree-shaking), asynchronous, with live bindings and strict mode by default; used in browsers (type="module") and modern Node. CommonJS (require/module.exports) is Node original system: dynamic, synchronous, value copies. Know named vs default exports and the interop caveats between the two.'),
      code(
        '// ESM\n' +
        'export const add = (a, b) => a + b;\n' +
        'export default class App {}\n' +
        'import App, { add } from "./app.js";\n\n' +
        '// CommonJS\n' +
        'const add = (a, b) => a + b;\n' +
        'module.exports = { add };\n' +
        'const { add } = require("./app");',
        'javascript', 'import/export vs require'
      )
    ]),
    sub('Iterators & Generators', [
      desc('An iterable implements Symbol.iterator returning an iterator whose next() yields { value, done }; this powers for...of, spread and destructuring (arrays, strings, Map, Set are iterable). Generators (function*) pause and resume with yield, producing LAZY sequences and simplifying custom iterators and async flows. They can also receive a value back via next(arg).'),
      code(
        'function* range(start, end) {\n' +
        '  for (let i = start; i < end; i++) yield i;\n' +
        '}\n' +
        '[...range(1, 4)]; // [1, 2, 3]\n' +
        'for (const n of range(0, 3)) console.log(n);\n\n' +
        'const gen = range(0, 2);\n' +
        'gen.next(); // { value: 0, done: false }',
        'javascript', 'Lazy sequences'
      )
    ]),
    sub('Map, Set, WeakMap & WeakSet', [
      desc('Map holds ANY key type (objects included), preserves insertion order, exposes size, and outperforms plain objects for frequent add/delete. Set stores UNIQUE values (great for dedupe). WeakMap/WeakSet hold keys WEAKLY — entries disappear when the key is garbage-collected — ideal for private data and caches without leaks. Prefer a Map over an object for dynamic/non-string keys, ordering, or frequent mutation.'),
      code(
        'const seen = new Set([1, 2, 2, 3]); // {1, 2, 3}\n' +
        'const unique = [...new Set(arr)];   // dedupe idiom\n\n' +
        'const cache = new WeakMap();\n' +
        'cache.set(domNode, data); // auto-cleared when domNode is GC-ed',
        'javascript', 'Keyed collections'
      )
    ]),
    sub('Symbols', [
      desc('Symbol() creates a unique, immutable primitive often used as a non-colliding object key (hidden from for...in and Object.keys; found via Object.getOwnPropertySymbols). Well-known symbols customise language behaviour: Symbol.iterator (make an object iterable), Symbol.asyncIterator, Symbol.toPrimitive. Symbol.for() uses a global registry for shared symbols.'),
      code(
        'const id = Symbol("id");\n' +
        'const user = { [id]: 123, name: "Al" };\n' +
        'Object.keys(user); // ["name"] — symbol key hidden\n\n' +
        'const range = { *[Symbol.iterator]() { yield 1; yield 2; } };\n' +
        '[...range]; // [1, 2]',
        'javascript', 'Unique keys & protocols'
      )
    ]),
    sub('Functional Programming: Currying & Composition', [
      desc('JS has first-class functions, so you can pass, return and compose them. Pure functions (no side effects; same input to same output) are easy to test and cache. Currying turns f(a, b, c) into f(a)(b)(c) for reusable partial application. Composition pipes small functions (compose right-to-left, pipe left-to-right). Immutability plus higher-order functions underpin Redux/RxJS-style code.'),
      code(
        'const curry = fn => a => b => fn(a, b);\n' +
        'const add = curry((a, b) => a + b);\n' +
        'add(2)(3); // 5\n\n' +
        'const pipe = (...fns) => x => fns.reduce((v, f) => f(v), x);\n' +
        'const clean = pipe(s => s.trim(), s => s.toLowerCase());\n' +
        'clean("  HI "); // "hi"',
        'javascript', 'Curry & pipe'
      )
    ]),
    sub('Memory Management & Garbage Collection', [
      desc('JS reclaims memory automatically with a mark-and-sweep garbage collector: objects reachable from roots (globals, the stack, closures) are kept; unreachable ones are freed. Common LEAKS: forgotten timers/intervals, detached DOM nodes still referenced, ever-growing global caches, and closures holding large data. Fix with cleanup (clearInterval, removeEventListener), WeakMap/WeakSet caches, and dropping references.'),
      code(
        '// leak: the listener + closure keep hugeData alive forever\n' +
        'function attach() {\n' +
        '  const hugeData = new Array(1e6).fill("x");\n' +
        '  el.addEventListener("click", () => use(hugeData));\n' +
        '}\n' +
        '// fix: removeEventListener when done, or avoid capturing large data',
        'javascript', 'Avoiding leaks'
      )
    ]),
    sub('Common Design Patterns', [
      desc('Patterns worth naming in interviews: Module/IIFE (encapsulate private state — now largely ES modules), Singleton (one shared instance), Factory (create objects without scattering new), Observer/Pub-Sub (event emitters, RxJS) and Prototype. Recognising them signals architectural maturity; modern JS expresses them with closures, classes and modules.'),
      code(
        '// Pub/Sub (Observer)\n' +
        'function createEmitter() {\n' +
        '  const subs = {};\n' +
        '  return {\n' +
        '    on(evt, fn) { (subs[evt] ??= []).push(fn); },\n' +
        '    emit(evt, data) { (subs[evt] || []).forEach(fn => fn(data)); },\n' +
        '  };\n' +
        '}',
        'javascript', 'Observer pattern'
      )
    ]),
    sub('Proxy & Reflect (Metaprogramming)', [
      desc('A Proxy wraps an object and intercepts fundamental operations (get, set, has, deleteProperty and more) through a handler, enabling validation, reactivity (the core of Vue 3), logging and defaults. Reflect provides the default behaviours (Reflect.get/set) to call from traps cleanly. Powerful, but it adds overhead — use it deliberately.'),
      code(
        'const safe = new Proxy({}, {\n' +
        '  get(target, key) {\n' +
        '    return key in target ? Reflect.get(target, key) : `[no ${String(key)}]`;\n' +
        '  },\n' +
        '});\n' +
        'safe.name; // "[no name]"',
        'javascript', 'Intercept operations'
      )
    ]),
    sub('Event Delegation & the Event Model', [
      desc('DOM events flow in phases: capture (top to target), target, then bubble (target back to top). Event delegation attaches ONE listener on a common ancestor and uses event.target to handle events from many children — efficient for dynamic lists and fewer listeners. stopPropagation halts bubbling; preventDefault cancels the default action; passive listeners improve scroll performance.'),
      code(
        'document.querySelector("#list").addEventListener("click", (e) => {\n' +
        '  const li = e.target.closest("li");\n' +
        '  if (li) select(li.dataset.id); // handles current AND future items\n' +
        '});',
        'javascript', 'One listener, many items'
      )
    ])
  ]
};

const jsTopics = [jsFundamentals, jsCore, jsAsync, jsAdvanced];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // 1) Ensure the JavaScript language tab exists (idempotent; usually already there).
    const existingTab = await LanguageTab.findOne({ code: 'javascript' });
    if (existingTab) {
      console.log('JavaScript language tab already exists - leaving it in place.');
    } else {
      const maxOrder = await LanguageTab.find().sort({ order: -1 }).limit(1);
      const nextOrder = maxOrder.length ? maxOrder[0].order + 1 : 3;
      await LanguageTab.create({ name: 'JavaScript', code: 'javascript', order: nextOrder, isActive: true });
      console.log('Created JavaScript language tab (order ' + nextOrder + ').');
    }

    // 2) Remove ONLY the topics this script seeds (by exact title) so re-runs never
    //    duplicate. "JavaScript Fundamentals" differs from the seed.js "JavaScript
    //    Basics" sample, so that sample is left untouched.
    const seededTitles = jsTopics.map(t => t.title);
    const removed = await Topic.deleteMany({ title: { $in: seededTitles } });
    console.log('Removed ' + removed.deletedCount + ' previously seeded JS interview topics.');

    // 3) Insert fresh topics
    await Topic.insertMany(jsTopics);
    console.log('Inserted ' + jsTopics.length + ' JavaScript interview topics (one per level):');
    jsTopics.forEach(t => console.log('  - [' + t.difficultyLevel + '] ' + t.title + ' (' + t.subtopics.length + ' subtopics)'));

    console.log('\nDone. Open the JavaScript tab and browse Beginner / Intermediate / Advance / Expert.');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

seed();
