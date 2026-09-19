import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { AppComponent } from './app.component';
import { ThemeService } from './services/theme.service';
import { SeoService } from './services/seo.service';
import { AuthService } from './services/auth.service';
import { GuestMigrationService } from './core/guest-migration.service';
import { NavHistoryService } from './services/nav-history.service';
import { User } from './models/user.model';

// FIX (documented, not silent): this spec previously failed with
// "NG0201: No provider found for HttpClient" — AppComponent's constructor builds
// AuthService for real, which itself injects HttpClient, and the original spec provided
// nothing but a router. This was the pre-existing bug flagged back in Module 1 and
// deferred to this module (App Shell & Routing), where AppComponent actually lives.
// Rather than pull in the whole real dependency graph (AuthService -> HttpClient,
// GuestMigrationService -> AlertController/ToastController/4 session services,
// SeoService -> Router/ActivatedRoute/Title/Meta/DOCUMENT), every constructor
// dependency is mocked directly — consistent with how the rest of this suite tests
// components against their real class boundaries rather than their transitive closure.
describe('AppComponent', () => {
  let themeService: jasmine.SpyObj<ThemeService>;
  let seoService: jasmine.SpyObj<SeoService>;
  let authService: jasmine.SpyObj<AuthService>;
  let migrationService: jasmine.SpyObj<GuestMigrationService>;
  let navHistory: jasmine.SpyObj<NavHistoryService>;
  let justAuthenticated: Subject<User>;

  beforeEach(async () => {
    themeService = jasmine.createSpyObj<ThemeService>('ThemeService', ['getCurrentTheme', 'setTheme']);
    seoService = jasmine.createSpyObj<SeoService>('SeoService', ['init']);
    justAuthenticated = new Subject<User>();
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['isAuthenticated'], {
      justAuthenticated: justAuthenticated.asObservable()
    });
    migrationService = jasmine.createSpyObj<GuestMigrationService>('GuestMigrationService', ['checkAndOfferMigration']);
    migrationService.checkAndOfferMigration.and.resolveTo();
    navHistory = jasmine.createSpyObj<NavHistoryService>('NavHistoryService', ['back']);

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: ThemeService, useValue: themeService },
        { provide: SeoService, useValue: seoService },
        { provide: AuthService, useValue: authService },
        { provide: GuestMigrationService, useValue: migrationService },
        { provide: NavHistoryService, useValue: navHistory }
      ]
    }).compileComponents();
  });

  it('creates the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('initializes SEO tracking on construction', () => {
    TestBed.createComponent(AppComponent);
    expect(seoService.init).toHaveBeenCalled();
  });

  it('offers guest-data migration when a user just authenticated', () => {
    TestBed.createComponent(AppComponent);
    justAuthenticated.next({ id: '1', email: 'a@b.com', username: 'alice', role: 'user', createdAt: new Date() });
    expect(migrationService.checkAndOfferMigration).toHaveBeenCalled();
  });

  it('does not offer migration on construction alone (only after an actual justAuthenticated event)', () => {
    TestBed.createComponent(AppComponent);
    expect(migrationService.checkAndOfferMigration).not.toHaveBeenCalled();
  });

  it('constructs NavHistoryService eagerly (so it starts tracking from the very first route)', () => {
    // Merely injecting NavHistoryService in the constructor (without calling any method
    // on it) is the whole point — Angular instantiates a providedIn:'root' service the
    // first time something asks for it, and this is deliberately that "something", per
    // the comment in app.component.ts. Constructing AppComponent must not throw purely
    // because that dependency exists.
    expect(() => TestBed.createComponent(AppComponent)).not.toThrow();
  });
});
