import { Component } from '@angular/core';
import { Router, NavigationStart, NavigationEnd, NavigationCancel } from '@angular/router';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  constructor(private themeService: ThemeService, private router: Router) {
    // DEBUG: trace every navigation. `navigationTrigger` tells you what caused it —
    // 'imperative' (router.navigate/routerLink), 'popstate' (browser Back/Forward),
    // or 'hashchange'. Remove this block once the routing issue is understood.
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        console.log(
          '%c[ROUTER] start →', 'color:#2dd4a7',
          event.url,
          '| trigger:', event.navigationTrigger,
          '| restoredState:', event.restoredState ?? null,
          '| id:', event.id
        );
      } else if (event instanceof NavigationEnd) {
        console.log(
          '%c[ROUTER] end   →', 'color:#58a6ff',
          event.urlAfterRedirects,
          '(requested:', event.url + ')'
        );
      } else if (event instanceof NavigationCancel) {
        console.log('%c[ROUTER] CANCEL →', 'color:#e5484d', event.url, '| reason:', event.reason);
      }
    });
  }
}
