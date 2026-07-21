import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { combineLatest, Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { ContentService } from '../../services/content.service';
import { User } from '../../models/user.model';
import { LanguageTab, LanguagePlatform, DifficultyLevel } from '../../models/content.model';

// A language tab plus whether it has any content (tabs without data are disabled + moved right)
type OrderedTab = LanguageTab & { disabled: boolean };

// Inbuilt cartoon / spooky avatars, drawn as self-contained SVG data URIs (no assets needed).
const svgAvatar = (s: string) => 'data:image/svg+xml,' + encodeURIComponent(s);
const SPOOKY_AVATARS: string[] = [
  // Ghost
  svgAvatar("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='#7c3aed'/><path d='M24 80V47a26 26 0 0 1 52 0v33l-9-7-8 7-9-7-8 7-9-7z' fill='#f8fafc'/><circle cx='41' cy='49' r='5' fill='#0f172a'/><circle cx='59' cy='49' r='5' fill='#0f172a'/><ellipse cx='50' cy='63' rx='5' ry='7' fill='#0f172a'/></svg>"),
  // One-eyed green cyclops
  svgAvatar("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='#065f46'/><circle cx='50' cy='52' r='30' fill='#34d399'/><circle cx='50' cy='49' r='12' fill='#fff'/><circle cx='50' cy='50' r='5' fill='#0f172a'/><path d='M45 68l2 7 2-7zM53 68l2 7 2-7z' fill='#fff'/><path d='M40 68q10 8 20 0' stroke='#0f172a' stroke-width='3' fill='none'/></svg>"),
  // Blue fanged monster
  svgAvatar("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='#1e3a8a'/><circle cx='50' cy='52' r='30' fill='#60a5fa'/><circle cx='41' cy='48' r='7' fill='#fff'/><circle cx='41' cy='49' r='3.5' fill='#0f172a'/><circle cx='59' cy='48' r='7' fill='#fff'/><circle cx='59' cy='49' r='3.5' fill='#0f172a'/><rect x='40' y='62' width='20' height='8' rx='3' fill='#0f172a'/><path d='M44 62l2 8 2-8zM52 62l2 8 2-8z' fill='#fff'/></svg>"),
  // Jack-o'-lantern pumpkin
  svgAvatar("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='#7c2d12'/><rect x='47' y='20' width='6' height='11' rx='2' fill='#166534'/><circle cx='50' cy='55' r='30' fill='#f97316'/><polygon points='36,48 48,52 36,58' fill='#0f172a'/><polygon points='64,48 52,52 64,58' fill='#0f172a'/><path d='M37 65q13 11 26 0q-6 -3 -13 1q-7 -4 -13 -1z' fill='#0f172a'/></svg>"),
  // Red horned devil
  svgAvatar("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='#450a0a'/><polygon points='34,32 29,15 41,27' fill='#991b1b'/><polygon points='66,32 71,15 59,27' fill='#991b1b'/><circle cx='50' cy='55' r='28' fill='#ef4444'/><circle cx='42' cy='52' r='4' fill='#0f172a'/><circle cx='58' cy='52' r='4' fill='#0f172a'/><path d='M40 65q10 8 20 0' stroke='#0f172a' stroke-width='3' fill='none'/></svg>"),
  // Teal alien
  svgAvatar("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='#134e4a'/><ellipse cx='50' cy='54' rx='26' ry='31' fill='#5eead4'/><ellipse cx='41' cy='52' rx='6' ry='10' fill='#0f172a'/><ellipse cx='59' cy='52' rx='6' ry='10' fill='#0f172a'/><path d='M44 71q6 4 12 0' stroke='#0f172a' stroke-width='2' fill='none'/></svg>")
];
import { UserTopicListComponent } from '../../components/user-topic-list/user-topic-list.component';
import { ThemeSelectorComponent } from '../../components/theme-selector/theme-selector.component';

@Component({
  selector: 'app-user',
  templateUrl: './user.page.html',
  styleUrls: ['./user.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, RouterModule, UserTopicListComponent, ThemeSelectorComponent]
})
export class UserPage implements OnInit, OnDestroy {
  currentUser: User | null = null;
  orderedTabs: OrderedTab[] = [];
  selectedLanguage: LanguagePlatform = 'html';
  isSidebarOpen = true;
  isPlaygroundRoute = false;
  hideSidebar = false;

  // Routes that own the full width and have nothing to navigate with the topic sidebar.
  // Note 'sessions' also matches 'playground-sessions' — intended, both hide the sidebar.
  private static readonly SIDEBAR_HIDDEN_ROUTES = ['playground-sessions', 'notes', 'sessions'];
  isProfileOpen = false;
  private routeSub!: Subscription;
  profileEvent?: Event;              // anchors the popover under the avatar (dropdown)
  avatarUrl: string | null = null;   // uploaded photo or a chosen inbuilt avatar
  spookyAvatars = SPOOKY_AVATARS;

  difficultyLevels: Array<{id: DifficultyLevel, label: string, icon: string, color: string}> = [
    { id: 'beginner', label: 'Beginner', icon: 'leaf-outline', color: 'success' },
    { id: 'intermediate', label: 'Intermediate', icon: 'fitness-outline', color: 'warning' },
    { id: 'advance', label: 'Advance', icon: 'rocket-outline', color: 'danger' },
    { id: 'expert', label: 'Expert', icon: 'trophy-outline', color: 'secondary' }
  ];

  constructor(
    private authService: AuthService,
    private contentService: ContentService,
    private router: Router
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.currentUserValue;
    if (!this.currentUser) {
      this.router.navigate(['/login']);
      return;
    }
    this.avatarUrl = localStorage.getItem(this.avatarKey());

    // Auto-hide the sidebar on the full-width routes (playground sessions, notes, sessions)
    this.applyRouteFlags(this.router.url);
    this.routeSub = this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => this.applyRouteFlags(e.urlAfterRedirects as string));

    // Build the tab list: tabs that have content first, empty tabs moved to the
    // far right and disabled. Recomputes whenever tabs or topics change.
    combineLatest([this.contentService.languageTabs$, this.contentService.topics$]).subscribe(([tabs, topics]) => {
      const langsWithData = new Set(topics.map(t => t.languagePlatform));
      const active = tabs.filter(t => t.isActive).sort((a, b) => a.order - b.order);
      const withData = active.filter(t => langsWithData.has(t.code));
      const withoutData = active.filter(t => !langsWithData.has(t.code));

      this.orderedTabs = [
        ...withData.map(t => ({ ...t, disabled: false })),
        ...withoutData.map(t => ({ ...t, disabled: true }))
      ];

      // Keep the selection on a tab that actually has content.
      if (withData.length && !langsWithData.has(this.selectedLanguage)) {
        this.selectedLanguage = withData[0].code;
      }
    });
  }

  selectLanguage(tab: OrderedTab) {
    if (tab.disabled) return; // empty tabs are not selectable
    this.selectedLanguage = tab.code;
  }

  // Derives the per-route chrome flags. isSidebarOpen is deliberately left alone: the
  // sidebar is removed from the DOM while hidden, so forcing it closed here would only
  // discard the user's expanded/collapsed choice when they navigate back to a topic.
  private applyRouteFlags(url: string): void {
    this.isPlaygroundRoute = url.includes('playground-sessions');
    this.hideSidebar = UserPage.SIDEBAR_HIDDEN_ROUTES.some((route) => url.includes(route));
  }

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  // While collapsed the sidebar is an icon rail with the topic lists hidden, so tapping a
  // difficulty icon reopens it. Expanded, the header is not a control and this is a no-op.
  expandSidebarIfCollapsed() {
    if (!this.isSidebarOpen) {
      this.isSidebarOpen = true;
    }
  }

  // Auto-close the sidebar after picking a topic only on small screens (overlay mode).
  onTopicSelected() {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      this.isSidebarOpen = false;
    }
  }

  get greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  get userInitial(): string {
    return (this.currentUser?.username?.charAt(0) || 'U').toUpperCase();
  }

  get userPhone(): string | null {
    return (this.currentUser as any)?.phone || null;
  }

  // ---- Profile dropdown + avatar ----
  openProfile(ev: Event) {
    this.profileEvent = ev;
    this.isProfileOpen = true;
  }

  private avatarKey(): string {
    return `avatar_${this.currentUser?.id || 'guest'}`;
  }

  private saveAvatar(url: string | null) {
    this.avatarUrl = url;
    if (url) {
      localStorage.setItem(this.avatarKey(), url);
    } else {
      localStorage.removeItem(this.avatarKey());
    }
  }

  selectAvatar(url: string) {
    this.saveAvatar(url);
  }

  clearAvatar() {
    this.saveAvatar(null);
  }

  onAvatarFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please choose an image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('Image is too large. Please pick one under 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => this.saveAvatar(reader.result as string);
    reader.readAsDataURL(file);
    input.value = ''; // allow re-selecting the same file
  }

  ngOnDestroy() {
    this.routeSub?.unsubscribe();
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  navigateToPlayground() {
    this.router.navigate(['/user/playground']);
  }

  // Returns to the topic view, where the sidebar is available again.
  navigateHome() {
    this.router.navigate(['/user/home']);
  }

  navigateToPlaygroundSessions() {
    this.router.navigate(['/user/playground-sessions']);
  }

  navigateToNotes() {
    this.router.navigate(['/user/notes']);
  }

  navigateToSessions() {
    this.router.navigate(['/user/sessions']);
  }
}
