import { environment } from '../../environments/environment';
import { installDevToolsGuard } from './devtools-guard';

/**
 * installDevToolsGuard() guards itself with a module-private `installed` flag that is
 * never reset (by design — it's meant to run once per real page load). That means this
 * whole file gets exactly one real chance, across the entire test run, to prove the
 * "installs and blocks" path — a second call anywhere, in this file or any other, is
 * permanently a no-op.
 *
 * This project's Jasmine config runs specs in random order (the default since
 * jasmine-core ~3), so two sibling `it()`/`describe()` blocks cannot be relied on to run
 * in the order they're written — an earlier draft of this file had a separate
 * "does nothing outside production" test as its own top-level `it()`, and it flaked
 * exactly on this: when the "once installed" block's setup happened to run first, the
 * listeners were already attached and the "outside production" test failed, because
 * once-attached listeners keep blocking regardless of the *current* value of
 * `environment.production` — only installDevToolsGuard()'s own call decides whether to
 * attach them in the first place. `beforeAll` bodies, unlike sibling specs, are never
 * reordered relative to each other, so both steps happen here, synchronously, in one
 * `beforeAll` — guaranteeing the "prove it's inert" check always precedes the one real
 * install, no matter how the individual `it()`s below get shuffled.
 */
describe('installDevToolsGuard()', () => {
  let blockedBeforeInstall: boolean;

  beforeAll(() => {
    // Step 1: prove the guard is inert outside production — captured as a value now,
    // not asserted via a separate `it()`, so no random spec ordering can interleave it
    // with step 2 below.
    (environment as any).production = false;
    installDevToolsGuard();
    const probe = new KeyboardEvent('keydown', { key: 'F12', cancelable: true });
    window.dispatchEvent(probe);
    blockedBeforeInstall = probe.defaultPrevented;

    // Step 2: the one real install for the whole suite.
    (environment as any).production = true;
    installDevToolsGuard();
  });

  afterAll(() => {
    (environment as any).production = false;
  });

  it('did nothing outside production (F12 was not blocked, before the real install above)', () => {
    expect(blockedBeforeInstall).toBeFalse();
  });

  describe('once installed in production', () => {
    function dispatchKey(init: KeyboardEventInit, target: EventTarget = window): boolean {
      const event = new KeyboardEvent('keydown', { cancelable: true, ...init });
      target.dispatchEvent(event);
      return event.defaultPrevented;
    }

    it('blocks F12', () => {
      expect(dispatchKey({ key: 'F12' })).toBeTrue();
    });

    it('blocks Ctrl+Shift+I', () => {
      expect(dispatchKey({ key: 'i', ctrlKey: true, shiftKey: true })).toBeTrue();
    });

    it('blocks Ctrl+Shift+J', () => {
      expect(dispatchKey({ key: 'j', ctrlKey: true, shiftKey: true })).toBeTrue();
    });

    it('blocks the macOS Cmd+Option+C element-picker binding (Alt instead of Shift)', () => {
      expect(dispatchKey({ key: 'c', metaKey: true, altKey: true })).toBeTrue();
    });

    it('blocks Ctrl+U (view source) outside an editable field', () => {
      expect(dispatchKey({ key: 'u', ctrlKey: true })).toBeTrue();
    });

    it('blocks Ctrl+S (save page) outside an editable field', () => {
      expect(dispatchKey({ key: 's', ctrlKey: true })).toBeTrue();
    });

    it('does NOT block a plain Ctrl+C (an app shortcut, not a DevTools one)', () => {
      expect(dispatchKey({ key: 'c', ctrlKey: true })).toBeFalse();
    });

    it('does NOT block an unrelated key press', () => {
      expect(dispatchKey({ key: 'a' })).toBeFalse();
    });

    it('does NOT block Ctrl+U when typed inside a real input field (editing exception)', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      try {
        const event = new KeyboardEvent('keydown', { key: 'u', ctrlKey: true, cancelable: true, bubbles: true });
        input.dispatchEvent(event);
        expect(event.defaultPrevented).toBeFalse();
      } finally {
        input.remove();
      }
    });

    it('does NOT block Ctrl+U inside a CodeMirror-style contenteditable surface', () => {
      const host = document.createElement('div');
      host.className = 'cm-editor';
      const inner = document.createElement('div');
      inner.setAttribute('contenteditable', 'true');
      host.appendChild(inner);
      document.body.appendChild(host);
      try {
        const event = new KeyboardEvent('keydown', { key: 'u', ctrlKey: true, cancelable: true, bubbles: true });
        inner.dispatchEvent(event);
        expect(event.defaultPrevented).toBeFalse();
      } finally {
        host.remove();
      }
    });

    it('blocks right-click (contextmenu) outside the code editor', () => {
      const event = new MouseEvent('contextmenu', { cancelable: true, bubbles: true });
      document.body.dispatchEvent(event);
      expect(event.defaultPrevented).toBeTrue();
    });

    it('does NOT block right-click inside the code editor (cut/copy/paste must still work)', () => {
      const host = document.createElement('div');
      host.className = 'cm-editor';
      document.body.appendChild(host);
      try {
        const event = new MouseEvent('contextmenu', { cancelable: true, bubbles: true });
        host.dispatchEvent(event);
        expect(event.defaultPrevented).toBeFalse();
      } finally {
        host.remove();
      }
    });

    it('calling installDevToolsGuard() again is a no-op (idempotent — the installed flag never resets)', () => {
      expect(() => installDevToolsGuard()).not.toThrow();
      expect(dispatchKey({ key: 'F12' })).toBeTrue(); // still blocked, not double-blocked-into-an-error
    });
  });
});
