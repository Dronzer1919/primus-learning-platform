import { Component } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { ThemeService } from './services/theme.service';
import { SeoService } from './services/seo.service';
import { AuthService } from './services/auth.service';
import { GuestMigrationService } from './core/guest-migration.service';
import { NavHistoryService } from './services/nav-history.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  standalone: true,
  imports: [IonicModule],
})
export class AppComponent {
  constructor(
    private themeService: ThemeService,
    seoService: SeoService,
    authService: AuthService,
    migrationService: GuestMigrationService,
    // Injected only to construct it here: it records navigation from the first route
    // onward, and a lazily-created instance would miss everything before the first
    // page that happened to need a back button.
    navHistoryService: NavHistoryService
  ) {
    seoService.init();
    authService.justAuthenticated.subscribe(() => migrationService.checkAndOfferMigration());
  }
}
