import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { NavHistoryService } from '../../services/nav-history.service';
import { User } from '../../models/user.model';
import { ThemeSelectorComponent } from '../../components/theme-selector/theme-selector.component';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.page.html',
  styleUrls: ['./admin.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, RouterModule, ThemeSelectorComponent]
})
export class AdminPage implements OnInit {
  currentUser: User | null = null;
  // Below `md` the sidebar is an overlay drawer; starting it open would cover the
  // dashboard on first paint. Above it, the sidebar is part of the layout.
  isSidebarOpen = !AdminPage.isOverlayViewport();
  selectedMenu = 'dashboard';

  // Matches the `md` breakpoint in src/theme/breakpoints.scss, where admin.page.scss
  // switches the sidebar from an in-flow column to an overlay drawer.
  private static readonly OVERLAY_MAX_WIDTH = 768;

  // Last known side of the overlay boundary, so a resize only resets the drawer when
  // the layout mode actually changes (see onViewportResize).
  private wasOverlayViewport = AdminPage.isOverlayViewport();

  private static isOverlayViewport(): boolean {
    return typeof window !== 'undefined' && window.innerWidth <= AdminPage.OVERLAY_MAX_WIDTH;
  }

  menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid-outline', route: '/admin' },
    { id: 'language-tabs', label: 'Language Tabs', icon: 'pricetags-outline', route: '/admin/language-tabs' },
    { id: 'beginner', label: 'Beginner', icon: 'leaf-outline', route: '/admin/topics/beginner' },
    { id: 'intermediate', label: 'Intermediate', icon: 'fitness-outline', route: '/admin/topics/intermediate' },
    { id: 'advance', label: 'Advance', icon: 'rocket-outline', route: '/admin/topics/advance' },
    { id: 'expert', label: 'Expert', icon: 'trophy-outline', route: '/admin/topics/expert' },
    { id: 'playground', label: 'Playground Settings', icon: 'code-slash-outline', route: '/admin/playground' },
    { id: 'issues', label: 'Reported Issues', icon: 'flag-outline', route: '/admin/issues' }
  ];

  constructor(
    private authService: AuthService,
    private navHistory: NavHistoryService,
    private router: Router
  ) {}

  /**
   * Shown on every admin child route, and on the dashboard itself once the visitor has
   * been somewhere in the app. Hidden only on a cold landing at /admin, where back
   * would be a no-op.
   */
  get showBackButton(): boolean {
    const path = this.router.url.split('?')[0].split('#')[0];
    return path !== '/admin' || this.navHistory.canGoBack;
  }

  // Back control for the phone toolbar. Falls back to the dashboard, which is this
  // shell's own root, rather than out of the admin area.
  goBack(): void {
    this.navHistory.back('/admin');
  }

  ngOnInit() {
    this.currentUser = this.authService.currentUserValue;
    if (!this.currentUser || !this.authService.isAdmin()) {
      this.router.navigate(['/login']);
    }
  }

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  // Only *crossing* the overlay boundary resets the drawer, so an admin who collapsed
  // the rail on desktop keeps that choice through ordinary window resizes.
  @HostListener('window:resize')
  onViewportResize() {
    const isOverlay = AdminPage.isOverlayViewport();
    if (isOverlay === this.wasOverlayViewport) return;
    this.wasOverlayViewport = isOverlay;
    this.isSidebarOpen = !isOverlay;
  }

  selectMenu(menuId: string, route: string) {
    this.selectedMenu = menuId;
    // In overlay mode the drawer sits on top of the page it just navigated to.
    if (AdminPage.isOverlayViewport()) {
      this.isSidebarOpen = false;
    }
    this.router.navigate([route]);
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
