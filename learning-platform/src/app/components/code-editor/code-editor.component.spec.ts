import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CodeEditorComponent, CodeEditorLanguage } from './code-editor.component';
import { ThemeService } from '../../services/theme.service';

// A host component drives real Angular @Input/OnChanges lifecycle (constructing the
// component directly and calling ngOnChanges by hand would test our assumptions about
// Angular's lifecycle contract rather than the contract itself).
@Component({
  selector: 'app-test-host',
  standalone: true,
  imports: [CodeEditorComponent],
  template: `<app-code-editor [value]="value" [language]="language" (valueChange)="onValueChange($event)"></app-code-editor>`
})
class TestHostComponent {
  value = '';
  language: CodeEditorLanguage = 'javascript';
  lastEmitted: string | null = null;
  onValueChange(v: string): void {
    this.lastEmitted = v;
  }
}

describe('CodeEditorComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
  });

  afterEach(() => fixture?.destroy());

  function cmContent(): HTMLElement | null {
    return fixture.nativeElement.querySelector('.cm-content');
  }

  it('creates a real CodeMirror editor host', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.code-editor-host')).toBeTruthy();
    expect(cmContent()).toBeTruthy();
  });

  it('renders the initial value inside the editor', () => {
    host.value = 'const x = 1;';
    fixture.detectChanges();
    expect(cmContent()?.textContent).toBe('const x = 1;');
  });

  it('updates the editor document when the value input changes', () => {
    host.value = 'first';
    fixture.detectChanges();
    host.value = 'second';
    fixture.detectChanges();
    expect(cmContent()?.textContent).toBe('second');
  });

  it('does not touch the editor when value is set to the same string it already has (avoids an unnecessary dispatch)', () => {
    host.value = 'same';
    fixture.detectChanges();
    host.value = 'same';
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(cmContent()?.textContent).toBe('same');
  });

  it('rebuilds the editor (preserving current text) when the language input changes', () => {
    host.value = 'let x = 1;';
    host.language = 'javascript';
    fixture.detectChanges();

    host.language = 'typescript';
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(cmContent()?.textContent).toBe('let x = 1;');
  });

  it('emits valueChange when the document changes via a dispatched edit', () => {
    fixture.detectChanges();
    const editorComponent = fixture.debugElement.children[0].componentInstance as CodeEditorComponent;
    const view = (editorComponent as any).view;
    expect(view).toBeTruthy();

    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: 'typed text' } });

    expect(host.lastEmitted).toBe('typed text');
  });

  it('destroys the CodeMirror view on ngOnDestroy without throwing', () => {
    fixture.detectChanges();
    expect(() => fixture.destroy()).not.toThrow();
  });

  it('re-themes the live editor when the app theme changes, without throwing', () => {
    fixture.detectChanges();
    const themeService = TestBed.inject(ThemeService);
    expect(() => themeService.setTheme('dark')).not.toThrow();
    fixture.detectChanges();
    // The editor is still alive and rendering after a theme swap.
    expect(cmContent()).toBeTruthy();
  });

  describe('per-language syntax extension', () => {
    const cases: CodeEditorLanguage[] = ['javascript', 'typescript', 'html', 'css'];
    for (const lang of cases) {
      it(`builds without error for language="${lang}"`, () => {
        host.language = lang;
        host.value = 'x';
        expect(() => fixture.detectChanges()).not.toThrow();
        expect(cmContent()).toBeTruthy();
      });
    }
  });
});
