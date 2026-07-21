import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { trigger, transition, style, animate } from '@angular/animations';
import { ContentService } from '../../services/content.service';
import { Topic, DifficultyLevel, LanguagePlatform } from '../../models/content.model';

@Component({
  selector: 'app-user-topic-list',
  templateUrl: './user-topic-list.component.html',
  styleUrls: ['./user-topic-list.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, RouterModule],
  animations: [
    // Referenced as [@slideDown] in the template; without this trigger + provideAnimations()
    // Angular throws a synthetic-property error and the subtopics fail to expand.
    trigger('slideDown', [
      transition(':enter', [
        style({ height: 0, opacity: 0, overflow: 'hidden' }),
        animate('200ms ease-out', style({ height: '*', opacity: 1 }))
      ]),
      transition(':leave', [
        style({ overflow: 'hidden' }),
        animate('150ms ease-in', style({ height: 0, opacity: 0 }))
      ])
    ])
  ]
})
export class UserTopicListComponent implements OnInit {
  @Input() difficultyLevel!: DifficultyLevel;
  @Input() selectedLanguage!: LanguagePlatform;
  @Output() topicSelected = new EventEmitter<void>();

  topics: Topic[] = [];
  expandedTopics: Set<string> = new Set();

  constructor(private contentService: ContentService) {}

  ngOnInit() {
    this.loadTopics();
  }

  ngOnChanges() {
    this.loadTopics();
  }

  loadTopics() {
    this.contentService.topics$.subscribe(allTopics => {
      this.topics = allTopics
        .filter(t => 
          t.difficultyLevel === this.difficultyLevel && 
          t.languagePlatform === this.selectedLanguage
        )
        .sort((a, b) => a.order - b.order);
    });
  }

  toggleTopic(topicId: string) {
    if (this.expandedTopics.has(topicId)) {
      this.expandedTopics.delete(topicId);
    } else {
      this.expandedTopics.add(topicId);
    }
  }

  isExpanded(topicId: string): boolean {
    return this.expandedTopics.has(topicId);
  }

  onSubtopicClick() {
    this.topicSelected.emit();
  }
}
