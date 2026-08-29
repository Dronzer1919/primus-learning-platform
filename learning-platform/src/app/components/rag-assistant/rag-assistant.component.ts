import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { RagService } from '../../services/rag.service';
import { ContentService } from '../../services/content.service';
import { RagChatMessage, RagCitation } from '../../models/rag.model';
import { LanguageTab, LanguagePlatform } from '../../models/content.model';

@Component({
  selector: 'app-rag-assistant',
  templateUrl: './rag-assistant.component.html',
  styleUrls: ['./rag-assistant.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class RagAssistantComponent implements OnInit, OnDestroy {
  @ViewChild('scrollAnchor') private scrollAnchor?: ElementRef<HTMLDivElement>;

  messages: RagChatMessage[] = [];
  question = '';
  asking = false;
  languageTabs: LanguageTab[] = [];
  /** '' means "search the whole library" — not scoped to one language. */
  scope: LanguagePlatform | '' = '';

  private tabsSub?: Subscription;
  private askSub?: Subscription;

  constructor(
    private ragService: RagService,
    private contentService: ContentService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.tabsSub = this.contentService.languageTabs$.subscribe((tabs) => {
      this.languageTabs = tabs;
    });
  }

  ngOnDestroy(): void {
    this.tabsSub?.unsubscribe();
    this.askSub?.unsubscribe(); // aborts an in-flight stream, if any
  }

  send(): void {
    const question = this.question.trim();
    if (!question || this.asking) return;

    this.messages.push({ role: 'user', text: question });
    const assistantMessage: RagChatMessage = { role: 'assistant', text: '', pending: true };
    this.messages.push(assistantMessage);

    this.question = '';
    this.asking = true;
    this.scrollToBottom();

    this.askSub?.unsubscribe();
    this.askSub = this.ragService.ask(question, this.scope || undefined).subscribe({
      next: (event) => {
        switch (event.type) {
          case 'citations':
            assistantMessage.citations = event.citations;
            break;
          case 'delta':
            assistantMessage.text += event.text;
            this.scrollToBottom();
            break;
          case 'refusal':
            assistantMessage.text = assistantMessage.text || 'I can\'t help with that question.';
            assistantMessage.failed = true;
            break;
          case 'error':
            assistantMessage.text = event.message;
            assistantMessage.failed = true;
            break;
          case 'done':
            break;
        }
      },
      error: () => {
        // The Observable itself only errors on a bug in rag.service — surface
        // it rather than leaving the bubble stuck on "thinking…" forever.
        assistantMessage.text = assistantMessage.text || 'Something went wrong. Please try again.';
        assistantMessage.failed = true;
        assistantMessage.pending = false;
        this.asking = false;
      },
      complete: () => {
        assistantMessage.pending = false;
        this.asking = false;
        this.scrollToBottom();
      }
    });
  }

  onEnter(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.shiftKey) return; // shift+enter = newline
    event.preventDefault();
    this.send();
  }

  openCitation(citation: RagCitation): void {
    this.router.navigate(['/user/content', citation.topicId, citation.subtopicId]);
  }

  clearChat(): void {
    this.askSub?.unsubscribe();
    this.messages = [];
    this.asking = false;
  }

  trackByIndex(index: number): number {
    return index;
  }

  private scrollToBottom(): void {
    // Runs after the DOM update for the message/delta that triggered it.
    setTimeout(() => {
      this.scrollAnchor?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  }
}
