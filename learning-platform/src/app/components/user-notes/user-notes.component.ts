import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { ContentService } from '../../services/content.service';
import { AuthService } from '../../services/auth.service';
import { UserNote } from '../../models/content.model';

@Component({
  selector: 'app-user-notes',
  templateUrl: './user-notes.component.html',
  styleUrls: ['./user-notes.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class UserNotesComponent implements OnInit, OnDestroy {
  notes: UserNote[] = [];
  isModalOpen = false;
  editingNote: UserNote | null = null;
  noteContent = '';
  /** Surfaced in the template so a failing request is visible instead of a no-op. */
  error: string | null = null;
  saving = false;

  private notesSub?: Subscription;

  constructor(
    private contentService: ContentService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.loadNotes();
  }

  ngOnDestroy() {
    // userNotes$ lives on a root-provided service, so this subscription outlives the
    // component (and stacks up on every visit) unless it is torn down here.
    this.notesSub?.unsubscribe();
  }

  loadNotes() {
    const userId = this.authService.currentUserValue?.id;
    if (!userId) return;

    // userNotes$ is a BehaviorSubject — subscribing to it only mirrors what the service
    // already holds. Fetching is a separate call, and without it the list stayed empty:
    // nothing else in the app populates notes (ContentService's constructor loads only
    // language tabs and topics).
    this.notesSub = this.contentService.userNotes$.subscribe(allNotes => {
      this.notes = allNotes
        .filter(n => n.userId === userId)
        .sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
    });

    this.reload();
  }

  /** Re-fetches from the API. Separate from loadNotes() so Retry does not stack up a
   *  second userNotes$ subscription each time it is pressed. */
  reload() {
    this.contentService.loadUserNotes().subscribe({
      next: () => (this.error = null),
      error: () => (this.error = 'Could not load your notes. Check that the backend is running.')
    });
  }

  openModal(note?: UserNote) {
    if (note) {
      this.editingNote = note;
      this.noteContent = note.content;
    } else {
      this.editingNote = null;
      this.noteContent = '';
    }
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
    this.editingNote = null;
    this.noteContent = '';
  }

  // Every ContentService note method returns a cold HttpClient observable: nothing is
  // sent until something subscribes. These previously called the service and dropped the
  // returned observable on the floor, so create/update/pin/delete all silently did
  // nothing — no request ever left the browser.
  saveNote() {
    const userId = this.authService.currentUserValue?.id;
    if (!userId || !this.noteContent.trim() || this.saving) return;

    this.saving = true;
    const done = {
      next: () => {
        this.saving = false;
        this.error = null;
        this.closeModal();
      },
      error: () => {
        this.saving = false;
        this.error = 'Could not save the note. Check that the backend is running.';
      }
    };

    if (this.editingNote) {
      this.contentService
        .updateUserNote({ ...this.editingNote, content: this.noteContent, updatedAt: new Date() })
        .subscribe(done);
    } else {
      // No client-side id: the server assigns _id, and loadUserNotes() maps it back.
      this.contentService
        .addUserNote({ userId, content: this.noteContent, isPinned: false })
        .subscribe(done);
    }
  }

  deleteNote(note: UserNote) {
    if (!confirm('Delete this note?')) return;

    this.contentService.deleteUserNote(note.id).subscribe({
      next: () => (this.error = null),
      error: () => (this.error = 'Could not delete the note. Check that the backend is running.')
    });
  }

  togglePin(note: UserNote) {
    this.contentService.updateUserNote({ ...note, isPinned: !note.isPinned }).subscribe({
      next: () => (this.error = null),
      error: () => (this.error = 'Could not update the note. Check that the backend is running.')
    });
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
