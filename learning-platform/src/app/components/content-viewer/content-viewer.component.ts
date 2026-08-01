import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { EMPTY } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
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

  private readonly route = inject(ActivatedRoute);
  private readonly contentService = inject(ContentService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit() {
    // One chain, not a subscribe inside a subscribe.
    //
    // The nested version had two defects that only showed up in use. Nothing
    // unsubscribed, so every visit to this route left another params listener
    // alive and a later navigation fired all of them — N requests for one page.
    // And because each inner request was independent, switching subtopics
    // quickly meant whichever response happened to arrive last won, which is
    // not necessarily the one the user asked for. switchMap fixes both: the
    // previous request is cancelled the moment the params change, and
    // takeUntilDestroyed tears the whole thing down with the component.
    this.route.params
      .pipe(
        tap(() => {
          this.loading = true;
          this.error = '';
        }),
        switchMap(params =>
          this.contentService.getSubtopicContent(params['topicId'], params['subtopicId']).pipe(
            tap(data => this.applyContent(params['topicId'], data)),
            // Caught inside the switchMap so a failed load ends only that
            // request. Letting it reach the outer stream would kill the params
            // subscription too, and the route would stop responding entirely.
            catchError(() => {
              this.error = 'Failed to load content. Please try again.';
              this.loading = false;
              return EMPTY;
            })
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  /** Defensive throughout: a partial document from the API must not blank the page. */
  private applyContent(topicId: string, data: any): void {
    this.loading = false;
    if (!data?.topic || !data?.subtopic) {
      this.error = 'That topic could not be found.';
      return;
    }

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
      topicId,
      title: data.subtopic.title,
      order: data.subtopic.order,
      // Array-checked, not just defaulted: sort() below would throw on any other
      // shape, and that throw happens inside a subscribe — where it becomes an
      // app-level error rather than an empty list.
      content: Array.isArray(data.subtopic.content) ? data.subtopic.content : []
    };

    // A copy before sorting: sort() mutates, and this array belongs to the
    // subtopic object the service handed over.
    this.contentBlocks = [...this.subtopic.content].sort((a, b) => a.order - b.order);
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
    // The Clipboard API rejects when the page is not focused, when the browser
    // denies permission, and always on insecure origins. Unhandled, that
    // rejection reaches the global error handler and shows the user a failure
    // toast for a copy button — worse than the copy quietly not happening.
    void navigator.clipboard?.writeText(code).catch(() => undefined);
  }
}
