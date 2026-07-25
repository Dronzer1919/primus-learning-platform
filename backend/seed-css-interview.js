/*
 * Idempotent seed of CSS interview-prep topics for 3+ years experienced front-end
 * developers. Mirrors the Angular/HTML seeds: ONE topic per difficulty level
 * (beginner / intermediate / advance / expert) on the existing "CSS" tab, aiming to
 * cover the important CSS interview areas comprehensively.
 *
 * Run with:  node seed-css-interview.js   (or: npm run seed:css-interview)
 * Safe to re-run: removes only the topics THIS script seeds (by exact title) first.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const LanguageTab = require('./src/models/LanguageTab');
const Topic = require('./src/models/Topic');

// ---- content-block helpers ----
// Descriptions render via [innerHTML] in the content viewer, so raw angle brackets
// in prose (e.g. "<div>", combinators like "A > B") would be parsed as HTML and
// vanish. These descriptions are plain text, so HTML-escape them. Code blocks use
// {{ }} interpolation and are already safe, so they are NOT escaped.
let blockOrder = 0;
const escapeHtml = (s) => s
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');
const desc = (text) => ({ type: 'description', order: blockOrder++, data: { text: escapeHtml(text) } });
const code = (codeStr, language = 'css', title = '') => ({
  type: 'code',
  order: blockOrder++,
  data: { language, code: codeStr, title }
});
let stOrder = 0;
const sub = (title, blocks) => {
  blockOrder = 0;
  return { title, order: stOrder++, content: blocks };
};

// ============================ BEGINNER: CSS Fundamentals ============================
stOrder = 0;
const cssFundamentals = {
  title: 'CSS Fundamentals',
  description: 'Selectors & combinators, specificity, the cascade & inheritance, the box model, units, colors and custom properties — the baseline an experienced dev must own.',
  difficultyLevel: 'beginner',
  languagePlatform: 'css',
  order: 2,
  subtopics: [
    sub('Selectors & Combinators', [
      desc('Selectors target elements: type (div), class (.btn), id (#nav), attribute ([type="email"]), universal (*), plus pseudo-classes (:hover, :nth-child) and pseudo-elements (::before). Combinators define relationships: descendant (A B — any depth), child (A > B — direct only), adjacent sibling (A + B — the very next sibling), and general sibling (A ~ B — any following sibling). Choosing the tightest selector keeps CSS predictable and performant.'),
      code(
        'nav a { }              /* descendant: any <a> inside nav */\n' +
        'ul > li { }            /* child: only direct <li> */\n' +
        'h2 + p { }             /* adjacent: first <p> right after h2 */\n' +
        'h2 ~ p { }             /* general sibling: all <p> after h2 */\n' +
        'input[type="email"] { }/* attribute */\n' +
        'li:nth-child(odd) { }  /* pseudo-class */\n' +
        'p::first-line { }      /* pseudo-element */',
        'css', 'Selector types & combinators'
      )
    ]),
    sub('Specificity & !important', [
      desc('When rules conflict, specificity decides the winner, scored as (inline, IDs, classes/attributes/pseudo-classes, elements/pseudo-elements). Higher tuple wins left-to-right: an ID (0,1,0,0) beats any number of classes (0,0,x,0). Inline style is (1,0,0,0). !important overrides normal declarations entirely and should be a last resort — it breaks the natural cascade and is hard to undo. The universal selector * and combinators add 0 specificity.'),
      code(
        '/* specificity examples */\n' +
        '#header .nav a       /* (0,1,1,1) */\n' +
        '.nav a.active        /* (0,0,2,1) */\n' +
        'a                    /* (0,0,0,1) */\n' +
        '/* #header .nav a wins over .nav a.active because IDs beat classes */\n\n' +
        '.btn { color: red !important; } /* last resort — avoid */',
        'css', 'Scoring conflicts'
      )
    ]),
    sub('The Cascade', [
      desc('The cascade resolves which declaration applies using, in order: 1) origin & importance (user-agent < user < author, with !important flipping the order), 2) specificity, and 3) source order (later wins on a tie). This is WHY load order of stylesheets matters and why a later, equally-specific rule overrides an earlier one. Cascade layers (@layer) let you control this explicitly (covered in the expert topic).')
    ]),
    sub('Inheritance', [
      desc('Some properties inherit from parent to child by default — mostly text-related (color, font-family, font-size, line-height, visibility) — while box properties (margin, padding, border, width, background) do NOT. Control it with the keyword values: inherit (take the parent’s value), initial (the property’s spec default), unset (inherit if inheritable, else initial), and revert (roll back to the user-agent value).'),
      code(
        'body { color: #333; font-family: system-ui; } /* inherited by children */\n' +
        '.card { border: 1px solid; }                   /* NOT inherited */\n\n' +
        'a { color: inherit; }        /* use surrounding text color */\n' +
        '.reset { all: unset; }       /* strip inherited + set to initial */',
        'css', 'Inherited vs not'
      )
    ]),
    sub('The Box Model & box-sizing', [
      desc('Every element is a box: content, then padding, then border, then margin (outermost). By default (box-sizing: content-box) width/height size ONLY the content, so padding and border are ADDED on top — a frequent sizing surprise. Setting box-sizing: border-box makes width/height include padding and border, which is far more intuitive; applying it globally is a near-universal best practice. Margins collapse vertically between block elements (the larger of two adjacent margins wins).'),
      code(
        '*, *::before, *::after { box-sizing: border-box; }\n\n' +
        '.box {\n' +
        '  width: 200px;      /* border-box: total width stays 200px */\n' +
        '  padding: 20px;     /* content shrinks instead of box growing */\n' +
        '  border: 5px solid;\n' +
        '}',
        'css', 'Global border-box'
      )
    ]),
    sub('Units: Absolute vs Relative', [
      desc('Absolute: px (the practical baseline). Relative units scale and are preferred for responsive, accessible layouts: em is relative to the element’s own font-size (compounds when nested), rem is relative to the ROOT font-size (predictable — great for spacing/typography), % is relative to the parent, and vw/vh/vmin/vmax are relative to the viewport. ch (character width) and line-height unitless values are handy too. Using rem/em respects the user’s browser font-size setting (px does not).'),
      code(
        ':root { font-size: 16px; }\n' +
        'h1   { font-size: 2rem; }     /* 32px, relative to root */\n' +
        '.card{ padding: 1.5em; }      /* relative to .card font-size */\n' +
        '.hero{ height: 100vh; }       /* full viewport height */\n' +
        '.col { width: 50%; }          /* relative to parent */',
        'css', 'Scaling units'
      )
    ]),
    sub('Colors', [
      desc('Colors can be named, hex (#rrggbb / #rgb / #rrggbbaa for alpha), rgb()/rgba(), hsl()/hsla() (hue-saturation-lightness — easiest to tweak by hand), and modern spaces like hwb() and oklch() (perceptually uniform, wider gamut). currentColor references the element’s color value, and transparent is shorthand for a fully transparent color. HSL is popular for building consistent palettes because you vary lightness/saturation predictably.'),
      code(
        '.a { color: #3366ff; }\n' +
        '.b { color: rgb(51 102 255 / 0.5); }  /* modern space-separated + alpha */\n' +
        '.c { color: hsl(225 100% 60%); }      /* hue saturation lightness */\n' +
        '.d { border-color: currentColor; }    /* reuse the text color */',
        'css', 'Color notations'
      )
    ]),
    sub('Custom Properties (CSS Variables)', [
      desc('Custom properties (--name) hold reusable values, are read with var(--name, fallback), CASCADE and INHERIT like normal properties (unlike SCSS variables, which are compile-time), and can be read/updated at runtime with JS. Define them on :root for global tokens or on a component for scoped overrides. They are the foundation of theming and design systems.'),
      code(
        ':root {\n' +
        '  --brand: #3366ff;\n' +
        '  --space: 8px;\n' +
        '}\n' +
        '.btn { background: var(--brand); padding: calc(var(--space) * 2); }\n\n' +
        '/* scoped override + runtime read/write */\n' +
        '.card { --brand: #e11; }\n' +
        '/* JS: el.style.setProperty("--brand", "#0a0") */',
        'css', 'Design tokens with var()'
      )
    ])
  ]
};

