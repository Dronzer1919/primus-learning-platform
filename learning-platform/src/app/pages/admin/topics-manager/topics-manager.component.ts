import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { ContentService } from '../../../services/content.service';
import { Topic, Subtopic, SubSubtopic, DifficultyLevel, LanguagePlatform, ContentBlock, ContentType } from '../../../models/content.model';

@Component({
  selector: 'app-topics-manager',
  templateUrl: './topics-manager.component.html',
  styleUrls: ['./topics-manager.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class TopicsManagerComponent implements OnInit {
  difficultyLevel: DifficultyLevel = 'beginner';
  topics: Topic[] = [];
  
  isTopicModalOpen = false;
  isSubtopicModalOpen = false;
  isContentModalOpen = false;
  
  editingTopic: Topic | null = null;
  editingSubtopic: Subtopic | null = null;
  currentTopic: Topic | null = null;
  currentSubtopic: Subtopic | null = null;
  
  topicForm: Partial<Topic> = {};
  subtopicForm: Partial<Subtopic> = {};
  contentForm: Partial<ContentBlock> = {};

  availableLanguages: { code: LanguagePlatform; name: string }[] = [
    { code: 'html', name: 'HTML' },
    { code: 'css', name: 'CSS' },
    { code: 'scss', name: 'SCSS' },
    { code: 'javascript', name: 'JavaScript' },
    { code: 'typescript', name: 'TypeScript' },
    { code: 'angular', name: 'Angular' },
    { code: 'nodejs', name: 'Node.js' },
    { code: 'rxjs', name: 'RxJS' }
  ];

  contentTypes: { type: ContentType; label: string }[] = [
    { type: 'description', label: 'Text Description' },
    { type: 'code', label: 'Code Snippet' },
    { type: 'image', label: 'Image' },
    { type: 'youtube', label: 'YouTube Video' }
  ];

  constructor(
    private route: ActivatedRoute,
    private contentService: ContentService
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.difficultyLevel = params['level'] as DifficultyLevel;
      this.loadTopics();
    });
  }

  loadTopics() {
    this.contentService.topics$.subscribe(allTopics => {
      this.topics = allTopics
        .filter(t => t.difficultyLevel === this.difficultyLevel)
        .sort((a, b) => a.order - b.order);
    });
  }

  // Topic Management
  openTopicModal(topic?: Topic) {
    if (topic) {
      this.editingTopic = topic;
      this.topicForm = { ...topic };
    } else {
      this.editingTopic = null;
      this.topicForm = {
        title: '',
        description: '',
        difficultyLevel: this.difficultyLevel,
        languagePlatform: 'html',
        order: this.topics.length + 1,
        subtopics: []
      };
    }
    this.isTopicModalOpen = true;
  }

  saveTopic() {
    if (this.editingTopic) {
      const updatedTopic: Topic = {
        ...this.editingTopic,
        ...this.topicForm
      } as Topic;
      this.contentService.updateTopic(updatedTopic);
    } else {
      const newTopic: Topic = {
        id: Date.now().toString(),
        ...this.topicForm,
        subtopics: []
      } as Topic;
      this.contentService.addTopic(newTopic);
    }
    this.isTopicModalOpen = false;
  }

  deleteTopic(topic: Topic) {
    if (confirm(`Delete topic "${topic.title}"?`)) {
      this.contentService.deleteTopic(topic.id);
    }
  }

  // Subtopic Management
  openSubtopicModal(topic: Topic, subtopic?: Subtopic) {
    this.currentTopic = topic;
    if (subtopic) {
      this.editingSubtopic = subtopic;
      this.subtopicForm = { ...subtopic };
    } else {
      this.editingSubtopic = null;
      this.subtopicForm = {
        topicId: topic.id,
        title: '',
        order: topic.subtopics.length + 1,
        content: []
      };
    }
    this.isSubtopicModalOpen = true;
  }

  saveSubtopic() {
    if (!this.currentTopic) return;

    if (this.editingSubtopic) {
      const updatedSubtopic: Subtopic = {
        ...this.editingSubtopic,
        ...this.subtopicForm
      } as Subtopic;
      this.contentService.updateSubtopic(this.currentTopic.id, updatedSubtopic);
    } else {
      const newSubtopic: Subtopic = {
        id: Date.now().toString(),
        ...this.subtopicForm
      } as Subtopic;
      this.contentService.addSubtopic(this.currentTopic.id, newSubtopic);
    }
    this.isSubtopicModalOpen = false;
  }

  deleteSubtopic(topic: Topic, subtopic: Subtopic) {
    if (confirm(`Delete subtopic "${subtopic.title}"?`)) {
      this.contentService.deleteSubtopic(topic.id, subtopic.id);
    }
  }

  // Content Management
  openContentModal(topic: Topic, subtopic: Subtopic) {
    this.currentTopic = topic;
    this.currentSubtopic = subtopic;
    this.contentForm = {
      type: 'description',
      order: subtopic.content.length + 1,
      data: {}
    };
    this.isContentModalOpen = true;
  }

  saveContent() {
    if (!this.currentTopic || !this.currentSubtopic) return;

    const newContent: ContentBlock = {
      id: Date.now().toString(),
      type: this.contentForm.type!,
      order: this.contentForm.order!,
      data: this.contentForm.data
    };

    const updatedSubtopic = {
      ...this.currentSubtopic,
      content: [...this.currentSubtopic.content, newContent]
    };

    this.contentService.updateSubtopic(this.currentTopic.id, updatedSubtopic);
    this.isContentModalOpen = false;
  }

  getDifficultyLabel(): string {
    return this.difficultyLevel.charAt(0).toUpperCase() + this.difficultyLevel.slice(1);
  }

  getDifficultyIcon(): string {
    const icons = {
      beginner: 'leaf-outline',
      intermediate: 'fitness-outline',
      advance: 'rocket-outline',
      expert: 'trophy-outline'
    };
    return icons[this.difficultyLevel];
  }
}
