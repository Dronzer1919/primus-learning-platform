import { Inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter, mergeMap } from 'rxjs/operators';

export interface SeoData {
  title: string;
  description: string;
  /** Route path with a leading slash, e.g. '/flowchart'. Used for canonical + og:url. */
  path: string;
}

const SITE_ORIGIN = 'https://primuscodex.com';
const DEFAULT_TITLE = 'Online Compiler — Primus Codex';
const DEFAULT_DESCRIPTION =
  'Free online compiler and learning platform — run HTML/CSS/JS & TypeScript in the browser, visualize code execution, and study interview topics.';

// index.html ships one static <title>/description/canonical for the whole SPA shell.
// Every route otherwise inherited that same tag set, so Google saw /flowchart and
// /login as duplicates canonicalized to the homepage. This updates them per route
// on every navigation instead.
@Injectable({ providedIn: 'root' })
export class SeoService {
  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private title: Title,
    private meta: Meta,
    @Inject(DOCUMENT) private doc: Document
  ) {}

  init(): void {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        mergeMap(() => {
          let route = this.activatedRoute;
          while (route.firstChild) {
            route = route.firstChild;
          }
          return route.data;
        })
      )
      .subscribe((data) => this.apply(data['seo'] as SeoData | undefined));
  }

  private apply(seo: SeoData | undefined): void {
    const path = seo?.path ?? '/';
    const title = seo?.title ?? DEFAULT_TITLE;
    const description = seo?.description ?? DEFAULT_DESCRIPTION;
    const url = path === '/' ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${path}`;

    this.title.setTitle(title);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:url', content: url });

    let canonical = this.doc.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = this.doc.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(canonical);
    }
    canonical.setAttribute('href', url);
  }
}
