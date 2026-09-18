import { Injectable } from '@angular/core';
import { Location } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

/**
 * Tracks where the user has been *inside this app*, so a back control can tell the
 * difference between "there is a previous page here" and "the previous entry belongs
 * to whatever site linked them in".
 *
 * `window.history.length` cannot make that distinction — it counts the whole browser
 * session — so calling `location.back()` on its say-so can navigate straight out of
 * the app. Every back control in the app goes through `back()` here instead.
 */
@Injectable({ providedIn: 'root' })
export class NavHistoryService {
  /** Visited in-app URLs, oldest first. Mirrors the browser stack for this app. */
  private stack: string[] = [];

  constructor(private router: Router, private location: Location) {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.record(event.urlAfterRedirects));
  }

  private record(url: string): void {
    // A back/forward step lands on a URL that is already on the stack. Unwind to it
    // rather than pushing a duplicate, so the stack keeps mirroring the browser's.
    //
    // The one case this reads wrong is a genuine forward path that revisits a URL
    // (A -> B -> A): the stack unwinds to [A] and `canGoBack` turns false, so the
    // control falls back to its defaultHref instead of returning to B. Landing one
    // level too high is the safe way to be wrong; leaving the app is not.
    const seenAt = this.stack.lastIndexOf(url);
    if (seenAt >= 0) {
      this.stack.length = seenAt + 1;
    } else {
      this.stack.push(url);
    }
  }

  /** True when a previous page in this app is reachable with `location.back()`. */
  get canGoBack(): boolean {
    return this.stack.length > 1;
  }

  /**
   * Steps back within the app, or navigates to `fallback` when this page was the
   * entry point (a deep link, a new tab, a shared URL).
   */
  back(fallback = '/'): void {
    if (this.canGoBack) {
      this.location.back();
    } else {
      this.router.navigateByUrl(fallback);
    }
  }
}
