import { Component } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { ThemeService } from './services/theme.service';
import { SeoService } from './services/seo.service';
import { AuthService } from './services/auth.service';
import { GuestMigrationService } from './core/guest-migration.service';

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
    migrationService: GuestMigrationService
  ) {
    seoService.init();
    authService.justAuthenticated.subscribe(() => migrationService.checkAndOfferMigration());
  }
}
