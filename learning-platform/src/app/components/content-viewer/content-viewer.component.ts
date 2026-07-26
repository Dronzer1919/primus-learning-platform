import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { ContentService } from '../../services/content.service';
import { Topic, Subtopic, ContentBlock } from '../../models/content.model';

@Component({
  selector: 'app-content-viewer',
  templateUrl: './content-viewer.component.html',
  styleUrls: ['./content-viewer.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class ContentViewerComponent implements OnInit {
  topic: Topic | null = null;
  subtopic: Subtopic | null = null;
  contentBlocks: ContentBlock[] = [];
  loading = true;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private contentService: ContentService
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      const topicId = params['topicId'];
      const subtopicId = params['subtopicId'];
      this.loadContent(topicId, subtopicId);
    });
  }

  loadContent(topicId: string, subtopicId: string) {
    this.loading = true;
    this.error = '';
    
    this.contentService.getSubtopicContent(topicId, subtopicId).subscribe({
      next: (data) => {
        if (data) {
          this.topic = {
            id: data.topic.id,
            title: data.topic.title,
            description: data.topic.description,
            difficultyLevel: 'beginner',
            languagePlatform: 'html',
            order: 0,
            subtopics: []
          };
          
          this.subtopic = {
            id: data.subtopic._id || data.subtopic.id,
            topicId: topicId,
            title: data.subtopic.title,
            order: data.subtopic.order,
            content: data.subtopic.content || []
          };
          
          this.contentBlocks = this.subtopic.content.sort((a, b) => a.order - b.order);
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading content:', error);
        this.error = 'Failed to load content. Please try again.';
        this.loading = false;
      }
    });
  }

  // Thumbnail + watch-page URL for a no-iframe YouTube link card. hqdefault always
  // exists for a valid video id (maxres does not), so it is the safe default.
  getYoutubeThumbnail(videoId: string): string {
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  }

  getYoutubeWatchUrl(videoId: string): string {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  copyCode(code: string) {
    navigator.clipboard.writeText(code);
  }
}