// ============================ INTERMEDIATE: Layout ============================
stOrder = 0;
const cssLayout = {
  title: 'CSS Layout: Flow, Flexbox, Grid & Positioning',
  description: 'Normal flow and display types, positioning schemes, Flexbox and Grid in depth, when to use each, centering techniques, overflow and the legacy float/clear.',
  difficultyLevel: 'intermediate',
  languagePlatform: 'css',
  order: 3,
  subtopics: [
    sub('Display & Normal Flow', [
      desc('Normal flow lays elements out top-to-bottom (block) and left-to-right within lines (inline). display controls an element’s box: block (full width, new line), inline (flows in text, ignores width/height and vertical margins), inline-block (inline but respects box dimensions), none (removed from flow AND the accessibility tree — unlike visibility:hidden, which keeps space). display: flex/grid turn an element into a flex/grid CONTAINER for its direct children.')
    ]),
    sub('Positioning (static → sticky)', [
      desc('position: static is the default (in normal flow). relative offsets an element from its normal spot WITHOUT removing its space, and establishes a containing block for absolute children. absolute removes the element from flow and positions it relative to the nearest positioned ancestor (else the viewport). fixed pins it to the viewport (stays on scroll). sticky is a hybrid: it behaves like relative until a scroll threshold, then sticks like fixed within its container. top/right/bottom/left + z-index apply to positioned elements.'),
      code(
        '.parent { position: relative; }      /* containing block */\n' +
        '.badge  { position: absolute; top: 0; right: 0; }\n' +
        '.navbar { position: fixed; top: 0; inset-inline: 0; }\n' +
        '.subhead{ position: sticky; top: 0; }  /* sticks while scrolling */',
        'css', 'Positioning schemes'
      )
    ]),
    sub('Flexbox (1D layout)', [
      desc('Flexbox lays children along ONE axis. flex-direction sets the main axis (row/column); justify-content aligns along the main axis; align-items aligns along the cross axis; flex-wrap allows wrapping; gap spaces items. The flex shorthand on children is flex-grow flex-shrink flex-basis (e.g. flex: 1 = grow to fill). Perfect for toolbars, nav bars, cards in a row and vertical centering.'),
      code(
        '.toolbar {\n' +
        '  display: flex;\n' +
        '  justify-content: space-between; /* main axis */\n' +
        '  align-items: center;            /* cross axis */\n' +
        '  gap: 12px;\n' +
        '  flex-wrap: wrap;\n' +
        '}\n' +
        '.toolbar .spacer { flex: 1; }     /* grow to push items apart */',
        'css', 'Flex container + items'
      )
    ]),
    sub('CSS Grid (2D layout)', [
      desc('Grid lays out in TWO dimensions (rows AND columns) simultaneously. Define tracks with grid-template-columns/rows using the fr unit (fraction of free space), repeat(), and minmax(). gap sets gutters. Place items by line number, by span, or by named grid-template-areas. repeat(auto-fit, minmax(200px, 1fr)) creates responsive, wrap-without-media-queries card grids. Grid is the tool for page-level and complex 2D layouts.'),
      code(
        '.gallery {\n' +
        '  display: grid;\n' +
        '  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));\n' +
        '  gap: 16px;\n' +
        '}\n\n' +
        '.page {\n' +
        '  display: grid;\n' +
        '  grid-template-areas: "header header" "sidebar main" "footer footer";\n' +
        '  grid-template-columns: 240px 1fr;\n' +
        '}\n' +
        '.page header { grid-area: header; }',
        'css', 'Auto-fit grid + areas'
      )
    ]),
    sub('Flexbox vs Grid — when to use', [
      desc('Use Flexbox for ONE-dimensional layouts where content size drives distribution (a row of buttons, a nav bar, centering). Use Grid for TWO-dimensional layouts where you define the structure up front (page skeletons, dashboards, image galleries). They compose: a Grid cell can contain a Flex container. Rule of thumb: "content-out" → Flexbox; "layout-in" → Grid.')
    ]),
    sub('Centering in CSS (the classic question)', [
      desc('Horizontal + vertical centering, the most-asked CSS interview task. Modern answers: Flexbox (display:flex; justify-content:center; align-items:center) or Grid (display:grid; place-items:center). For a single block, margin-inline:auto centers horizontally. The old absolute + transform trick (top/left 50% then translate(-50%,-50%)) still works when you cannot change the parent’s display.'),
      code(
        '/* Flexbox */\n' +
        '.center { display: flex; justify-content: center; align-items: center; }\n\n' +
        '/* Grid — shortest */\n' +
        '.center { display: grid; place-items: center; }\n\n' +
        '/* Absolute fallback */\n' +
        '.child { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); }',
        'css', 'Three ways to center'
      )
    ]),
    sub('Overflow & Scrolling', [
      desc('overflow controls content that exceeds a box: visible (default, spills out), hidden (clipped — also a way to contain floats/establish a BFC), scroll (always shows scrollbars), auto (scrollbars only when needed). overflow-x/y set each axis. A Block Formatting Context (via overflow:hidden/auto, display:flow-root, flex/grid) contains floats and prevents margin collapse — a classic "why does my layout break?" answer.')
    ]),
    sub('Float & Clear (legacy, still asked)', [
      desc('float pulls an element left/right and lets inline content wrap around it — originally for images, later abused for whole-page layouts before Flexbox/Grid. Floated elements are removed from normal flow, so parents can collapse to zero height; fix with clear (push below floats) or the clearfix hack (::after { content:""; display:block; clear:both }), or better, display:flow-root. Today, use float only for its intended text-wrap purpose.'),
      code(
        'img.thumb { float: left; margin: 0 1rem 0.5rem 0; }\n\n' +
        '/* modern float containment */\n' +
        '.container { display: flow-root; }',
        'css', 'Float for text wrap'
      )
    ])
  ]
};

