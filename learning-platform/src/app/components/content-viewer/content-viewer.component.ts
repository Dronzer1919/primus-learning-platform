import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { ContentService } from '../../services/content.service';
import { Topic, Subtopic, ContentBlock } from '../../models/content.model';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

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
    private contentService: ContentService,
    private sanitizer: DomSanitizer
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

  getYoutubeUrl(videoId: string): SafeResourceUrl {
    const url = `https://www.youtube.com/embed/${videoId}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  copyCode(code: string) {
    navigator.clipboard.writeText(code);
  }
}
