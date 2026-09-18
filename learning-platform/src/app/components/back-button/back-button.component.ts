import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { NavHistoryService } from '../../services/nav-history.service';

/**
 * Back control for the app's custom (non-`ion-toolbar`) headers — the playground app
 * bar, the sessions sidebar, and anywhere else a page draws its own chrome.
 *
 * Hidden above `md` by default: desktop keeps the browser's own back button in easy
 * reach and the pages show their full navigation, while a phone has neither. Pass
 * `[alwaysShow]="true"` where a page wants it at every width.
 *
 * Headers built from `ion-toolbar` use a plain `ion-button` with the `.mobile-back`
 * global class instead, so the control matches its siblings in the toolbar.
 */
@Component({
  selector: 'app-back-button',
  standalone: true,
  imports: [CommonModule, IonicModule],
  template: `
    <button
      type="button"
      class="back-btn"
      [class.has-label]="!!label"
      [attr.aria-label]="label || 'Go back'"
      (click)="goBack()"
    >
      <ion-icon name="arrow-back-outline"></ion-icon>
      <span *ngIf="label">{{ label }}</span>
    </button>
  `,
  styles: [
    `
      :host {
        display: none;
      }

      :host(.always-show) {
        display: inline-flex;
      }

      @media (max-width: 768px) {
        :host {
          display: inline-flex;
        }
      }

      .back-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        /* 44px keeps the target tappable even though the glyph is 24px. */
        min-width: 44px;
        height: 44px;
        padding: 0;
        border: none;
        border-radius: 50%;
        background: transparent;
        /* Inherits whatever header it sits in, so it needs no per-host theming. */
        color: inherit;
        font: inherit;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
      }

      .back-btn.has-label {
        padding: 0 12px;
        border-radius: 22px;
      }

      .back-btn ion-icon {
        font-size: 24px;
      }

      .back-btn:active {
        background: color-mix(in srgb, currentColor, transparent 88%);
      }

      .back-btn:focus-visible {
        outline: 2px solid var(--ion-color-primary);
        outline-offset: -2px;
      }
    `,
  ],
  host: { '[class.always-show]': 'alwaysShow' },
})
export class BackButtonComponent {
  /** Where to go when this page was the entry point and there is nothing to pop. */
  @Input() defaultHref = '/';
  /** Optional text beside the arrow; icon-only when omitted. */
  @Input() label?: string;
  /** Render above `md` too, for pages with no other way back. */
  @Input() alwaysShow = false;

  constructor(private navHistory: NavHistoryService) {}

  goBack(): void {
    this.navHistory.back(this.defaultHref);
  }
}