// ============================ ADVANCE: Responsive & Visual Effects ============================
stOrder = 0;
const cssResponsive = {
  title: 'CSS Responsive Design & Visual Effects',
  description: 'Mobile-first media queries, fluid sizing with clamp(), container queries, transitions, transforms, keyframe animations, pseudo-classes/elements, stacking context and media handling.',
  difficultyLevel: 'advance',
  languagePlatform: 'css',
  order: 4,
  subtopics: [
    sub('Responsive Design & Mobile-First', [
      desc('Responsive design adapts one codebase to any screen. Mobile-first means writing the base styles for small screens, then ADDING complexity at larger widths with min-width media queries — smaller, faster CSS with fewer overrides. Breakpoints should follow the content, not specific devices. Always pair with the responsive viewport meta tag in HTML. Also query capabilities: prefers-reduced-motion, prefers-color-scheme, hover/pointer.'),
      code(
        '/* base = mobile */\n' +
        '.grid { display: grid; grid-template-columns: 1fr; gap: 16px; }\n\n' +
        '@media (min-width: 48rem)  { .grid { grid-template-columns: 1fr 1fr; } }\n' +
        '@media (min-width: 64rem)  { .grid { grid-template-columns: repeat(3, 1fr); } }\n\n' +
        '@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }',
        'css', 'Mobile-first breakpoints'
      )
    ]),
    sub('Fluid Sizing: clamp(), min(), max()', [
      desc('These math functions create fluid, responsive values WITHOUT media queries. clamp(MIN, PREFERRED, MAX) grows/shrinks the preferred value but never exits the bounds — ideal for fluid typography and spacing. min()/max() pick the smaller/larger of comma-separated values. Combined with viewport units they replace many breakpoints and prevent text getting too small or too large.'),
      code(
        'h1 { font-size: clamp(1.5rem, 4vw + 1rem, 3rem); } /* fluid type */\n' +
        '.container { width: min(100%, 1200px); }           /* cap max width */\n' +
        '.pad { padding: max(16px, 5vw); }                  /* never below 16px */',
        'css', 'Fluid without media queries'
      )
    ]),
    sub('Container Queries', [
      desc('Container queries style an element based on the size of its CONTAINER, not the viewport — the missing piece for truly reusable components (a card can switch to a horizontal layout only when its own column is wide enough). Mark an ancestor with container-type: inline-size, then use @container. This is a modern, high-signal interview topic.'),
      code(
        '.card-wrap { container-type: inline-size; }\n\n' +
        '@container (min-width: 400px) {\n' +
        '  .card { display: grid; grid-template-columns: 120px 1fr; }\n' +
        '}',
        'css', '@container'
      )
    ]),
    sub('Transitions', [
      desc('transition animates a property between two states over time — the cheap, declarative way to smooth hover/focus/state changes. Syntax: property duration timing-function delay. Only animate cheap, composited properties (transform, opacity) for 60fps; animating layout properties (width, top, margin) triggers reflow and jank. Prefer transition on specific properties over "all".'),
      code(
        '.btn {\n' +
        '  transform: scale(1);\n' +
        '  transition: transform 150ms ease-out, background-color 150ms ease-out;\n' +
        '}\n' +
        '.btn:hover { transform: scale(1.05); }',
        'css', 'Smooth state change'
      )
    ]),
    sub('Transforms (2D & 3D)', [
      desc('transform moves/rotates/scales/skews an element WITHOUT affecting layout (no reflow — it is composited on the GPU, so it is cheap and smooth). Functions: translate(x,y), scale(), rotate(), skew(), plus 3D (translate3d, rotateX/Y, perspective). transform-origin sets the pivot. Because transforms and opacity do not trigger layout/paint, they are the preferred properties to animate.'),
      code(
        '.card { transition: transform 200ms; }\n' +
        '.card:hover { transform: translateY(-4px) scale(1.02); }\n\n' +
        '.flip { transform: perspective(600px) rotateY(180deg); transform-origin: center; }',
        'css', 'GPU-friendly transforms'
      )
    ]),
    sub('Animations (@keyframes)', [
      desc('For multi-step or looping motion, define @keyframes and drive them with the animation shorthand: name duration timing-function delay iteration-count direction fill-mode. animation-fill-mode: forwards keeps the final state; iteration-count: infinite loops. Respect prefers-reduced-motion. Keep animations on transform/opacity for performance.'),
      code(
        '@keyframes fade-in-up {\n' +
        '  from { opacity: 0; transform: translateY(12px); }\n' +
        '  to   { opacity: 1; transform: translateY(0); }\n' +
        '}\n' +
        '.toast { animation: fade-in-up 300ms ease-out forwards; }',
        'css', 'Keyframe animation'
      )
    ]),
    sub('Pseudo-classes vs Pseudo-elements', [
      desc('A pseudo-class (single colon) targets a STATE or position: :hover, :focus, :focus-visible, :active, :checked, :disabled, :nth-child(), :first-of-type, :not(). A pseudo-element (double colon) styles a PART of an element or injects generated content: ::before, ::after (need content:), ::first-line, ::selection, ::placeholder, ::marker. ::before/::after are widely used for icons, decorations and clearfix.'),
      code(
        'a:hover, a:focus-visible { text-decoration: underline; }\n' +
        'input:disabled { opacity: 0.5; }\n' +
        'li:not(:last-child) { margin-bottom: 8px; }\n\n' +
        '.tag::before { content: "#"; color: gray; }\n' +
        '::selection { background: gold; }',
        'css', 'State vs part'
      )
    ]),
    sub('Stacking Context & z-index', [
      desc('z-index only affects POSITIONED elements (position other than static) or flex/grid items, and orders them within the SAME stacking context. A new stacking context is created by, among others, a positioned element with a z-index, opacity < 1, transform, filter, will-change, or isolation: isolate. The gotcha: a child’s huge z-index cannot escape its parent’s stacking context, so a z-index:9999 modal can still sit behind another element — the classic "my z-index does nothing" bug.'),
      code(
        '.modal { position: fixed; z-index: 1000; }\n\n' +
        '/* create an isolated stacking context without positioning */\n' +
        '.card { isolation: isolate; }\n' +
        '/* WARNING: parent { transform/opacity } traps children’s z-index */',
        'css', 'Stacking contexts'
      )
    ]),
    sub('Media Handling: object-fit & aspect-ratio', [
      desc('object-fit controls how a replaced element (img/video) fills its box: cover (fill, crop), contain (fit, letterbox), fill (stretch), none. object-position sets the focal point. aspect-ratio reserves space at a fixed ratio (e.g. 16/9) BEFORE the image loads, preventing layout shift (CLS) without the old padding-hack. Together they make responsive media robust.'),
      code(
        '.avatar {\n' +
        '  width: 64px; aspect-ratio: 1;   /* perfect square, reserves space */\n' +
        '  object-fit: cover;              /* crop instead of squish */\n' +
        '  border-radius: 50%;\n' +
        '}\n' +
        '.hero img { aspect-ratio: 16 / 9; object-fit: cover; width: 100%; }',
        'css', 'No layout shift media'
      )
    ])
  ]
};

