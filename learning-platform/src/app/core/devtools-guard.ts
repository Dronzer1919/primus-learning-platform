// Blocks the usual ways of opening DevTools: right-click → Inspect, F12, and the
// Ctrl/Cmd+Shift+I/J/C and Ctrl+U shortcuts.
//
// Be clear about what this is and is not. It is a deterrent — it raises the
// effort for a casual visitor poking at the page. It is NOT a security control,
// and it cannot be one: the browser menu still opens DevTools, so does launching
// the browser with DevTools already open, and the bundle can simply be fetched
// with curl. Everything shipped to a browser is readable by whoever receives
// it. The controls that actually protect this app are on the server —
// authentication, authorisation and rate limiting in backend/src/middleware —
// and nothing here is a substitute for them.
//
// It also runs in production builds only. Blocking F12 during development would
// make this file's own bugs impossible to debug.

import { environment } from '../../environments/environment';

/** Elements where typing is the point; only shortcuts are filtered, never keys. */
const EDITABLE = /^(input|textarea|select)$/i;

let installed = false;

export function installDevToolsGuard(): void {
  if (installed || !environment.production) return;
  installed = true;

  // Right-click → Inspect. Long-press on touch devices raises the same event.
  window.addEventListener('contextmenu', onContextMenu, { capture: true });
  window.addEventListener('keydown', onKeyDown, { capture: true });
}

function onContextMenu(event: MouseEvent): void {
  // The code editors are the exception: right-click there is how people reach
  // cut/copy/paste, and taking that away breaks the core feature of the app.
  if (isInsideEditor(event.target)) return;
  event.preventDefault();
}

function onKeyDown(event: KeyboardEvent): void {
  if (!isDevToolsShortcut(event)) return;
  event.preventDefault();
  event.stopPropagation();
}

function isDevToolsShortcut(event: KeyboardEvent): boolean {
  const key = event.key;

  // F12 — DevTools on every desktop browser.
  if (key === 'F12') return true;

  const ctrlOrCmd = event.ctrlKey || event.metaKey;
  if (!ctrlOrCmd) return false;

  const upper = key.length === 1 ? key.toUpperCase() : key;

  // Ctrl/Cmd+Shift+I (inspector), +J (console), +C (element picker).
  if (event.shiftKey && ['I', 'J', 'C'].includes(upper)) return true;

  // Cmd+Option+I/J/C — the macOS bindings, which use Alt rather than Shift.
  if (event.altKey && ['I', 'J', 'C'].includes(upper)) return true;

  // Ctrl+U (view source) and Ctrl+S (save page). Neither is blocked inside a
  // text field: Ctrl+U is "delete to line start" on some layouts, and a code
  // editor may bind Ctrl+S to its own save.
  if (!event.shiftKey && !event.altKey && ['U', 'S'].includes(upper)) {
    return !isInsideEditor(event.target);
  }

  return false;
}

function isInsideEditor(target: EventTarget | null): boolean {
  const element = target instanceof Element ? target : null;
  if (!element) return false;
  if (EDITABLE.test(element.tagName)) return true;
  // CodeMirror renders its editing surface as a contenteditable div, not a
  // textarea, so the tag check above does not catch it.
  return !!element.closest('.cm-editor, [contenteditable="true"]');
}
