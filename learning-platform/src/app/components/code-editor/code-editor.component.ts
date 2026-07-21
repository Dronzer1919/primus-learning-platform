import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild, effect } from '@angular/core';
import { Compartment, EditorState, Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { oneDarkHighlightStyle } from '@codemirror/theme-one-dark';
import { ThemeService, Theme } from '../../services/theme.service';

export type CodeEditorLanguage = 'javascript' | 'typescript' | 'html' | 'css';

// Themes whose compiler surfaces are light — the editor uses dark-on-light syntax colours for them.
// Every other theme uses the dark, theme-tinted hierarchy with One Dark tokens.
const LIGHT_EDITOR_THEMES: ReadonlySet<Theme> = new Set<Theme>(['default']);

// Editor chrome colours are driven by the active theme's CSS variables (see theme/variables.scss),
// so the code surface matches the theme's hierarchy. Only the highlight style and the light/dark
// selection overlays differ between the light and dark variants.
const editorChromeDark = EditorView.theme(
  {
    '&': { backgroundColor: 'var(--editor-bg)', color: 'var(--editor-fg)' },
    '.cm-content': { caretColor: 'var(--editor-fg)' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--editor-fg)' },
    '.cm-gutters': { backgroundColor: 'var(--editor-tab-bg)', color: 'var(--editor-fg)', border: 'none' },
    '.cm-activeLine': { backgroundColor: 'rgba(255, 255, 255, 0.06)' },
    '.cm-activeLineGutter': { backgroundColor: 'rgba(255, 255, 255, 0.09)' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(255, 255, 255, 0.18)'
    }
  },
  { dark: true }
);

const editorChromeLight = EditorView.theme(
  {
    '&': { backgroundColor: 'var(--editor-bg)', color: 'var(--editor-fg)' },
    '.cm-content': { caretColor: 'var(--editor-fg)' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--editor-fg)' },
    '.cm-gutters': { backgroundColor: 'var(--editor-tab-bg)', color: 'var(--editor-fg)', border: 'none' },
    '.cm-activeLine': { backgroundColor: 'rgba(0, 0, 0, 0.04)' },
    '.cm-activeLineGutter': { backgroundColor: 'rgba(0, 0, 0, 0.06)' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(0, 0, 0, 0.12)'
    }
  },
  { dark: false }
);

@Component({
  selector: 'app-code-editor',
  template: '<div #editorHost class="code-editor-host"></div>',
  standalone: true
})
export class CodeEditorComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('editorHost', { static: true }) editorHost!: ElementRef<HTMLDivElement>;

  @Input() value = '';
  @Input() language: CodeEditorLanguage = 'javascript';
  @Output() valueChange = new EventEmitter<string>();

  private view?: EditorView;
  private viewReady = false;
  private themeCompartment = new Compartment();

  constructor(private themeService: ThemeService) {
    // Re-theme the live editor whenever the app theme changes (light default <-> dark themes).
    effect(() => {
      const theme = this.themeService.currentTheme();
      if (this.view) {
        this.view.dispatch({
          effects: this.themeCompartment.reconfigure(this.editorThemeExtension(theme))
        });
      }
    });
  }

  ngAfterViewInit(): void {
    // Created here (not ngOnChanges) so the host element is guaranteed to already be
    // attached to the live document — CodeMirror's style injection resolves its root
    // via getRootNode(), which returns a detached node (not `document`) if the editor
    // is constructed before Angular has inserted the view into the DOM.
    this.viewReady = true;
    this.createEditor();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.viewReady) {
      return;
    }
    if (changes['language'] && !changes['language'].firstChange) {
      this.createEditor();
      return;
    }
    if (changes['value'] && this.view && this.value !== this.view.state.doc.toString()) {
      this.view.dispatch({
        changes: { from: 0, to: this.view.state.doc.length, insert: this.value }
      });
    }
  }

  ngOnDestroy(): void {
    this.view?.destroy();
  }

  private createEditor(): void {
    this.view?.destroy();

    const state = EditorState.create({
      doc: this.value,
      extensions: [
        lineNumbers(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        this.themeCompartment.of(this.editorThemeExtension(this.themeService.currentTheme())),
        this.getLanguageExtension(),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            this.valueChange.emit(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          '&': { height: '100%', fontSize: '14px' },
          '.cm-scroller': { fontFamily: "'Courier New', Courier, monospace", overflow: 'auto' }
        })
      ]
    });

    this.view = new EditorView({
      state,
      parent: this.editorHost.nativeElement,
      // Explicit root avoids CodeMirror's automatic getRootNode() detection, which
      // returns a detached fragment (breaking its runtime style injection) when the
      // editor is constructed while nested inside Angular structural-directive views.
      root: document
    });
  }

  private editorThemeExtension(theme: Theme): Extension {
    return LIGHT_EDITOR_THEMES.has(theme)
      ? [editorChromeLight, syntaxHighlighting(defaultHighlightStyle)]
      : [editorChromeDark, syntaxHighlighting(oneDarkHighlightStyle)];
  }

  private getLanguageExtension(): Extension {
    switch (this.language) {
      case 'typescript':
        return javascript({ typescript: true });
      case 'html':
        return html();
      case 'css':
        return css();
      case 'javascript':
      default:
        return javascript();
    }
  }
}