// ============================ EXPERT: Architecture, Performance & Modern CSS ============================
stOrder = 0;
const cssAdvanced = {
  title: 'CSS Architecture, Performance & Modern CSS',
  description: 'Methodologies (BEM), theming with custom properties, rendering performance (reflow/repaint/composite), :has()/:is()/:where(), cascade layers & nesting, logical properties, subgrid and preprocessors vs modern CSS.',
  difficultyLevel: 'expert',
  languagePlatform: 'css',
  order: 5,
  subtopics: [
    sub('CSS Architecture & Methodologies', [
      desc('At scale, CSS needs conventions to stay maintainable and avoid specificity wars. BEM (Block__Element--Modifier) keeps selectors flat and low-specificity with predictable names. Utility-first (Tailwind) composes small single-purpose classes in markup. ITCSS/SMACSS organise the codebase from generic to specific. The shared goals: low specificity, no !important, reusable components, and a clear source of truth. Modern scoping also uses CSS Modules or Shadow DOM.'),
      code(
        '/* BEM: flat, low-specificity, self-documenting */\n' +
        '.card { }\n' +
        '.card__title { }\n' +
        '.card__button { }\n' +
        '.card__button--primary { }\n' +
        '.card--featured { }',
        'css', 'BEM naming'
      )
    ]),
    sub('Theming with Custom Properties', [
      desc('Custom properties make theming trivial because they cascade and update live. Define semantic tokens on :root, switch them under a [data-theme] attribute or the prefers-color-scheme media query, and the whole UI re-themes with no rebuild. Because they are inherited and runtime-mutable, a single class or JS setProperty can flip a theme instantly — unlike compile-time SCSS variables.'),
      code(
        ':root {\n' +
        '  --bg: #ffffff; --fg: #111111;\n' +
        '}\n' +
        '@media (prefers-color-scheme: dark) {\n' +
        '  :root { --bg: #0d1117; --fg: #e6edf3; }\n' +
        '}\n' +
        '[data-theme="dark"] { --bg: #0d1117; --fg: #e6edf3; }\n' +
        'body { background: var(--bg); color: var(--fg); }',
        'css', 'Dark mode via tokens'
      )
    ]),
    sub('Rendering Performance: Reflow, Repaint, Composite', [
      desc('The browser turns CSS into pixels in stages: Layout (reflow — geometry), Paint (repaint — pixels), Composite (layer assembly). Changing geometry (width, height, top, margin, font-size) triggers reflow → repaint → composite (expensive). Changing color/background triggers repaint only. Changing transform/opacity can be handled by the compositor alone (cheapest, GPU) — which is why you animate those. will-change hints upcoming changes (use sparingly — each layer costs memory); contain and content-visibility limit how much the browser must recalculate for offscreen/independent subtrees.'),
      code(
        '/* GOOD: composited, 60fps */\n' +
        '.panel { transition: transform 200ms; }\n' +
        '.panel.open { transform: translateX(0); }\n\n' +
        '/* Perf hints */\n' +
        '.card { content-visibility: auto; }   /* skip offscreen rendering */\n' +
        '.list { contain: layout paint; }      /* isolate recalcs */',
        'css', 'Animate transform/opacity'
      )
    ]),
    sub('Modern Selectors: :has(), :is(), :where()', [
      desc(':has(...) is the long-awaited "parent selector" — style an element based on its descendants/state (e.g. a card that CONTAINS an image, or a form field whose input is :invalid). :is(a, b, c) matches any in the list and takes the specificity of its MOST specific argument. :where() is identical but always has ZERO specificity — perfect for low-priority resets/defaults that are easy to override. These dramatically cut selector duplication.'),
      code(
        '/* parent selector */\n' +
        '.card:has(img) { padding-top: 0; }\n' +
        'label:has(input:invalid) { color: red; }\n\n' +
        '/* group without repeating */\n' +
        ':is(h1, h2, h3) a { color: inherit; }\n' +
        ':where(ul, ol) { margin: 0; }   /* 0 specificity, easy to override */',
        'css', ':has / :is / :where'
      )
    ]),
    sub('Cascade Layers (@layer) & Nesting', [
      desc('@layer defines explicit cascade layers whose ORDER you control, so a later-declared but lower layer loses to an earlier higher one regardless of specificity — a clean way to order resets, frameworks, components and utilities without specificity hacks or !important. Native CSS Nesting (the & selector) lets you nest rules like SCSS without a build step. Together they modernise large-codebase organisation.'),
      code(
        '@layer reset, framework, components, utilities;\n\n' +
        '@layer components {\n' +
        '  .btn {\n' +
        '    color: white;\n' +
        '    &:hover { opacity: 0.9; }   /* native nesting */\n' +
        '    &.btn--lg { padding: 1rem; }\n' +
        '  }\n' +
        '}',
        'css', 'Layers + nesting'
      )
    ]),
    sub('Logical Properties & Internationalization', [
      desc('Logical properties replace physical directions (left/right/top/bottom) with flow-relative ones (inline-start/inline-end, block-start/block-end), so layouts automatically mirror for RTL languages or vertical writing modes with no overrides. margin-inline, padding-block, inset-inline, border-inline etc. are the i18n-friendly defaults for modern CSS.'),
      code(
        '/* physical (breaks in RTL) */\n' +
        '.card { margin-left: 16px; padding-right: 8px; }\n\n' +
        '/* logical (mirrors automatically) */\n' +
        '.card { margin-inline-start: 16px; padding-inline-end: 8px; }\n' +
        '.modal { inset-inline: 0; }   /* left+right in LTR, flips in RTL */',
        'css', 'RTL-safe spacing'
      )
    ]),
    sub('Subgrid', [
      desc('subgrid lets a nested grid ADOPT the track sizes of its parent grid, so items in separate child grids align to the SAME columns/rows (e.g. every card’s title, body and footer line up across a gallery even with varying content). Before subgrid this required fragile fixed heights or JS. Set grid-template-columns/rows: subgrid on the child.'),
      code(
        '.gallery { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }\n' +
        '.card {\n' +
        '  display: grid;\n' +
        '  grid-row: span 3;\n' +
        '  grid-template-rows: subgrid;  /* align title/body/footer across cards */\n' +
        '}',
        'css', 'Aligned nested grids'
      )
    ]),
    sub('Preprocessors (SCSS) vs Modern CSS', [
      desc('SCSS/Sass added variables, nesting, mixins, functions, partials and @use long before CSS had them, and still helps with loops/mixins and large design systems. But modern CSS now covers much of it natively: custom properties (runtime, cascading — more powerful than SCSS variables), native nesting, @layer, min()/max()/clamp() and color functions. Interview take: know what SCSS still buys you (mixins, compile-time logic, math) versus what is now better done natively (theming with custom properties).'),
      code(
        '// SCSS mixin — compile-time reuse\n' +
        '@mixin flex-center { display: flex; justify-content: center; align-items: center; }\n' +
        '.modal { @include flex-center; }\n\n' +
        '/* Modern CSS equivalent value token (runtime, themeable) */\n' +
        ':root { --gap: clamp(8px, 2vw, 24px); }',
        'scss', 'SCSS mixin vs CSS token'
      )
    ])
  ]
};

