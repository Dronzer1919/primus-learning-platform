/*
 * Idempotent seed for the "Angular" and "Node.js" language tabs.
 * Adds both tabs and imports a structured subset of the Angular and Node.js
 * interview-prep PDFs as Topics (Angular PDF -> Angular tab, Node.js PDF ->
 * Node.js tab), grouped by difficulty level.
 *
 * Run with:  node seed-interview-content.js
 * Safe to re-run: it removes previously seeded topics (matched by title) first.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const LanguageTab = require('./src/models/LanguageTab');
const Topic = require('./src/models/Topic');

// ---- content-block helpers ----
let blockOrder = 0;
const desc = (text) => ({ type: 'description', order: blockOrder++, data: { text } });
const code = (codeStr, language = 'typescript', title = '') => ({
  type: 'code',
  order: blockOrder++,
  data: { language, code: codeStr, title }
});
const image = (url, alt, caption = '') => ({
  type: 'image',
  order: blockOrder++,
  data: { url, alt, caption }
});
// build a subtopic; resets block order per subtopic
let stOrder = 0;
const sub = (title, blocks) => {
  blockOrder = 0;
  return { title, order: stOrder++, content: blocks };
};

// ---- RxJS marble-diagram generator (self-contained SVG data URI, no external files) ----
// A marble is { at: 0..1 (position along the timeline), label, color } or { at, complete: true }.
const MB_X0 = 40, MB_X1 = 630, MB_SPAN = MB_X1 - MB_X0;
function mbLine(y) {
  return `<line x1="${MB_X0}" y1="${y}" x2="${MB_X1}" y2="${y}" stroke="#334155" stroke-width="2"/>` +
    `<polygon points="${MB_X1},${y - 6} ${MB_X1 + 12},${y} ${MB_X1},${y + 6}" fill="#334155"/>`;
}
function mbMarble(m, y) {
  const cx = MB_X0 + m.at * MB_SPAN;
  if (m.complete) {
    // vertical bar = the stream completes
    return `<line x1="${cx}" y1="${y - 18}" x2="${cx}" y2="${y + 18}" stroke="#0f172a" stroke-width="3"/>`;
  }
  return `<circle cx="${cx}" cy="${y}" r="17" fill="${m.color}" stroke="#0f172a" stroke-width="1.5"/>` +
    `<text x="${cx}" y="${y + 5}" text-anchor="middle" font-size="14" fill="#ffffff" font-family="Arial">${m.label}</text>`;
}
function mbLabel(text, y) {
  return `<text x="${MB_X0}" y="${y}" font-size="14" fill="#475569" font-family="Arial">${text}</text>`;
}
function mbBox(opLabel, opColor, y) {
  return `<rect x="140" y="${y - 22}" width="400" height="44" rx="12" fill="#f5f3ff" stroke="${opColor}" stroke-width="2"/>` +
    `<text x="340" y="${y + 6}" text-anchor="middle" font-size="16" fill="${opColor}" font-family="Consolas, monospace">${opLabel}</text>`;
}
function svgUri(W, H, body) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="${W}" height="${H}" fill="#ffffff"/>` + body + `</svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}
// One input stream -> operator -> one output stream
function marbleDiagram(opLabel, inputMarbles, outputMarbles, opColor = '#7c3aed') {
  const inY = 54, opY = 122, outY = 190;
  return svgUri(680, 240,
    mbLabel('input', 30) + mbLine(inY) + inputMarbles.map((m) => mbMarble(m, inY)).join('') +
    mbBox(opLabel, opColor, opY) +
    mbLabel('output', outY - 26) + mbLine(outY) + outputMarbles.map((m) => mbMarble(m, outY)).join('')
  );
}
// Two input streams -> operator -> one output stream (forkJoin, combineLatest)
function marbleDiagram2(opLabel, streamA, streamB, outputMarbles, opColor = '#0891b2') {
  const aY = 44, bY = 96, opY = 150, outY = 210;
  return svgUri(680, 260,
    mbLabel('A', aY - 22) + mbLine(aY) + streamA.map((m) => mbMarble(m, aY)).join('') +
    mbLabel('B', bY - 22) + mbLine(bY) + streamB.map((m) => mbMarble(m, bY)).join('') +
    mbBox(opLabel, opColor, opY) +
    mbLabel('output', outY - 26) + mbLine(outY) + outputMarbles.map((m) => mbMarble(m, outY)).join('')
  );
}
const BLUE = '#2563eb', GREEN = '#16a34a', AMBER = '#d97706', RED = '#dc2626', GRAY = '#64748b', PURPLE = '#7c3aed', CYAN = '#0891b2';

// ============================ ANGULAR ============================
stOrder = 0;
const angularFundamentals = {
  title: 'Angular Fundamentals',
  description: 'Architecture, components, data binding, directives, pipes and component communication.',
  difficultyLevel: 'beginner',
  languagePlatform: 'angular',
  order: 1,
  subtopics: [
    sub('What is Angular?', [
      desc('Angular is a TypeScript-based, open-source front-end framework by Google for building scalable single-page applications. It ships routing, HTTP, forms, animations and testing out of the box, unlike React which is a UI library you assemble yourself. Created by Google (Misko Hevery), released 2016 as a rewrite of AngularJS. Releases every 6 months (Angular 2 -> Angular 19).')
    ]),
    sub('Angular Architecture', [
      desc('An Angular app is a hierarchy of Components (TS class + HTML template + scoped CSS), organised into NgModules or Standalone Components, wired together by Dependency Injection. Services hold business logic, the Router maps URLs to components, and HttpClient talks to REST APIs returning RxJS Observables. Change Detection keeps the DOM in sync with component state.')
    ]),
    sub('Components', [
      desc('A component controls a view. Standalone components (default in Angular 17+) declare their own dependencies via imports[] and need no NgModule.'),
      code(
        '@Component({\n' +
        "  selector: 'app-user-card',\n" +
        '  standalone: true,\n' +
        '  imports: [CommonModule, UserAvatarComponent],\n' +
        '  template: `@for (user of users; track user.id) { <app-user-avatar [user]="user" /> }`,\n' +
        '})\n' +
        'export class UserCardComponent {\n' +
        '  private userService = inject(UserService);\n' +
        '  users = signal<User[]>([]);\n' +
        '}',
        'typescript', 'Standalone component'
      )
    ]),
    sub('Data Binding (4 types)', [
      desc('Interpolation {{ }} and property binding [x] flow data Component -> Template. Event binding (click) flows Template -> Component. Two-way [(ngModel)] does both and equals [ngModel] + (ngModelChange).'),
      code(
        '<h1>{{ user.name }}</h1>              <!-- Interpolation -->\n' +
        '<img [src]="user.avatar">             <!-- Property binding -->\n' +
        '<button (click)="deleteUser(user.id)">Delete</button>  <!-- Event -->\n' +
        '<input [(ngModel)]="searchTerm">      <!-- Two-way -->',
        'html', 'The 4 bindings'
      )
    ]),
    sub('Directives', [
      desc('Structural directives add/remove DOM (*ngIf, *ngFor). Attribute directives change appearance/behaviour (ngClass, ngStyle). Angular 17 introduced built-in control flow @if/@for/@switch that replaces the structural directives and requires track in @for.'),
      code(
        '@if (isLoggedIn) { <p>Welcome!</p> } @else { <p>Login</p> }\n' +
        '@for (item of items; track item.id; let i = $index) { <li>{{ item.name }}</li> }\n' +
        "@switch (status) { @case ('active') { <span>Active</span> } @default { <span>?</span> } }",
        'html', 'New control flow'
      )
    ]),
    sub('Pipes', [
      desc('Pipes are transformation functions used in templates (date, currency, async, json). Pure pipes (default) only re-run when the input reference changes and are memoized; impure pipes (pure:false, e.g. async) run every change-detection cycle.'),
      code(
        "@Pipe({ name: 'truncate', standalone: true })\n" +
        'export class TruncatePipe implements PipeTransform {\n' +
        "  transform(value: string, limit = 80, trail = '...'): string {\n" +
        "    if (!value) return '';\n" +
        '    return value.length > limit ? value.substring(0, limit) + trail : value;\n' +
        '  }\n' +
        '}',
        'typescript', 'Custom pipe'
      )
    ]),
    sub('@Input & @Output', [
      desc('@Input() passes data Parent -> Child via [prop] binding. @Output() with EventEmitter sends events Child -> Parent via (event). Angular 17.1+ adds signal-based input()/input.required() and output().'),
      code(
        'export class ProductCardComponent {\n' +
        '  @Input() product!: Product;                 // classic input\n' +
        '  user = input.required<User>();              // signal input (17.1+)\n' +
        '  @Output() cartAdded = new EventEmitter<Product>();\n' +
        '  selected = output<Product>();               // signal output (17.3+)\n' +
        '  add() { this.cartAdded.emit(this.product); }\n' +
        '}',
        'typescript', 'Parent/child communication'
      )
    ])
  ]
};

stOrder = 0;
const angularServicesDi = {
  title: 'Angular Services, DI & Change Detection',
  description: 'Services, dependency injection hierarchy, lifecycle hooks, change detection and ViewChild.',
  difficultyLevel: 'intermediate',
  languagePlatform: 'angular',
  order: 2,
  subtopics: [
    sub('Services & Shared State', [
      desc('A service is an @Injectable class holding business logic, HTTP calls, caching and shared state. providedIn:"root" makes it an app-wide singleton and tree-shakeable. A BehaviorSubject inside a service is a common way to share state between unrelated components.'),
      code(
        "@Injectable({ providedIn: 'root' })\n" +
        'export class CartService {\n' +
        '  private cartItems = new BehaviorSubject<CartItem[]>([]);\n' +
        '  readonly cartItems$ = this.cartItems.asObservable();\n' +
        '  addItem(p: Product) { this.cartItems.next([...this.cartItems.getValue(), { ...p, qty: 1 }]); }\n' +
        '}',
        'typescript', 'Shared service'
      )
    ]),
    sub('Dependency Injection', [
      desc('DI supplies a class its dependencies instead of using "new". Use constructor injection or the inject() function (Angular 14+). Providers tell Angular HOW to build a dependency: useClass, useValue, useFactory, useExisting. Never call "new MyService()" in a component.'),
      code(
        'export class UserComponent {\n' +
        '  private userService = inject(UserService);   // functional DI\n' +
        '  private router = inject(Router);\n' +
        '}\n' +
        "// Custom providers\n" +
        '{ provide: API_URL, useValue: "https://api.example.com" }\n' +
        '{ provide: UserService, useClass: MockUserService }  // testing',
        'typescript', 'inject() and providers'
      )
    ]),
    sub('DI Hierarchy', [
      desc('Angular resolves a dependency by walking UP the injector tree: Element -> Component -> Module -> Root -> Platform -> NullInjector (throws if not found). providedIn:"root" gives an app-wide singleton; a component providers[] array creates a NEW instance per component subtree.')
    ]),
    sub('Tree Shaking & Lazy Loading', [
      desc('Tree shaking removes unused code; providedIn:"root" services are only bundled if actually injected. Lazy loading splits code by route with loadComponent()/loadChildren(), improving initial load. Preloading background-loads lazy routes after first render.'),
      code(
        'const routes: Routes = [\n' +
        "  { path: '', component: HomeComponent },\n" +
        "  { path: 'admin', loadComponent: () => import('./admin/admin.component').then(c => c.AdminComponent) },\n" +
        "  { path: 'shop', loadChildren: () => import('./shop/shop.routes').then(r => r.SHOP_ROUTES) },\n" +
        '];',
        'typescript', 'Lazy routes'
      )
    ]),
    sub('Lifecycle Hooks', [
      desc('Order: ngOnChanges -> ngOnInit -> ngDoCheck -> ngAfterContentInit -> ngAfterContentChecked -> ngAfterViewInit -> ngAfterViewChecked -> ngOnDestroy. Constructor is for DI only; fetch data in ngOnInit (inputs are ready). Clean up subscriptions in ngOnDestroy to avoid memory leaks.'),
      code(
        'export class UserComponent implements OnInit, OnDestroy {\n' +
        '  private destroy$ = new Subject<void>();\n' +
        '  ngOnInit() {\n' +
        '    this.svc.updates$.pipe(takeUntil(this.destroy$)).subscribe(u => this.handle(u));\n' +
        '  }\n' +
        '  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }\n' +
        '}',
        'typescript', 'takeUntil cleanup'
      )
    ]),
    sub('Change Detection: Default vs OnPush', [
      desc('Default CD checks every component on any async event (via Zone.js). OnPush only checks a component when an @Input reference changes, an event fires in it, an async pipe emits, or a signal changes. OnPush needs immutable updates ([...arr], not arr.push) and is dramatically faster for large trees.'),
      code(
        '@Component({\n' +
        '  changeDetection: ChangeDetectionStrategy.OnPush,\n' +
        '})\n' +
        'export class UserListComponent {\n' +
        '  @Input() users: User[] = [];\n' +
        '  private cdr = inject(ChangeDetectorRef);\n' +
        '  refresh() { this.cdr.markForCheck(); }\n' +
        '}',
        'typescript', 'OnPush'
      )
    ]),
    sub('ViewChild & Content Projection', [
      desc('@ViewChild queries elements/components in the OWN template (available in ngAfterViewInit). @ContentChild queries projected content (available in ngAfterContentInit). ng-content projects HTML from the parent into a wrapper component (cards, modals, tabs) using named slots via select=[attr].'),
      code(
        '<!-- card.component template -->\n' +
        "<div class='card'>\n" +
        "  <ng-content select='[card-header]'></ng-content>\n" +
        '  <ng-content></ng-content>  <!-- default slot -->\n' +
        '</div>',
        'html', 'ng-content slots'
      )
    ])
  ]
};

stOrder = 0;
const angularAdvanced = {
  title: 'Angular Advanced & Modern (17/18/19)',
  description: 'Standalone, guards, interceptors, reactive forms, signals, SSR, @defer and new control flow.',
  difficultyLevel: 'advance',
  languagePlatform: 'angular',
  order: 3,
  subtopics: [
    sub('Standalone & Bootstrapping', [
      desc('Standalone components have no NgModule and declare dependencies in imports[]. Bootstrap with bootstrapApplication(AppComponent, { providers: [...] }) providing router, http client and animations functionally.'),
      code(
        'bootstrapApplication(AppComponent, {\n' +
        '  providers: [\n' +
        '    provideRouter(routes, withComponentInputBinding()),\n' +
        '    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),\n' +
        '  ]\n' +
        '});',
        'typescript', 'main.ts'
      )
    ]),
    sub('Route Guards', [
      desc('Functional guards (Angular 14.2+) use inject() inside. canActivate (enter route), canActivateChild, canDeactivate (leave route / unsaved changes), canMatch (match URL), resolve (pre-fetch data). Return boolean or a UrlTree to redirect.'),
      code(
        'export const authGuard: CanActivateFn = (route, state) => {\n' +
        '  const auth = inject(AuthService);\n' +
        '  const router = inject(Router);\n' +
        '  if (auth.isLoggedIn()) return true;\n' +
        "  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });\n" +
        '};',
        'typescript', 'authGuard'
      )
    ]),
    sub('HTTP Interceptors', [
      desc('Interceptors are HTTP middleware for cross-cutting concerns: auth tokens, error handling, loading spinners, retry, logging. Requests are immutable, so clone them. Register with provideHttpClient(withInterceptors([...])).'),
      code(
        'export const authInterceptor: HttpInterceptorFn = (req, next) => {\n' +
        '  const token = inject(AuthService).getAccessToken();\n' +
        '  const authReq = token\n' +
        "    ? req.clone({ setHeaders: { Authorization: 'Bearer ' + token } })\n" +
        '    : req;\n' +
        '  return next(authReq);\n' +
        '};',
        'typescript', 'authInterceptor'
      )
    ]),
    sub('Reactive Forms', [
      desc('Reactive forms define structure in the component with FormGroup/FormControl/FormArray, powerful composable Validators and asyncValidators. Better than template-driven forms for complex, dynamic, testable forms. FormArray manages an ordered list of controls for dynamic add/remove.'),
      code(
        'form = this.fb.group({\n' +
        "  name: ['', [Validators.required, Validators.minLength(2)]],\n" +
        "  email: ['', [Validators.required, Validators.email]],\n" +
        "  password: ['', [Validators.required, Validators.minLength(8)]],\n" +
        '}, { validators: this.passwordMatchValidator });',
        'typescript', 'FormBuilder group'
      )
    ]),
    sub('Signals', [
      desc('A Signal is a reactive wrapper around a value. Reading registers a dependency; writing notifies consumers, so only components that read it re-render. computed() derives read-only signals; effect() runs side effects. Signals are synchronous, need no subscribe/unsubscribe and enable zoneless Angular.'),
      code(
        'items = signal<CartItem[]>([]);\n' +
        'total = computed(() => this.items().reduce((s, i) => s + i.price * i.qty, 0));\n' +
        'addItem(i: CartItem) { this.items.update(cur => [...cur, i]); }\n' +
        'clear() { this.items.set([]); }',
        'typescript', 'signal / computed / update'
      )
    ]),
    sub('SSR & Hydration', [
      desc('SSR renders full HTML on the server for SEO and fast First Contentful Paint. Hydration (stable in Angular 17) attaches to existing server DOM instead of re-rendering, removing content flash. Setup: ng add @angular/ssr, provideClientHydration(), provideHttpClient(withFetch()). Guard browser-only code with isPlatformBrowser(PLATFORM_ID).')
    ]),
    sub('@defer (Deferrable Views)', [
      desc('@defer lazily loads a subtree of components as a separate JS chunk until a trigger fires: on viewport, on idle, on interaction, on hover, on timer, on immediate, or when <condition>. Blocks: @loading, @error, @placeholder. Great for below-the-fold and heavy components.'),
      code(
        '@defer (on viewport) {\n' +
        '  <app-sales-chart [data]="chartData" />\n' +
        '} @loading (minimum 500ms) {\n' +
        "  <div class='skeleton'></div>\n" +
        '} @placeholder {\n' +
        "  <div class='placeholder'>Chart will appear here</div>\n" +
        '}',
        'html', '@defer'
      )
    ]),
    sub('New Control Flow', [
      desc('@if/@for/@switch replace *ngIf/*ngFor/*ngSwitch: cleaner, no ng-template for else, and @for REQUIRES track. @for exposes $index, $count, $first, $last, $even, $odd implicitly, and @empty handles empty lists.'),
      code(
        '@for (product of products; track product.id; let last = $last) {\n' +
        '  <app-product-card [product]="product" [class.last]="last" />\n' +
        '} @empty {\n' +
        '  <p>No products found.</p>\n' +
        '}',
        'html', '@for with @empty'
      )
    ])
  ]
};

stOrder = 0;
const angularRxjsNgrx = {
  title: 'Angular NgRx & Performance',
  description: 'NgRx Redux pattern, performance optimisation, PWA and micro frontends. (RxJS operators now live in the dedicated RxJS tab.)',
  difficultyLevel: 'expert',
  languagePlatform: 'angular',
  order: 4,
  subtopics: [
    sub('NgRx (Redux pattern)', [
      desc('NgRx implements Redux with RxJS: single immutable Store, Actions (events), Reducers (pure (state, action) => newState), Selectors (memoized queries) and Effects (async side effects). Flow: dispatch(Action) -> Effect -> Reducer -> Store -> Selector -> component via async pipe. Use for large apps with complex shared state; overkill for small apps (use services + signals).'),
      code(
        'loadUsers$ = createEffect(() =>\n' +
        '  this.actions$.pipe(\n' +
        '    ofType(loadUsers),\n' +
        '    switchMap(() => this.userService.getUsers().pipe(\n' +
        '      map(users => loadUsersSuccess({ users })),\n' +
        '      catchError(err => of(loadUsersFailure({ error: err.message })))\n' +
        '    ))\n' +
        '  )\n' +
        ');',
        'typescript', 'NgRx effect'
      )
    ]),
    sub('Performance Optimization', [
      desc('Combine: OnPush + Signals + @defer + lazy routes + track/trackBy + async pipe + pure pipes + NgOptimizedImage (ngSrc) + CDK Virtual Scroll for huge lists. Angular 17+ uses esbuild for 2-10x faster builds. Analyse bundles with ng build --stats-json + webpack-bundle-analyzer.'),
      code(
        "<cdk-virtual-scroll-viewport itemSize='64' style='height:400px'>\n" +
        '  @for (item of items; track item.id) { <app-item [data]="item" /> }\n' +
        '</cdk-virtual-scroll-viewport>',
        'html', 'Virtual scroll'
      )
    ]),
    sub('PWA & Micro Frontends', [
      desc('PWA: ng add @angular/pwa adds a service worker (ngsw-worker.js) + manifest for install, offline caching (performance/cache-first for assets, freshness/network-first for API) and push notifications (SwPush), updates via SwUpdate. Micro Frontends split a large app into independently deployable apps via Webpack Module Federation or Native Federation, sharing Angular/RxJS to avoid duplicate copies.')
    ])
  ]
};

// ============================ NODE.JS ============================
stOrder = 0;
const nodeBasics = {
  title: 'Node.js Basics & JavaScript Concepts',
  description: 'What Node.js is, the V8 engine, and core JS concepts: execution context, call stack, hoisting, closures and this.',
  difficultyLevel: 'beginner',
  languagePlatform: 'nodejs',
  order: 1,
  subtopics: [
    sub('What is Node.js?', [
      desc('Node.js is an open-source, cross-platform JavaScript runtime that runs JS outside the browser by embedding the V8 engine in a C++ program. It uses an event-driven, non-blocking I/O model, so it handles thousands of concurrent connections efficiently without a thread per request. Created by Ryan Dahl (2009); package manager is npm.')
    ]),
    sub('V8 Engine', [
      desc('V8 is Google\'s C++ JavaScript engine (Chrome, Node.js). It JIT-compiles JS to native machine code: Parser -> AST -> Ignition (bytecode interpreter, fast startup) -> TurboFan (optimises hot functions to machine code). Garbage collection is Orinoco (generational, incremental, parallel).')
    ]),
    sub('How Node.js Works Internally', [
      desc('Node combines V8 with libuv (a C library providing the event loop, thread pool and OS async abstractions). Async ops (fs.readFile, http.get, setTimeout) register callbacks; libuv delegates file I/O to a thread pool and network I/O to the OS kernel (epoll/kqueue/IOCP). When an op completes its callback is queued and the event loop runs it on the single main JS thread. So Node is single-threaded for JS, multi-threaded at the C level.')
    ]),
    sub('Advantages & When NOT to use', [
      desc('Strengths: non-blocking async I/O (10k+ connections), same language front and back, huge npm ecosystem, great for I/O-bound APIs/real-time/streaming. Avoid Node for CPU-heavy work (video transcoding, ML, heavy math) because a long CPU task blocks the single-threaded event loop; use Go/Java/Python there.')
    ]),
    sub('Execution Context', [
      desc('An Execution Context is the environment code runs in. Global EC is created once (global object is "global" in Node). A Function EC is created on each call with its own variable environment and this. Creation phase hoists variables/functions; execution phase runs code line by line assigning values.')
    ]),
    sub('Call Stack', [
      desc('The call stack is a LIFO structure tracking the currently executing function. Node has a single call stack (single-threaded). Infinite recursion without a base case overflows it: "RangeError: Maximum call stack size exceeded". Fix with a base case, iteration, or setImmediate() to yield.'),
      code(
        "function third() { console.log('Inside third'); }\n" +
        'function second() { third(); }\n' +
        'function first() { second(); }\n' +
        'first(); // stack: first -> second -> third, then pops back',
        'javascript', 'Call stack'
      )
    ]),
    sub('Hoisting', [
      desc('Declarations are hoisted to the top of their scope. var is hoisted as undefined (no error). let/const are hoisted but sit in the Temporal Dead Zone until declared (accessing them throws ReferenceError). Function declarations are fully hoisted; function expressions/arrow functions follow their variable rules.'),
      code(
        'console.log(x); // undefined (var hoisted)\n' +
        'var x = 5;\n' +
        '// console.log(y); // ReferenceError - TDZ\n' +
        'let y = 10;\n' +
        "greet(); // works - function declaration fully hoisted\n" +
        "function greet() { console.log('Hello'); }",
        'javascript', 'Hoisting'
      )
    ]),
    sub('Closures', [
      desc('A closure is a function that remembers variables from its lexical scope even after the outer function returns. Closures power Node patterns: private data/encapsulation, callbacks that remember context, factory functions and the module pattern.'),
      code(
        'function makeCounter() {\n' +
        '  let count = 0;              // private\n' +
        '  return () => { count++; return count; };\n' +
        '}\n' +
        'const counter = makeCounter();\n' +
        'counter(); // 1\n' +
        'counter(); // 2 - count persists',
        'javascript', 'Closure counter'
      )
    ]),
    sub('The "this" Keyword', [
      desc('this depends on HOW a function is called. Method call: the object before the dot. Regular function: global/undefined (strict). Constructor (new): the new instance. Arrow function: inherits this lexically (cannot be re-bound) - use arrows in callbacks like setInterval to keep the enclosing this.'),
      code(
        'class Timer {\n' +
        '  seconds = 0;\n' +
        '  start() {\n' +
        '    setInterval(() => { this.seconds++; }, 1000); // arrow keeps Timer as this\n' +
        '  }\n' +
        '}',
        'javascript', 'Arrow keeps this'
      )
    ])
  ]
};

stOrder = 0;
const nodeEventLoop = {
  title: 'Node.js Event Loop',
  description: 'The event loop, blocking vs non-blocking I/O, its phases, and nextTick vs setImmediate.',
  difficultyLevel: 'intermediate',
  languagePlatform: 'nodejs',
  order: 2,
  subtopics: [
    sub('How the Event Loop Works', [
      desc('The event loop lets single-threaded Node perform non-blocking I/O. It continuously checks whether the call stack is empty and, if so, moves callbacks from the various queues onto the stack. A request is received, async I/O is offloaded to libuv/OS, and when it completes the callback is queued and run by the loop.')
    ]),
    sub('Blocking vs Non-Blocking I/O', [
      desc('Blocking (sync, e.g. fs.readFileSync) waits until the operation finishes - one request can block ALL users; use only at startup. Non-blocking (async, fs.readFile with callback or fs.promises + await) continues immediately and runs a callback later, so thousands of concurrent requests are handled. Non-blocking is the standard server pattern.'),
      code(
        "// NON-BLOCKING\n" +
        "fs.readFile('large.txt', 'utf8', (err, data) => {\n" +
        '  if (err) throw err;\n' +
        '  console.log(data); // runs when ready\n' +
        '});\n' +
        "console.log('runs immediately, without waiting!');",
        'javascript', 'Non-blocking read'
      )
    ]),
    sub('Event Loop Phases', [
      desc('libuv runs 6 phases, each a FIFO callback queue: 1) timers (setTimeout/setInterval), 2) pending callbacks (deferred I/O), 3) idle/prepare (internal), 4) poll (fetch/execute most I/O; blocks here if idle), 5) check (setImmediate), 6) close callbacks (socket close). The microtask queue (process.nextTick, then Promise callbacks) runs BETWEEN every phase.')
    ]),
    sub('process.nextTick vs setImmediate', [
      desc('process.nextTick() runs after the current operation, before the loop continues to the next phase - highest priority, even before Promises and I/O. setImmediate() runs in the check phase, after poll. Inside an I/O callback, setImmediate() always runs before setTimeout(0). Recursive nextTick can starve I/O - use setImmediate to yield.'),
      code(
        "console.log('1: Start');\n" +
        "process.nextTick(() => console.log('2: nextTick'));\n" +
        "Promise.resolve().then(() => console.log('3: Promise'));\n" +
        "setImmediate(() => console.log('4: setImmediate'));\n" +
        "setTimeout(() => console.log('5: setTimeout'), 0);\n" +
        "console.log('6: End');\n" +
        '// Order: 1, 6, 2, 3, then 4/5',
        'javascript', 'Ordering'
      )
    ]),
    sub('Timers, Poll, Check & Close', [
      desc('Timers fire after a MINIMUM delay (even setTimeout(fn,0) is ~1ms) once the loop reaches the timers phase. The poll phase processes most I/O and blocks waiting for events if nothing is pending. The check phase runs setImmediate. Close callbacks handle socket.on("close") and process.on("exit") (sync only).'),
      code(
        "const fs = require('fs');\n" +
        'fs.readFile(__filename, () => {\n' +
        "  setTimeout(() => console.log('timeout'), 0);\n" +
        "  setImmediate(() => console.log('immediate'));\n" +
        '  // inside I/O: immediate -> timeout (check before timers)\n' +
        '});',
        'javascript', 'immediate vs timeout in I/O'
      )
    ])
  ]
};

stOrder = 0;
const nodeAsync = {
  title: 'Node.js Async Patterns',
  description: 'Callbacks, callback hell, Promises, combinators, and async/await with sequential vs parallel execution.',
  difficultyLevel: 'advance',
  languagePlatform: 'nodejs',
  order: 3,
  subtopics: [
    sub('Callbacks (error-first)', [
      desc('A callback runs when an async op completes. Node uses the error-first convention: callback(error, result) - first arg is null on success or an Error on failure. Used across fs, http and older core APIs.'),
      code(
        'function addAsync(a, b, callback) {\n' +
        '  setTimeout(() => {\n' +
        "    if (typeof a !== 'number') return callback(new Error('Not a number'));\n" +
        '    callback(null, a + b);\n' +
        '  }, 100);\n' +
        '}',
        'javascript', 'Error-first callback'
      )
    ]),
    sub('Callback Hell', [
      desc('Nesting dependent callbacks creates deeply indented, hard-to-maintain "pyramid of doom" code. Escape it with: named functions, Promises (chaining), or async/await (cleanest).')
    ]),
    sub('Promises', [
      desc('A Promise represents the eventual result of an async op and is always pending, fulfilled (then), or rejected (catch); finally always runs. In Node 15+ an unhandled rejection crashes the process, so always handle errors.'),
      code(
        'const fetchUser = (id) => new Promise((resolve, reject) => {\n' +
        "  if (!id) return reject(new Error('ID required'));\n" +
        "  setTimeout(() => resolve({ id, name: 'Alice' }), 500);\n" +
        '});\n' +
        'fetchUser(1).then(u => console.log(u.name)).catch(e => console.error(e.message));',
        'javascript', 'Creating a Promise'
      )
    ]),
    sub('Promise Chaining', [
      desc('Each .then() returns a NEW promise, so you can sequence async steps flatly instead of nesting. A single .catch() at the end handles errors from ANY step in the chain.'),
      code(
        'getUser(userId)\n' +
        '  .then(user => getProfile(user.id))\n' +
        '  .then(profile => getOrders(profile.id))\n' +
        "  .then(orders => console.log(orders))\n" +
        "  .catch(err => console.error('Chain failed:', err.message));",
        'javascript', 'Chaining'
      )
    ]),
    sub('Promise Combinators', [
      desc('Promise.all: all must fulfill, runs in parallel, fails fast on first rejection. Promise.allSettled: waits for all, never rejects, returns {status, value/reason}. Promise.any: first fulfilment wins, rejects only if all reject. Promise.race: first to settle wins (great for timeouts).'),
      code(
        'const [user, orders, products] = await Promise.all([\n' +
        '  getUser(1), getOrders(1), getProducts(1)\n' +
        ']); // parallel - total time = slowest',
        'javascript', 'Promise.all'
      )
    ]),
    sub('async / await', [
      desc('async/await is syntactic sugar over Promises (ES2017). An async function always returns a Promise; await pauses it until the Promise settles (non-blocking). Top-level await works in ES Modules. Forgetting await is a silent bug - the variable holds a Promise instead of the value.'),
      code(
        'async function fetchUser(id) {\n' +
        "  const res = await fetch('/api/users/' + id);\n" +
        '  return await res.json();\n' +
        '}',
        'javascript', 'await'
      )
    ]),
    sub('Error Handling with async/await', [
      desc('Wrap awaits in try/catch (with finally for cleanup) and re-throw so callers can handle it. Alternatively .catch() on the call, or a Go-style helper returning [err, data].'),
      code(
        'async function getUser(id) {\n' +
        '  try {\n' +
        "    const res = await fetch('/api/users/' + id);\n" +
        '    if (!res.ok) throw new Error(res.status);\n' +
        '    return await res.json();\n' +
        '  } catch (err) {\n' +
        "    console.error('Failed:', err.message);\n" +
        '    throw err;\n' +
        '  }\n' +
        '}',
        'javascript', 'try/catch'
      )
    ]),
    sub('Sequential vs Parallel', [
      desc('Sequential awaits run one after another (total time = sum) - use when steps depend on each other. Parallel with Promise.all starts all at once (total time = slowest) - use for independent ops. await inside forEach is a common mistake (it does not wait); use for...of (sequential) or Promise.all(map(...)) (parallel).'),
      code(
        '// PARALLEL (~1s instead of 3s)\n' +
        'const [user, orders, products] = await Promise.all([\n' +
        '  getUser(1), getOrders(1), getProducts(1)\n' +
        ']);',
        'javascript', 'Parallel await'
      )
    ])
  ]
};

stOrder = 0;
const nodeArchitecture = {
  title: 'Node.js Architecture Deep Dive',
  description: 'Full runtime architecture, libuv, the thread pool and the complete request lifecycle.',
  difficultyLevel: 'expert',
  languagePlatform: 'nodejs',
  order: 4,
  subtopics: [
    sub('Complete Architecture', [
      desc('Layers: Client -> your JS app (Express routes) -> Node core modules (http, fs, crypto, stream...) -> C/C++ bindings -> V8 (executes JS, JIT, GC) -> libuv (event loop, thread pool, OS async) -> libuv thread pool (4 threads) -> OS kernel (epoll/kqueue/IOCP) -> external resources (DB, files, cloud APIs).')
    ]),
    sub('libuv', [
      desc('libuv is a C library focused on async I/O, created for Node. It provides the single-threaded event loop, a thread pool (default 4, UV_THREADPOOL_SIZE), timers, signals, and OS abstractions (epoll/kqueue/IOCP). Network I/O is delegated to the OS kernel (no thread pool); file I/O uses the thread pool because OS file I/O is not uniformly async.')
    ]),
    sub('Thread Pool', [
      desc('The default 4-thread pool handles fs.readFile, crypto.pbkdf2, crypto.randomBytes, zlib and dns.lookup (getaddrinfo). It is NOT used for http.get, net.connect (OS kernel) or setTimeout (libuv timer heap). Running 5+ crypto.pbkdf2 calls saturates the pool - the extras wait. Increase with UV_THREADPOOL_SIZE before requiring modules.'),
      code(
        "process.env.UV_THREADPOOL_SIZE = '16'; // set before requiring modules\n" +
        "// or: UV_THREADPOOL_SIZE=16 node server.js",
        'javascript', 'Tuning the pool'
      )
    ]),
    sub('Request Lifecycle', [
      desc('1) HTTP request arrives. 2) OS kernel (epoll) detects socket data. 3) libuv poll phase picks up the I/O event. 4) Express handler runs on the main JS thread. 5) Middleware executes. 6) Async DB query is offloaded to thread pool/kernel. 7) Main thread is free to handle OTHER requests. 8) Query completes, callback queued. 9) Event loop runs the callback. 10) res.json() writes to the socket. This is why one thread serves 10k concurrent I/O-bound requests.')
    ])
  ]
};

// ============================ RxJS ============================
stOrder = 0;
const rxjsFundamentals = {
  title: 'RxJS Fundamentals',
  description: 'Observables, how they differ from Promises, and the four kinds of Subject.',
  difficultyLevel: 'beginner',
  languagePlatform: 'rxjs',
  order: 1,
  subtopics: [
    sub('What is RxJS & Observables?', [
      desc('RxJS is a library for reactive programming using Observables - streams of values over time. An Observable is lazy (nothing runs until you subscribe), can emit 0..n values, and completes or errors. You transform streams with pipeable operators and consume them with subscribe (or Angular\'s async pipe, which also unsubscribes for you).'),
      code(
        "import { Observable } from 'rxjs';\n" +
        'const numbers$ = new Observable<number>(subscriber => {\n' +
        '  subscriber.next(1);\n' +
        '  subscriber.next(2);\n' +
        '  subscriber.complete();\n' +
        '});\n' +
        'numbers$.subscribe({ next: v => console.log(v), complete: () => console.log("done") });',
        'typescript', 'A basic Observable'
      )
    ]),
    sub('Observables vs Promises', [
      desc('A Promise resolves ONCE and starts immediately (eager). An Observable can emit MANY values over time, is lazy (starts on subscribe), is cancellable (unsubscribe), and supports a rich operator pipeline (map, filter, debounce...). Use Promises for a single async result; use Observables for streams, cancellation and composition.')
    ]),
    sub('Subjects (Subject / BehaviorSubject / ReplaySubject / AsyncSubject)', [
      desc('A Subject is both an Observable and an observer, so it multicasts to many subscribers - a simple event bus. Subject: late subscribers miss past values. BehaviorSubject: holds the current value and replays the last one to new subscribers (ideal for shared state: auth user, cart, theme). ReplaySubject(n): replays the last n values. AsyncSubject: emits only the final value on complete.'),
      code(
        "import { BehaviorSubject } from 'rxjs';\n" +
        'const cart = new BehaviorSubject<CartItem[]>([]);\n' +
        'const cart$ = cart.asObservable();       // expose read-only\n' +
        'cart.next([...cart.getValue(), item]);   // push new state',
        'typescript', 'BehaviorSubject for shared state'
      )
    ])
  ]
};

stOrder = 0;
const rxjsOperators = {
  title: 'RxJS Operators (with marble diagrams)',
  description: 'Transformation, flattening, time-based and combination operators, illustrated with marble diagrams.',
  difficultyLevel: 'intermediate',
  languagePlatform: 'rxjs',
  order: 2,
  subtopics: [
    sub('Transformation: map, filter, tap', [
      desc('map transforms each emitted value; filter only lets through values matching a predicate; tap runs a side effect (logging, caching) without changing the stream. In a marble diagram the top line is the input stream over time and the bottom line is the output.'),
      image(
        marbleDiagram('map(x -> x * 2)',
          [{ at: 0.12, label: '1', color: BLUE }, { at: 0.4, label: '2', color: BLUE }, { at: 0.68, label: '3', color: BLUE }],
          [{ at: 0.12, label: '2', color: BLUE }, { at: 0.4, label: '4', color: BLUE }, { at: 0.68, label: '6', color: BLUE }],
          BLUE),
        'Marble diagram of the map operator', 'map: every input value is transformed (x -> x*2) and emitted at the same time.'
      ),
      image(
        marbleDiagram('filter(x -> x % 2 === 0)',
          [{ at: 0.1, label: '1', color: GRAY }, { at: 0.34, label: '2', color: GREEN }, { at: 0.58, label: '3', color: GRAY }, { at: 0.8, label: '4', color: GREEN }],
          [{ at: 0.34, label: '2', color: GREEN }, { at: 0.8, label: '4', color: GREEN }],
          GREEN),
        'Marble diagram of the filter operator', 'filter: odd values (grey) are dropped; only even values pass through.'
      )
    ]),
    sub('Flattening: switchMap / mergeMap / concatMap / exhaustMap', [
      desc('These map each value to an inner Observable and flatten the results. switchMap: cancel the previous inner and switch to the latest (search, route nav). mergeMap: run all inners concurrently (parallel requests). concatMap: queue inners in order (sequential, upload queue). exhaustMap: ignore new values until the current inner finishes (login/payment buttons). Mnemonic: Switch=Search, Merge=Multiple, Concat=Caution(ordered), Exhaust=Exclusive.'),
      image(
        marbleDiagram('switchMap(x -> inner$)',
          [{ at: 0.12, label: 'a', color: BLUE }, { at: 0.5, label: 'b', color: RED }],
          [{ at: 0.28, label: 'a1', color: BLUE }, { at: 0.66, label: 'b1', color: RED }, { at: 0.86, label: 'b2', color: RED }],
          '#7c3aed'),
        'Marble diagram of switchMap', "switchMap: when 'b' arrives, 'a's pending inner stream is cancelled and switched to 'b's."
      ),
      image(
        marbleDiagram('mergeMap(x -> inner$)',
          [{ at: 0.1, label: 'a', color: BLUE }, { at: 0.28, label: 'b', color: RED }],
          [{ at: 0.24, label: 'a1', color: BLUE }, { at: 0.42, label: 'b1', color: RED }, { at: 0.58, label: 'a2', color: BLUE }, { at: 0.76, label: 'b2', color: RED }],
          BLUE),
        'Marble diagram of mergeMap', "mergeMap: inner streams run concurrently, so a's and b's results interleave (nothing is cancelled)."
      ),
      image(
        marbleDiagram('concatMap(x -> inner$)',
          [{ at: 0.1, label: 'a', color: BLUE }, { at: 0.28, label: 'b', color: RED }],
          [{ at: 0.22, label: 'a1', color: BLUE }, { at: 0.4, label: 'a2', color: BLUE }, { at: 0.62, label: 'b1', color: RED }, { at: 0.8, label: 'b2', color: RED }],
          GREEN),
        'Marble diagram of concatMap', "concatMap: inner streams are queued in order - b's results wait until a's inner completes."
      ),
      image(
        marbleDiagram('exhaustMap(x -> inner$)',
          [{ at: 0.1, label: 'a', color: BLUE }, { at: 0.34, label: 'b', color: GRAY }, { at: 0.74, label: 'c', color: RED }],
          [{ at: 0.24, label: 'a1', color: BLUE }, { at: 0.42, label: 'a2', color: BLUE }, { at: 0.86, label: 'c1', color: RED }],
          RED),
        'Marble diagram of exhaustMap', "exhaustMap: while a's inner is still active, new value b is ignored; c starts a fresh inner after a completes."
      ),
      code(
        'this.query$.pipe(\n' +
        '  switchMap(term => this.api.search(term))  // cancels the previous request\n' +
        ').subscribe(results => this.results = results);\n\n' +
        '// mergeMap  -> parallel, order not guaranteed\n' +
        '// concatMap -> sequential, order preserved (upload queue)\n' +
        '// exhaustMap-> ignore new while busy (login / pay button)',
        'typescript', 'switchMap for search'
      )
    ]),
    sub('Time-based: debounceTime, throttleTime, distinctUntilChanged', [
      desc('debounceTime(ms) waits for a pause in emissions before emitting the latest value (search inputs). throttleTime(ms) emits at most once per window (scroll/resize). distinctUntilChanged() skips a value if it equals the previous one (avoids duplicate work).'),
      image(
        marbleDiagram('debounceTime(300)',
          [{ at: 0.08, label: 'a', color: AMBER }, { at: 0.18, label: 'b', color: AMBER }, { at: 0.28, label: 'c', color: AMBER }, { at: 0.72, label: 'd', color: AMBER }],
          [{ at: 0.45, label: 'c', color: AMBER }, { at: 0.92, label: 'd', color: AMBER }],
          AMBER),
        'Marble diagram of debounceTime', 'debounceTime: only the last value before a 300ms silence is emitted (c after the burst, then d).'
      )
    ]),
    sub('Combination: combineLatest, forkJoin, startWith', [
      desc('combineLatest emits an array whenever ANY source emits (after each has emitted at least once) - great for combining form state + filters. forkJoin waits for ALL sources to complete and emits their last values (like Promise.all) - great for parallel one-shot requests. startWith seeds the stream with an initial value (e.g. a loading state). In the two-stream diagrams below, the vertical bar means that stream completes.'),
      image(
        marbleDiagram2('forkJoin([A, B])',
          [{ at: 0.15, label: 'a1', color: BLUE }, { at: 0.5, label: 'a2', color: BLUE }, { at: 0.62, complete: true }],
          [{ at: 0.3, label: 'b1', color: RED }, { at: 0.78, complete: true }],
          [{ at: 0.82, label: 'a2,b1', color: CYAN }, { at: 0.9, complete: true }],
          CYAN),
        'Marble diagram of forkJoin', 'forkJoin waits until BOTH streams complete, then emits only their last values [a2, b1] once (like Promise.all).'
      ),
      image(
        marbleDiagram2('combineLatest([A, B])',
          [{ at: 0.12, label: 'a1', color: BLUE }, { at: 0.6, label: 'a2', color: BLUE }],
          [{ at: 0.35, label: 'b1', color: RED }, { at: 0.82, label: 'b2', color: RED }],
          [{ at: 0.35, label: 'a1,b1', color: CYAN }, { at: 0.6, label: 'a2,b1', color: CYAN }, { at: 0.82, label: 'a2,b2', color: CYAN }],
          CYAN),
        'Marble diagram of combineLatest', 'combineLatest emits the latest value of each stream whenever ANY stream emits (after both have emitted once).'
      ),
      code(
        'forkJoin({\n' +
        '  user: this.userService.getUser(id),\n' +
        '  orders: this.orderService.getOrders(id),\n' +
        '}).subscribe(({ user, orders }) => this.render(user, orders));',
        'typescript', 'forkJoin parallel load'
      )
    ]),
    sub('Sharing & lifecycle: shareReplay, takeUntil, takeUntilDestroyed', [
      desc('shareReplay(1) multicasts one source execution and replays the last value to new subscribers (cache a config/HTTP call instead of refetching). takeUntil(notifier$) completes a stream when a notifier emits - the classic ngOnDestroy cleanup. Angular 16+ takeUntilDestroyed() auto-completes when the component is destroyed, so you often need no ngOnDestroy at all.'),
      code(
        "readonly config$ = this.http.get<Config>('/api/config').pipe(shareReplay(1));\n" +
        '// every subscriber shares the SAME response',
        'typescript', 'shareReplay cache'
      )
    ])
  ]
};

stOrder = 0;
const rxjsPatterns = {
  title: 'RxJS Real-World Patterns',
  description: 'Search-as-you-type, parallel loading, error handling/retry and leak-free cleanup.',
  difficultyLevel: 'advance',
  languagePlatform: 'rxjs',
  order: 3,
  subtopics: [
    sub('Search-as-you-type', [
      desc('Combine debounceTime (wait for a pause), distinctUntilChanged (skip repeats), filter (min length) and switchMap (cancel stale requests). This is the canonical RxJS pipeline and a very common interview question.'),
      code(
        'this.searchControl.valueChanges.pipe(\n' +
        '  debounceTime(300),\n' +
        '  distinctUntilChanged(),\n' +
        '  filter(term => term.length >= 2),\n' +
        '  switchMap(term => this.searchService.search(term).pipe(catchError(() => of([])))),\n' +
        '  takeUntilDestroyed()\n' +
        ').subscribe(results => this.results.set(results));',
        'typescript', 'Debounced search'
      )
    ]),
    sub('Parallel loading with forkJoin', [
      desc('When independent requests can run at once, forkJoin fires them in parallel and emits once all complete - total time equals the slowest, not the sum.'),
      code(
        'forkJoin([\n' +
        '  this.userService.getUser(id),\n' +
        '  this.orderService.getOrders(id),\n' +
        '  this.productService.getFeatured(),\n' +
        ']).subscribe(([user, orders, products]) => this.page = { user, orders, products });',
        'typescript', 'forkJoin'
      )
    ]),
    sub('Error handling & retry', [
      desc('catchError intercepts an error and returns a recovery Observable (e.g. of([]) for a fallback), keeping the stream alive. retry({ count, delay }) re-subscribes to the source on error - useful for flaky networks.'),
      code(
        'this.http.get<Data>("/api/data").pipe(\n' +
        '  retry({ count: 2, delay: 1000 }),\n' +
        '  catchError(err => { this.toast(err.message); return of(FALLBACK); })\n' +
        ').subscribe(data => this.data = data);',
        'typescript', 'retry + catchError'
      )
    ]),
    sub('Leak-free cleanup', [
      desc('Every manual subscribe() that outlives the component leaks. Prefer the async pipe (auto-unsubscribes), or use takeUntilDestroyed() (Angular 16+) / the takeUntil(destroy$) pattern to complete streams on destroy.'),
      code(
        'private destroy$ = new Subject<void>();\n' +
        'this.stream$.pipe(takeUntil(this.destroy$)).subscribe(...);\n' +
        'ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }',
        'typescript', 'takeUntil cleanup'
      )
    ])
  ]
};

stOrder = 0;
const rxjsInPractice = {
  title: 'RxJS Operators in Practice',
  description: 'More operators you reach for in real projects: scan, startWith, throttleTime, take/first, withLatestFrom, pairwise, creation and utility operators.',
  difficultyLevel: 'expert',
  languagePlatform: 'rxjs',
  order: 4,
  subtopics: [
    sub('Accumulating state: scan / reduce', [
      desc('scan((acc, value) => newAcc, seed) emits the running accumulator on EVERY emission - perfect for a live cart total, a counter, or building up state from a stream of actions. reduce is the same but emits only once, when the source completes.'),
      image(
        marbleDiagram('scan((acc, x) -> acc + x, 0)',
          [{ at: 0.15, label: '1', color: BLUE }, { at: 0.42, label: '2', color: BLUE }, { at: 0.68, label: '3', color: BLUE }],
          [{ at: 0.15, label: '1', color: PURPLE }, { at: 0.42, label: '3', color: PURPLE }, { at: 0.68, label: '6', color: PURPLE }],
          PURPLE),
        'Marble diagram of scan', 'scan emits the running total after each value (1, 1+2=3, 3+3=6).'
      ),
      code(
        '// live running total of a click stream\n' +
        'this.add$.pipe(\n' +
        '  scan((total, amount) => total + amount, 0)\n' +
        ').subscribe(total => this.total.set(total));',
        'typescript', 'Running total with scan'
      )
    ]),
    sub('Seeding & defaults: startWith', [
      desc('startWith(value) emits one or more values immediately before the source starts - handy for an initial "loading" state, a default filter, or seeding combineLatest so it fires before every source has emitted.'),
      image(
        marbleDiagram('startWith(0)',
          [{ at: 0.35, label: 'a', color: BLUE }, { at: 0.68, label: 'b', color: BLUE }],
          [{ at: 0.06, label: '0', color: GREEN }, { at: 0.35, label: 'a', color: BLUE }, { at: 0.68, label: 'b', color: BLUE }],
          GREEN),
        'Marble diagram of startWith', 'startWith(0) emits 0 up front, then passes through the source values.'
      ),
      code(
        'const state$ = this.data$.pipe(\n' +
        "  map(data => ({ loading: false, data })),\n" +
        "  startWith({ loading: true, data: null })  // show a spinner first\n" +
        ');',
        'typescript', 'Loading state with startWith'
      )
    ]),
    sub('Rate limiting: throttleTime / auditTime / sampleTime', [
      desc('throttleTime(ms) emits the FIRST value then ignores others for the window (good for click/scroll bursts). auditTime(ms) waits the window then emits the LAST value. sampleTime(ms) emits the most recent value on a fixed interval. Compare with debounceTime, which waits for a pause.'),
      image(
        marbleDiagram('throttleTime(300)',
          [{ at: 0.08, label: 'a', color: AMBER }, { at: 0.18, label: 'b', color: AMBER }, { at: 0.28, label: 'c', color: AMBER }, { at: 0.62, label: 'd', color: AMBER }, { at: 0.72, label: 'e', color: AMBER }],
          [{ at: 0.08, label: 'a', color: AMBER }, { at: 0.62, label: 'd', color: AMBER }],
          AMBER),
        'Marble diagram of throttleTime', 'throttleTime emits the first value (a), ignores the rest for 300ms, then emits the next first value (d).'
      )
    ]),
    sub('Taking & stopping: take / takeWhile / first / last', [
      desc('take(n) emits the first n values then completes (auto-unsubscribes). first()/first(pred) take the first (matching) value. takeWhile(pred) emits while the predicate holds then completes. These complete the stream, so they are a clean way to auto-tear-down a subscription.'),
      image(
        marbleDiagram('take(2)',
          [{ at: 0.12, label: 'a', color: BLUE }, { at: 0.34, label: 'b', color: BLUE }, { at: 0.56, label: 'c', color: GRAY }, { at: 0.78, label: 'd', color: GRAY }],
          [{ at: 0.12, label: 'a', color: BLUE }, { at: 0.34, label: 'b', color: BLUE }, { at: 0.4, complete: true }],
          BLUE),
        'Marble diagram of take(2)', 'take(2) emits the first two values then completes (c and d are never delivered).'
      ),
      code(
        '// wait for the first truthy auth state, then stop\n' +
        'this.auth$.pipe(first(user => !!user))\n' +
        '  .subscribe(user => this.init(user));',
        'typescript', 'first() with a predicate'
      )
    ]),
    sub('Combining current values: withLatestFrom / pairwise', [
      desc('withLatestFrom(other$) samples the latest value of another stream WHEN the source emits (e.g. on a save click, grab the current form value) - unlike combineLatest it only fires on the source. pairwise() emits the previous and current value as a pair - great for detecting deltas (scroll direction, value changes).'),
      image(
        marbleDiagram('pairwise()',
          [{ at: 0.15, label: '1', color: BLUE }, { at: 0.42, label: '2', color: BLUE }, { at: 0.68, label: '3', color: BLUE }],
          [{ at: 0.42, label: '1,2', color: CYAN }, { at: 0.68, label: '2,3', color: CYAN }],
          CYAN),
        'Marble diagram of pairwise', 'pairwise() emits [previous, current]; nothing is emitted for the very first value.'
      ),
      code(
        '// on each Save click, take the latest form value\n' +
        'this.save$.pipe(\n' +
        '  withLatestFrom(this.form.valueChanges)\n' +
        ').subscribe(([_, formValue]) => this.api.save(formValue));',
        'typescript', 'withLatestFrom on an action'
      )
    ]),
    sub('Creation operators: of / from / interval / timer / EMPTY', [
      desc('of(...values) emits the given values then completes. from(arrayOrPromise) turns an array, iterable or Promise into a stream. interval(ms) emits 0,1,2,... every ms; timer(delay, period) starts after delay then repeats. EMPTY completes immediately (a no-op stream). These start most RxJS pipelines in real code.'),
      code(
        "of(1, 2, 3).subscribe(console.log);           // 1, 2, 3\n" +
        "from(fetch('/api/data')).subscribe(...);      // Promise -> Observable\n" +
        'timer(0, 5000).pipe(                            // poll every 5s\n' +
        '  switchMap(() => this.api.getStatus())\n' +
        ').subscribe(status => this.status.set(status));',
        'typescript', 'Polling with timer + switchMap'
      )
    ]),
    sub('Utility: tap / finalize / delay / distinctUntilKeyChanged', [
      desc('tap() runs side effects (logging, set loading flag) without touching the values. finalize() runs a callback when the stream completes OR errors OR is unsubscribed - the reliable place to hide a spinner. delay(ms) time-shifts emissions. distinctUntilKeyChanged("id") skips consecutive items whose key is unchanged.'),
      code(
        'this.loading.set(true);\n' +
        'this.api.getData().pipe(\n' +
        '  tap(data => this.cache = data),\n' +
        '  finalize(() => this.loading.set(false))  // always hides the spinner\n' +
        ').subscribe(data => this.data.set(data));',
        'typescript', 'tap + finalize for a loading flag'
      )
    ])
  ]
};

const angularTopics = [angularFundamentals, angularServicesDi, angularAdvanced, angularRxjsNgrx];
const nodeTopics = [nodeBasics, nodeEventLoop, nodeAsync, nodeArchitecture];
const rxjsTopics = [rxjsFundamentals, rxjsOperators, rxjsPatterns, rxjsInPractice];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // 1) Ensure the Angular and Node.js language tabs exist (idempotent)
    const ensureTab = async (code, name) => {
      const existing = await LanguageTab.findOne({ code });
      if (existing) {
        console.log(name + ' language tab already exists - leaving it in place.');
        return;
      }
      const maxOrder = await LanguageTab.find().sort({ order: -1 }).limit(1);
      const nextOrder = maxOrder.length ? maxOrder[0].order + 1 : 6;
      await LanguageTab.create({ name, code, order: nextOrder, isActive: true });
      console.log('Created ' + name + ' language tab (order ' + nextOrder + ').');
    };
    await ensureTab('angular', 'Angular');
    await ensureTab('nodejs', 'Node.js');
    await ensureTab('rxjs', 'RxJS');

    // 2) Remove ONLY the topics this script previously seeded (match by exact title),
    //    so re-runs never duplicate and never touch the original html/css/js topics.
    const all = [...angularTopics, ...nodeTopics, ...rxjsTopics];
    // include titles used by earlier versions of this seed so renames don't leave orphans
    const legacyTitles = ['Angular RxJS, NgRx & Performance'];
    const seededTitles = [...all.map(t => t.title), ...legacyTitles];
    const removed = await Topic.deleteMany({ title: { $in: seededTitles } });
    console.log('Removed ' + removed.deletedCount + ' previously seeded interview topics.');

    // 3) Insert fresh topics
    await Topic.insertMany(all);
    console.log('Inserted ' + all.length + ' topics:');
    all.forEach(t => console.log('  - [' + t.difficultyLevel + '] ' + t.title + ' (' + t.subtopics.length + ' subtopics)'));

    console.log('\nDone. Angular topics -> Angular tab; Node.js topics -> Node.js tab. Browse by difficulty level.');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

seed();
