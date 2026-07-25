/*
 * Idempotent seed of HTML interview-prep topics aimed at 3+ years experienced
 * front-end developers. Mirrors the Angular seed's shape: ONE topic per difficulty
 * level (beginner / intermediate / advance / expert) on the existing "HTML" tab.
 * The original beginner "HTML Basics" topic is left untouched.
 *
 * Run with:  node seed-html-interview.js   (or: npm run seed:html-interview)
 * Safe to re-run: it removes only the topics THIS script seeds (matched by exact
 * title, incl. legacy titles) before re-inserting, so it never duplicates.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const LanguageTab = require('./src/models/LanguageTab');
const Topic = require('./src/models/Topic');

// ---- content-block helpers (same shape the app + other seeds use) ----
// Descriptions are rendered via [innerHTML] in the content viewer, so raw angle
// brackets in prose (e.g. "<header>") would be parsed as empty HTML tags and
// disappear. Since these descriptions are plain text (no intentional markup), we
// HTML-escape them so element names display literally. Code blocks are shown via
// {{ }} interpolation and are already safe, so they are NOT escaped.
let blockOrder = 0;
const escapeHtml = (s) => s
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');
const desc = (text) => ({ type: 'description', order: blockOrder++, data: { text: escapeHtml(text) } });
const code = (codeStr, language = 'html', title = '') => ({
  type: 'code',
  order: blockOrder++,
  data: { language, code: codeStr, title }
});
// build a subtopic; resets block order per subtopic
let stOrder = 0;
const sub = (title, blocks) => {
  blockOrder = 0;
  return { title, order: stOrder++, content: blocks };
};

// ============================ BEGINNER: HTML Fundamentals ============================
stOrder = 0;
const htmlFundamentals = {
  title: 'HTML Fundamentals',
  description: 'The baseline every experienced dev must nail: semantics, the <head>, block vs inline, headings, links/images, semantic tables, data-* and DOCTYPE/rendering modes.',
  difficultyLevel: 'beginner',
  languagePlatform: 'html',
  order: 2,
  subtopics: [
    sub('Semantic vs Non-Semantic HTML', [
      desc('Semantic elements describe their MEANING (<header>, <nav>, <main>, <article>, <section>, <aside>, <footer>, <figure>, <time>), while non-semantic elements (<div>, <span>) say nothing about their content. Semantics improve accessibility (screen readers expose landmarks), SEO (search engines understand structure) and maintainability. Rule of thumb: reach for a semantic element first; fall back to <div>/<span> only as pure styling hooks.'),
      code(
        '<!-- Non-semantic: everything is a div -->\n' +
        '<div class="header"></div>\n' +
        '<div class="nav"></div>\n' +
        '<div class="main"></div>\n\n' +
        '<!-- Semantic: intent is clear to browsers, AT and search engines -->\n' +
        '<header></header>\n' +
        '<nav></nav>\n' +
        '<main></main>\n' +
        '<footer></footer>',
        'html', 'div soup vs semantics'
      )
    ]),
    sub('The <head>: Metadata That Matters', [
      desc('The <head> is not rendered but configures the page. Essentials: <meta charset="UTF-8"> first, so text decodes correctly; the responsive <meta name="viewport"> (mandatory for mobile); a descriptive <title> (browser tab + search result); and <meta name="description"> (the search snippet). lang on <html> aids screen readers and translation.'),
      code(
        '<!DOCTYPE html>\n' +
        '<html lang="en">\n' +
        '<head>\n' +
        '  <meta charset="UTF-8">\n' +
        '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
        '  <title>Page Title (50–60 chars)</title>\n' +
        '  <meta name="description" content="Compelling 150–160 char summary.">\n' +
        '</head>\n' +
        '<body></body>\n' +
        '</html>',
        'html', 'Core <head>'
      )
    ]),
    sub('Block vs Inline vs Inline-Block', [
      desc('Block-level elements (<div>, <p>, <section>, <h1>) start on a new line and take the full available width; they accept width/height and vertical margins. Inline elements (<span>, <a>, <strong>, <em>) flow within text, take only as much width as their content, and ignore width/height and top/bottom margins. inline-block flows inline BUT respects width/height and all margins. This is the DEFAULT display; CSS can override any element’s box type.')
    ]),
    sub('Heading Hierarchy', [
      desc('Headings <h1>–<h6> convey document structure, not size — never pick a level for its font size (style with CSS). Use a single logical <h1> describing the page, then do not skip levels (an <h2> should not jump to <h4>). Screen-reader users navigate by heading, so a broken hierarchy is a real accessibility bug. A very common interview gotcha.')
    ]),
    sub('Links & Images', [
      desc('<a> creates hyperlinks via href — absolute (https://…), relative (/about), fragment (#id), mailto: or tel:. target="_blank" opens a new tab; ALWAYS pair it with rel="noopener noreferrer" so the new page cannot access window.opener (a security/perf risk). <img> needs src and a meaningful alt; set width/height to prevent layout shift (CLS).'),
      code(
        '<a href="/about">Internal link</a>\n' +
        '<a href="https://example.com" target="_blank" rel="noopener noreferrer">External</a>\n' +
        '<a href="#section-2">Jump to section</a>\n' +
        '<a href="mailto:hi@example.com">Email us</a>\n\n' +
        '<img src="/logo.svg" alt="Acme logo" width="120" height="40">',
        'html', 'Links & images'
      )
    ]),
    sub('Lists & Semantic Tables', [
      desc('Use <ul> for unordered lists, <ol> where order matters, and <dl>/<dt>/<dd> for term–definition pairs. Tables are for TABULAR DATA only (never layout): give them <thead>/<tbody>/<tfoot>, use <th> for header cells with scope="col"/"row", and <caption> for an accessible title. Proper table semantics let screen readers announce the right row/column headers.'),
      code(
        '<table>\n' +
        '  <caption>Q1 Sales</caption>\n' +
        '  <thead>\n' +
        '    <tr><th scope="col">Region</th><th scope="col">Total</th></tr>\n' +
        '  </thead>\n' +
        '  <tbody>\n' +
        '    <tr><th scope="row">North</th><td>$12k</td></tr>\n' +
        '  </tbody>\n' +
        '</table>',
        'html', 'Accessible table'
      )
    ]),
    sub('data-* Attributes', [
      desc('Custom data-* attributes store extra info on any element without invalid markup, readable in JS via element.dataset (camelCased) and in CSS via [data-x] selectors. Great for hooking JS behaviour or passing small config to a component. Do NOT use them for visible content or large data blobs.'),
      code(
        '<button data-user-id="42" data-role="admin">Edit</button>\n\n' +
        '<script>\n' +
        '  const btn = document.querySelector("button");\n' +
        '  console.log(btn.dataset.userId); // "42"\n' +
        '  console.log(btn.dataset.role);   // "admin"\n' +
        '</script>',
        'html', 'dataset access'
      )
    ]),
    sub('DOCTYPE, Standards Mode & Quirks Mode', [
      desc('<!DOCTYPE html> is NOT a tag — it puts the browser in "standards mode" using the modern box model and CSS behaviour. Omitting it (or using an old/invalid doctype) triggers "quirks mode", emulating 1990s bugs (e.g. the old IE box model where padding/border sit inside width). There is also an "almost-standards" mode. Modern pages must always start with the short HTML5 doctype.')
    ])
  ]
};

// ============================ INTERMEDIATE: Semantics, Forms & the DOM ============================
stOrder = 0;
const htmlSemanticsForms = {
  title: 'HTML Semantics, Forms & the DOM',
  description: 'Document landmarks and the section/article/div decision, the HTML-vs-DOM distinction, plus native input types, constraint validation, labelling and FormData.',
  difficultyLevel: 'intermediate',
  languagePlatform: 'html',
  order: 3,
  subtopics: [
    sub('Document Landmarks & Page Outline', [
      desc('Landmark elements build an implicit accessibility tree that lets screen-reader users jump between regions. Keep exactly ONE <main> per page (the primary content), one top-level <header>/<footer>, and use <nav> for major navigation. <article> is a self-contained, independently distributable unit (post, card, comment); <section> is a thematic grouping that usually has a heading.'),
      code(
        '<body>\n' +
        '  <header><nav aria-label="Primary"> ... </nav></header>\n' +
        '  <main>\n' +
        '    <article>\n' +
        '      <h1>Post title</h1>\n' +
        '      <section><h2>Introduction</h2> ... </section>\n' +
        '      <section><h2>Details</h2> ... </section>\n' +
        '    </article>\n' +
        '    <aside>Related links</aside>\n' +
        '  </main>\n' +
        '  <footer>© 2025</footer>\n' +
        '</body>',
        'html', 'Landmark layout'
      )
    ]),
    sub('section vs article vs div', [
      desc('Use <article> when the content stands on its own and could be syndicated (news item, product card, forum post). Use <section> to group related content within a larger whole, typically with a heading. Use <div> only when there is NO semantic relationship and you just need a styling/scripting container. Quick test: if removing the surrounding context still leaves the block meaningful, it is probably an <article>.')
    ]),
    sub('HTML vs the DOM', [
      desc('HTML is the text you author; the DOM (Document Object Model) is the live in-memory tree the browser builds from it and that JS manipulates. They can differ: the browser repairs invalid markup, and JS can add/remove nodes so the DOM no longer matches the source ("View Source" shows the HTML; DevTools "Elements" shows the current DOM). A script can only access DOM nodes parsed BEFORE it — a key reason to defer scripts or place them at the end of <body>.'),
      code(
        '<ul id="list"></ul>\n' +
        '<script>\n' +
        '  const li = document.createElement("li");\n' +
        '  li.textContent = "Added by JS";\n' +
        '  document.getElementById("list").append(li);\n' +
        '  // View Source shows an empty <ul>; the DOM now has an <li>.\n' +
        '</script>',
        'html', 'Source vs live DOM'
      )
    ]),
    sub('Input Types (use the right one)', [
      desc('HTML5 input types give free validation, better mobile keyboards and native pickers: email, url, tel, number, range, date, time, datetime-local, month, week, color, search, password, file. Choosing correctly (e.g. type="email" shows the @ keyboard and validates format) is expected of a senior dev. Always still validate on the server — client validation is UX, not security.'),
      code(
        '<input type="email"  name="email"  required>\n' +
        '<input type="number" name="qty"    min="1" max="10" step="1">\n' +
        '<input type="tel"    name="phone"  pattern="[0-9]{10}">\n' +
        '<input type="date"   name="dob"    max="2025-01-01">\n' +
        '<input type="range"  name="volume" min="0" max="100">\n' +
        '<input type="file"   name="doc"    accept=".pdf" multiple>',
        'html', 'Semantic input types'
      )
    ]),
    sub('Native Constraint Validation', [
      desc('Validation attributes let the browser block submission and show messages with zero JS: required, minlength/maxlength, min/max/step, pattern (regex), plus type-based checks. Add novalidate on the <form> to take full JS control. Style validity with the :valid, :invalid, :required and :user-invalid CSS pseudo-classes.'),
      code(
        '<form>\n' +
        '  <input name="username" required minlength="3" maxlength="20">\n' +
        '  <input name="zip" pattern="\\d{5}" title="5 digit ZIP">\n' +
        '  <button>Submit</button>\n' +
        '</form>\n\n' +
        '<style>\n' +
        '  input:invalid { border-color: red; }\n' +
        '  input:valid   { border-color: green; }\n' +
        '</style>',
        'html', 'Attributes + :invalid'
      )
    ]),
    sub('The Constraint Validation API (JS)', [
      desc('For custom rules and messages, use the JS API: checkValidity()/reportValidity() run validation, validity (a ValidityState) tells you WHY it failed (valueMissing, typeMismatch, patternMismatch, rangeOverflow…), and setCustomValidity(msg) marks a field invalid with your own message (set it back to "" to clear).'),
      code(
        'const pw = document.querySelector("#password");\n' +
        'const confirm = document.querySelector("#confirm");\n' +
        'confirm.addEventListener("input", () => {\n' +
        '  confirm.setCustomValidity(\n' +
        '    confirm.value !== pw.value ? "Passwords do not match" : ""\n' +
        '  );\n' +
        '});',
        'javascript', 'setCustomValidity'
      )
    ]),
    sub('Labels, Fieldset & Legend', [
      desc('Every input needs an associated <label> — wrap the input or link via for="id" — so clicking the label focuses the field and screen readers announce it. Group related controls (e.g. a radio set) in <fieldset> with a <legend>. Placeholder text is NOT a label: it disappears on input and fails accessibility. type="submit" vs type="button" (button does NOT submit) is a classic bug source.'),
      code(
        '<label for="email">Email</label>\n' +
        '<input id="email" type="email">\n\n' +
        '<fieldset>\n' +
        '  <legend>Contact preference</legend>\n' +
        '  <label><input type="radio" name="c" value="email"> Email</label>\n' +
        '  <label><input type="radio" name="c" value="sms"> SMS</label>\n' +
        '</fieldset>',
        'html', 'Accessible labelling'
      )
    ]),
    sub('Modern Form Elements', [
      desc('<datalist> gives an input an autocomplete suggestion list while still allowing free text. <output> displays a calculated result. <progress> shows task completion; <meter> shows a scalar value within a known range (disk usage, score). These reduce custom JS/widgets.'),
      code(
        '<input list="browsers" name="browser">\n' +
        '<datalist id="browsers">\n' +
        '  <option value="Chrome"><option value="Firefox"><option value="Safari">\n' +
        '</datalist>\n\n' +
        '<progress value="70" max="100">70%</progress>\n' +
        '<meter value="0.6" min="0" max="1">60%</meter>',
        'html', 'datalist / progress / meter'
      )
    ]),
    sub('Submitting with FormData', [
      desc('The FormData API serialises a form (including files) for fetch/XHR without manual field collection. Combine it with e.preventDefault() to submit via JS while keeping native validation via form.checkValidity(). An input without a name attribute is never submitted.'),
      code(
        'form.addEventListener("submit", async (e) => {\n' +
        '  e.preventDefault();\n' +
        '  if (!form.checkValidity()) { form.reportValidity(); return; }\n' +
        '  const data = new FormData(form);\n' +
        '  await fetch("/api/save", { method: "POST", body: data });\n' +
        '});',
        'javascript', 'fetch + FormData'
      )
    ])
  ]
};

// ============================ ADVANCE: Accessibility, SEO & Performance ============================
stOrder = 0;
const htmlA11ySeoPerf = {
  title: 'HTML Accessibility, SEO & Performance',
  description: 'WCAG/POUR, semantic-first a11y, ARIA, keyboard/focus and live regions, plus the HTML that drives SEO and Core Web Vitals: metadata, Open Graph, async/defer, resource hints and responsive/lazy images.',
  difficultyLevel: 'advance',
  languagePlatform: 'html',
  order: 4,
  subtopics: [
    sub('Why Accessibility & WCAG (POUR)', [
      desc('Accessibility (a11y) means everyone — including users of screen readers, keyboards, magnifiers and voice control — can use your site; it is also a legal requirement in many markets (ADA, EN 301 549). WCAG 2.1/2.2 groups success criteria under four POUR principles: Perceivable, Operable, Understandable, Robust, at levels A, AA (the common legal target) and AAA.')
    ]),
    sub('Semantic HTML is the First a11y Tool', [
      desc('The best ARIA is no ARIA: native elements bring built-in roles, states and keyboard behaviour. A <button> is focusable, announces "button" and fires on Enter/Space for free; a <div onclick> does none of that. "The first rule of ARIA: don’t use ARIA if a native element already does the job."'),
      code(
        '<!-- Bad: not focusable, no keyboard, no role -->\n' +
        '<div class="btn" onclick="save()">Save</div>\n\n' +
        '<!-- Good: focusable + keyboard + announced automatically -->\n' +
        '<button type="button" onclick="save()">Save</button>',
        'html', 'Native button wins'
      )
    ]),
    sub('ARIA: Roles, States & Properties', [
      desc('ARIA adds semantics to custom widgets HTML cannot express: role defines WHAT it is (tab, dialog, alert), aria-* properties/states describe it (aria-expanded, aria-selected, aria-checked, aria-controls). ARIA changes ONLY the accessibility tree — never appearance or behaviour, which you still implement in JS/CSS. Wrong ARIA is worse than none.'),
      code(
        '<button aria-expanded="false" aria-controls="menu" id="trigger">Menu</button>\n' +
        '<ul id="menu" role="menu" hidden>\n' +
        '  <li role="menuitem">Profile</li>\n' +
        '  <li role="menuitem">Logout</li>\n' +
        '</ul>',
        'html', 'Disclosure widget'
      )
    ]),
    sub('Keyboard Navigation & Focus', [
      desc('All interactive controls must be reachable and operable by keyboard alone. Native controls are focusable by default; for custom widgets use tabindex="0" to add to tab order and tabindex="-1" for JS-only focus (never positive tabindex — it wrecks order). Manage focus on route changes and dialogs (move focus in, trap it, restore on close). Never remove focus outlines without a visible alternative.'),
      code(
        '<div role="button" tabindex="0"\n' +
        '     onclick="toggle()"\n' +
        '     onkeydown="if(event.key===\'Enter\'||event.key===\' \')toggle()">\n' +
        '  Custom toggle\n' +
        '</div>',
        'html', 'Keyboard-operable div'
      )
    ]),
    sub('Live Regions & Alt Text', [
      desc('Dynamic updates (toasts, validation, async results) are invisible to screen readers unless announced: aria-live="polite" announces when idle, "assertive" interrupts (use sparingly), and role="alert"/role="status" are built-in live regions. The element must exist in the DOM BEFORE you inject text. Separately, every <img> needs alt: describe the MEANING for informative images and use empty alt="" for decorative ones so readers skip them.'),
      code(
        '<div aria-live="polite" id="status"></div>\n' +
        '<script>document.getElementById("status").textContent = "Saved!";</script>\n\n' +
        '<img src="chart.png" alt="Bar chart: sales up 20% in Q1">\n' +
        '<img src="divider.svg" alt="">   <!-- decorative: skipped -->',
        'html', 'Announcements + alt'
      )
    ]),
    sub('Essential Metadata & SEO', [
      desc('charset (UTF-8, within the first 1024 bytes) and the responsive viewport are mandatory. <title> and <meta name="description"> drive the search snippet. <link rel="canonical"> avoids duplicate-content penalties, and robots controls indexing. lang on <html> aids screen readers and translation.'),
      code(
        '<title>Page Title (50–60 chars)</title>\n' +
        '<meta name="description" content="Compelling 150–160 char summary.">\n' +
        '<link rel="canonical" href="https://example.com/page">\n' +
        '<meta name="robots" content="index, follow">',
        'html', 'SEO meta'
      )
    ]),
    sub('Open Graph & Social Cards', [
      desc('Open Graph (og:) and Twitter Card meta tags control how a link looks when shared on social/chat platforms — title, description and preview image. Missing OG tags mean ugly, low-CTR previews. og:image should be ~1200×630 and an absolute URL.'),
      code(
        '<meta property="og:title" content="Article Title">\n' +
        '<meta property="og:description" content="Short summary.">\n' +
        '<meta property="og:image" content="https://example.com/preview.jpg">\n' +
        '<meta property="og:url" content="https://example.com/article">\n' +
        '<meta name="twitter:card" content="summary_large_image">',
        'html', 'Rich link previews'
      )
    ]),
    sub('Script Loading & Resource Hints', [
      desc('A plain <script> in <head> blocks parsing while it downloads AND executes. defer downloads in parallel and runs AFTER parsing, in order — the default for app code. async runs as soon as ready, order not guaranteed — good for independent third-party scripts. type="module" is deferred by default. Resource hints tune the waterfall: preload (critical current-page asset), preconnect (open a third-party connection early), dns-prefetch, and prefetch (next-navigation asset). Over-preloading hurts.'),
      code(
        '<script src="app.js" defer></script>       <!-- app code -->\n' +
        '<script src="analytics.js" async></script> <!-- 3rd-party -->\n\n' +
        '<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>\n' +
        '<link rel="preconnect" href="https://api.example.com">\n' +
        '<link rel="prefetch" href="/next-page.js">',
        'html', 'defer/async + hints'
      )
    ]),
    sub('Responsive Images, Lazy Loading & Core Web Vitals', [
      desc('srcset + sizes let the browser pick the best-sized image (saving bandwidth, improving LCP); <picture> gives art direction and modern formats (AVIF/WebP with a fallback). loading="lazy" defers offscreen images — but NEVER lazy-load the LCP/above-the-fold image; use fetchpriority="high" there. Always set width/height (or aspect-ratio) to prevent layout shift. These directly move Core Web Vitals: LCP (load speed), CLS (visual stability) and INP (interactivity).'),
      code(
        '<img src="photo-800.jpg"\n' +
        '  srcset="photo-400.jpg 400w, photo-800.jpg 800w, photo-1200.jpg 1200w"\n' +
        '  sizes="(max-width: 600px) 100vw, 50vw"\n' +
        '  width="800" height="600" loading="lazy" decoding="async" alt="City skyline">\n\n' +
        '<img src="hero.jpg" fetchpriority="high" width="1200" height="600" alt="Hero">\n' +
        '<!-- LCP image: prioritise, do NOT lazy-load -->',
        'html', 'Right image, no CLS'
      )
    ])
  ]
};

// ============================ EXPERT: HTML5 APIs & Browser Internals ============================
stOrder = 0;
const htmlAdvanced = {
  title: 'HTML5 APIs & Browser Internals',
  description: 'Web Storage vs cookies, native dialog/details, template & slot, Web Components/Shadow DOM, iframe sandboxing, the critical rendering path and progressive enhancement.',
  difficultyLevel: 'expert',
  languagePlatform: 'html',
  order: 5,
  subtopics: [
    sub('Web Storage vs Cookies', [
      desc('localStorage: ~5–10MB, persists until cleared, per-origin, synchronous, NOT sent to the server. sessionStorage: same API, scoped to a tab, cleared on close. Cookies: tiny (~4KB), sent with EVERY HTTP request, and the right tool for auth because they support HttpOnly (invisible to JS — mitigates XSS token theft), Secure and SameSite (CSRF defence). Never store JWTs/secrets in localStorage if XSS is a concern.'),
      code(
        'localStorage.setItem("theme", "dark");\n' +
        'localStorage.getItem("theme");  // persists across sessions\n\n' +
        'sessionStorage.setItem("draft", text); // gone when tab closes\n\n' +
        '// Secure auth cookie (set by the SERVER):\n' +
        '// Set-Cookie: token=...; HttpOnly; Secure; SameSite=Strict',
        'javascript', 'Storage trade-offs'
      )
    ]),
    sub('Native <dialog> & <details>', [
      desc('<dialog> is a built-in modal: showModal() opens it with a backdrop, focus trapping and Esc-to-close for free; close() (or a form with method="dialog") closes it and restores focus. <details>/<summary> is a native disclosure/accordion needing zero JS. Preferring these over hand-rolled widgets removes a lot of accessibility risk.'),
      code(
        '<dialog id="confirm">\n' +
        '  <form method="dialog">\n' +
        '    <p>Delete this item?</p>\n' +
        '    <button value="cancel">Cancel</button>\n' +
        '    <button value="ok">Delete</button>\n' +
        '  </form>\n' +
        '</dialog>\n' +
        '<script>document.getElementById("confirm").showModal();</script>\n\n' +
        '<details><summary>More info</summary><p>Hidden until toggled.</p></details>',
        'html', 'Modal + accordion, no libs'
      )
    ]),
    sub('<template> & <slot>', [
      desc('<template> holds inert, un-rendered markup (parsed but not displayed or run) that you clone in JS — the efficient way to stamp out repeated DOM. <slot> is a placeholder inside a Web Component’s shadow DOM where the host’s light-DOM children are projected (like Angular ng-content). Together they underpin native component reuse.'),
      code(
        '<template id="row"><li class="item"><span class="name"></span></li></template>\n' +
        '<script>\n' +
        '  const tpl = document.getElementById("row");\n' +
        '  const node = tpl.content.cloneNode(true);\n' +
        '  node.querySelector(".name").textContent = "Alice";\n' +
        '  document.querySelector("ul").append(node);\n' +
        '</script>',
        'html', 'Clone a template'
      )
    ]),
    sub('Web Components & Shadow DOM', [
      desc('Web Components are a browser-native, framework-agnostic component model from three specs: Custom Elements (define your own tags via customElements.define with lifecycle callbacks like connectedCallback), Shadow DOM (attachShadow gives encapsulated, style-scoped DOM so outside CSS cannot leak in), and HTML Templates.'),
      code(
        'class UserBadge extends HTMLElement {\n' +
        '  connectedCallback() {\n' +
        '    const shadow = this.attachShadow({ mode: "open" });\n' +
        '    shadow.innerHTML = `<style>b{color:teal}</style>\n' +
        '      <b>${this.getAttribute("name")}</b>`;\n' +
        '  }\n' +
        '}\n' +
        'customElements.define("user-badge", UserBadge);\n' +
        '// <user-badge name="Alice"></user-badge>',
        'javascript', 'A custom element'
      )
    ]),
    sub('iframes & Sandboxing', [
      desc('<iframe> embeds another document; it is a security boundary but also an attack surface. The sandbox attribute strips ALL privileges by default and you opt back in per token (allow-scripts, allow-forms, allow-same-origin — granting the last two together defeats the purpose). Use loading="lazy" for offscreen frames, referrerpolicy to limit leakage, and allow to gate powerful features (camera, fullscreen). Prefer sandbox for any untrusted embed.'),
      code(
        '<iframe src="https://widget.example.com"\n' +
        '        sandbox="allow-scripts"\n' +
        '        loading="lazy"\n' +
        '        referrerpolicy="no-referrer"\n' +
        '        title="Third-party widget"></iframe>',
        'html', 'Locked-down embed'
      )
    ]),
    sub('How the Browser Renders HTML', [
      desc('The critical rendering path: 1) parse HTML into the DOM tree (bytes → tokens → nodes → tree); 2) parse CSS into the CSSOM; 3) combine DOM+CSSOM into the render tree (visible nodes only — display:none is excluded); 4) Layout/reflow computes each box’s geometry; 5) Paint fills pixels; 6) Composite layers to the screen. CSS is render-blocking; a synchronous <script> blocks parsing (it can read/modify the DOM built so far). Minimising render-blocking resources and avoiding layout thrash is core to fast pages.')
    ]),
    sub('Progressive Enhancement', [
      desc('Build a baseline that works with semantic HTML alone (content readable, links/forms functional), then layer CSS for presentation and JS for enhancement — so the page degrades gracefully if JS fails or is slow. Contrast with graceful degradation (start rich, remove features). Progressive enhancement improves resilience, accessibility and SEO, and is why server-rendered semantic HTML still matters in a SPA world.')
    ])
  ]
};

const htmlTopics = [htmlFundamentals, htmlSemanticsForms, htmlA11ySeoPerf, htmlAdvanced];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // 1) Ensure the HTML language tab exists (idempotent; usually already there).
    const existingTab = await LanguageTab.findOne({ code: 'html' });
    if (existingTab) {
      console.log('HTML language tab already exists - leaving it in place.');
    } else {
      await LanguageTab.create({ name: 'HTML', code: 'html', order: 1, isActive: true });
      console.log('Created HTML language tab.');
    }

    // 2) Remove ONLY the topics this script seeds (match by exact title), plus the
    //    titles used by the earlier 5-topic version of this seed, so re-runs never
    //    duplicate and never touch "HTML Basics" or other topics.
    const legacyTitles = [
      'HTML5 Semantics & Document Structure',
      'HTML Forms & Native Validation',
      'HTML Accessibility (a11y)',
      'HTML Metadata, SEO & Performance'
    ];
    const seededTitles = [...htmlTopics.map(t => t.title), ...legacyTitles];
    const removed = await Topic.deleteMany({ title: { $in: seededTitles } });
    console.log('Removed ' + removed.deletedCount + ' previously seeded HTML interview topics.');

    // 3) Insert fresh topics
    await Topic.insertMany(htmlTopics);
    console.log('Inserted ' + htmlTopics.length + ' HTML interview topics (one per level):');
    htmlTopics.forEach(t => console.log('  - [' + t.difficultyLevel + '] ' + t.title + ' (' + t.subtopics.length + ' subtopics)'));

    console.log('\nDone. Open the HTML tab and browse Beginner / Intermediate / Advance / Expert.');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

seed();
