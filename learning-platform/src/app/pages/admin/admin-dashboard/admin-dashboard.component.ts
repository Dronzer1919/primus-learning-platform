import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
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

  constructor(
    private contentService: ContentService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.loadStats();
    this.loadUserStats();
    // Refresh active users every 30 seconds
    this.refreshInterval = setInterval(() => this.loadUserStats(), 30000);
  }

  ngOnDestroy() {
    clearInterval(this.refreshInterval);
  }

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
    this.authService.getStats().subscribe({
      next: (s) => { this.userStats = s; this.userStatsLoading = false; },
      error: () => { this.userStatsLoading = false; }
    });
  }
}