const cssTopics = [cssFundamentals, cssLayout, cssResponsive, cssAdvanced];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // 1) Ensure the CSS language tab exists (idempotent; usually already there).
    const existingTab = await LanguageTab.findOne({ code: 'css' });
    if (existingTab) {
      console.log('CSS language tab already exists - leaving it in place.');
    } else {
      const maxOrder = await LanguageTab.find().sort({ order: -1 }).limit(1);
      const nextOrder = maxOrder.length ? maxOrder[0].order + 1 : 5;
      await LanguageTab.create({ name: 'CSS', code: 'css', order: nextOrder, isActive: true });
      console.log('Created CSS language tab (order ' + nextOrder + ').');
    }

    // 2) Remove topics this script owns (by exact title) so re-runs never duplicate.
    //    NOTE: the beginner title "CSS Fundamentals" also matches the small 2-subtopic
    //    sample created by seed.js, so running this INTENTIONALLY REPLACES that sample
    //    with the fuller interview version (a strict superset). Other topics untouched.
    const seededTitles = cssTopics.map(t => t.title);
    const removed = await Topic.deleteMany({ title: { $in: seededTitles } });
    console.log('Removed ' + removed.deletedCount + ' matching CSS topic(s) (incl. the seed.js "CSS Fundamentals" sample, which is replaced).');

    // 3) Insert fresh topics
    await Topic.insertMany(cssTopics);
    console.log('Inserted ' + cssTopics.length + ' CSS interview topics (one per level):');
    cssTopics.forEach(t => console.log('  - [' + t.difficultyLevel + '] ' + t.title + ' (' + t.subtopics.length + ' subtopics)'));

    console.log('\nDone. Open the CSS tab and browse Beginner / Intermediate / Advance / Expert.');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

seed();
