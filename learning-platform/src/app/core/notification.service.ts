// One place that turns a failure into something the user actually sees.
//
// The important behaviour here is suppression. When the backend goes down, or
// an IP trips the API's rate limiter, every in-flight request fails at once —
// the dashboard poll, the notes list, the session list. Without de-duplication
// that is five identical toasts stacked over the UI, and a retry storm turns it
// into fifty. The same message is therefore shown at most once per window.

import { Injectable, inject } from '@angular/core';
import { ToastController } from '@ionic/angular';

/** How long the same message stays suppressed after being shown. */
const DEDUPE_WINDOW_MS = 6000;

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly toastController = inject(ToastController);

  /** message -> epoch ms after which it may be shown again. */
  private readonly shownAt = new Map<string, number>();

  /** Guards against two toasts being created before either has presented. */
  private presenting = false;

  async error(message: string): Promise<void> {
    await this.show(message, 'danger', 3400);
  }

  async warn(message: string): Promise<void> {
    await this.show(message, 'warning', 2800);
  }

  async success(message: string): Promise<void> {
    await this.show(message, 'success', 1800);
  }

  private async show(message: string, color: string, duration: number): Promise<void> {
    const now = Date.now();
    const suppressedUntil = this.shownAt.get(message) ?? 0;
    if (now < suppressedUntil) return;

    // Sweep before inserting so this map cannot grow without bound across a long
    // session — every distinct error message would otherwise be kept forever.
    for (const [key, expiry] of this.shownAt) {
      if (expiry <= now) this.shownAt.delete(key);
    }
    this.shownAt.set(message, now + DEDUPE_WINDOW_MS);

    if (this.presenting) return;
    this.presenting = true;
    try {
      const toast = await this.toastController.create({
        message,
        duration,
        color,
        position: 'bottom',
        cssClass: 'app-toast',
        icon: color === 'danger' ? 'alert-circle-outline' : 'information-circle-outline'
      });
      await toast.present();
    } catch {
      // A toast that fails to render must never become the thing that breaks the
      // page — this is the error path already.
    } finally {
      this.presenting = false;
    }
  }
}
