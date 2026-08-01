import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { ContentService } from '../../../services/content.service';
import { AuthService } from '../../../services/auth.service';
import { UserStats } from '../../../models/user.model';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  stats = {
    totalTopics: 0,
    totalSubtopics: 0,
    languageTabs: 0,
    beginner: 0,
    intermediate: 0,
    advance: 0,
    expert: 0
  };

  userStats: UserStats | null = null;
  userStatsLoading = true;

  private refreshInterval: any;
  private statsSub?: Subscription;
  /** True while a poll is in flight, so a slow API cannot stack up requests. */
  private polling = false;

  constructor(
    private contentService: ContentService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.loadStats();
    this.loadUserStats();
    // Refresh active users every 30 seconds.
    this.refreshInterval = setInterval(() => this.loadUserStats(), 30000);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  ngOnDestroy() {
    clearInterval(this.refreshInterval);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    // Leaving the page mid-poll must cancel the request, not write into a
    // destroyed component when it eventually answers.
    this.statsSub?.unsubscribe();
  }

  /**
   * A backgrounded tab keeps its timers running (throttled, but running), so an
   * admin dashboard left open overnight is ~2,800 pointless requests before
   * anyone looks at it again — with several tabs open, enough to matter to the
   * API's rate limiter. Poll only while the tab is visible, and refresh
   * immediately on return so the numbers are never stale on screen.
   */
  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') this.loadUserStats();
  };

  loadStats() {
    const topics = this.contentService.getTopics();
    const languageTabs = this.contentService.getLanguageTabs();
    this.stats.totalTopics = topics.length;
    this.stats.totalSubtopics = topics.reduce((acc, topic) => acc + topic.subtopics.length, 0);
    this.stats.languageTabs = languageTabs.length;
    this.stats.beginner = topics.filter(t => t.difficultyLevel === 'beginner').length;
    this.stats.intermediate = topics.filter(t => t.difficultyLevel === 'intermediate').length;
    this.stats.advance = topics.filter(t => t.difficultyLevel === 'advance').length;
    this.stats.expert = topics.filter(t => t.difficultyLevel === 'expert').length;
  }

  loadUserStats() {
    // Skip the tick entirely when the tab is hidden or a previous poll has not
    // come back yet. Without the in-flight check, an API slower than the 30s
    // interval accumulates overlapping requests until it recovers — precisely
    // when it can least afford them.
    if (document.visibilityState === 'hidden' || this.polling) return;

    this.polling = true;
    this.statsSub?.unsubscribe();
    this.statsSub = this.authService.getStats().subscribe({
      next: (s) => {
        this.userStats = s;
        this.userStatsLoading = false;
        this.polling = false;
      },
      // errorInterceptor has already logged and, where it matters, notified.
      // A failed background refresh just leaves the last good numbers on screen.
      error: () => {
        this.userStatsLoading = false;
        this.polling = false;
      }
    });
  }
}
