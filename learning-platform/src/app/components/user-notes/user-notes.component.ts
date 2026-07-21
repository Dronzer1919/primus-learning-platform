import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
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
export class UserNotesComponent implements OnInit {
  notes: UserNote[] = [];
  isModalOpen = false;
  editingNote: UserNote | null = null;
  noteContent = '';

  constructor(
    private contentService: ContentService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.loadNotes();
  }

  loadNotes() {
    const userId = this.authService.currentUserValue?.id;
    if (userId) {
      this.contentService.userNotes$.subscribe(allNotes => {
        this.notes = allNotes
          .filter(n => n.userId === userId)
          .sort((a, b) => {
            if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
          });
      });
    }
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

  saveNote() {
    const userId = this.authService.currentUserValue?.id;
    if (!userId) return;

    if (this.editingNote) {
      const updatedNote: UserNote = {
        ...this.editingNote,
        content: this.noteContent,
        updatedAt: new Date()
      };
      this.contentService.updateUserNote(updatedNote);
    } else {
      const newNote: UserNote = {
        id: Date.now().toString(),
        userId,
        content: this.noteContent,
        createdAt: new Date(),
        updatedAt: new Date(),
        isPinned: false
      };
      this.contentService.addUserNote(newNote);
    }
    this.closeModal();
  }

  deleteNote(note: UserNote) {
    if (confirm('Delete this note?')) {
      this.contentService.deleteUserNote(note.id);
    }
  }

  togglePin(note: UserNote) {
    const updatedNote = { ...note, isPinned: !note.isPinned };
    this.contentService.updateUserNote(updatedNote);
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
