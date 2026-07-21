import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SessionService } from '../../services/session.service';
import { WorkSession, SessionNote } from '../../models/session.model';

@Component({
  selector: 'app-sessions',
  templateUrl: './sessions.component.html',
  styleUrls: ['./sessions.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class SessionsComponent implements OnInit {
  sessions: WorkSession[] = [];
  activeSession: WorkSession | null = null;
  loading = false;

  // to-do input
  newTodoText = '';

  // note editor
  isNoteModalOpen = false;
  editingNote: SessionNote | null = null;
  noteContent = '';

  constructor(private sessionService: SessionService) {}

  ngOnInit(): void {
    this.loadSessions();
  }

  loadSessions(selectId?: string): void {
    this.loading = true;
    this.sessionService.getSessions().subscribe({
      next: (sessions) => {
        this.sessions = sessions;
        this.loading = false;
        const target = selectId
          ? sessions.find(s => s._id === selectId)
          : (this.activeSession
            ? sessions.find(s => s._id === this.activeSession!._id)
            : sessions[0]);
        this.activeSession = target || sessions[0] || null;
      },
      error: () => { this.loading = false; }
    });
  }

  selectSession(session: WorkSession): void {
    this.activeSession = session;
  }

  createSession(): void {
    this.sessionService.createSession().subscribe((session) => {
      this.sessions = [session, ...this.sessions];
      this.activeSession = session;
    });
  }

  renameSession(session: WorkSession): void {
    const title = prompt('Rename session', session.title);
    if (title && title.trim()) {
      this.sessionService.renameSession(session._id, title.trim()).subscribe((updated) => {
        this.replaceSession(updated);
      });
    }
  }

  deleteSession(session: WorkSession, event?: Event): void {
    event?.stopPropagation();
    if (!confirm('Delete this session and all its todos and notes?')) return;
    this.sessionService.deleteSession(session._id).subscribe(() => {
      this.sessions = this.sessions.filter(s => s._id !== session._id);
      if (this.activeSession?._id === session._id) {
        this.activeSession = this.sessions[0] || null;
      }
    });
  }

  // ---- Todos ----
  addTodo(): void {
    if (!this.activeSession || !this.newTodoText.trim()) return;
    this.sessionService.addTodo(this.activeSession._id, this.newTodoText.trim()).subscribe((updated) => {
      this.replaceSession(updated);
      this.newTodoText = '';
    });
  }

  toggleTodo(todoId: string, completed: boolean): void {
    if (!this.activeSession) return;
    this.sessionService.updateTodo(this.activeSession._id, todoId, { completed }).subscribe((updated) => {
      this.replaceSession(updated);
    });
  }

  deleteTodo(todoId: string): void {
    if (!this.activeSession) return;
    this.sessionService.deleteTodo(this.activeSession._id, todoId).subscribe((updated) => {
      this.replaceSession(updated);
    });
  }

  get completedCount(): number {
    return this.activeSession ? this.activeSession.todos.filter(t => t.completed).length : 0;
  }

  // ---- Notes ----
  openNoteModal(note?: SessionNote): void {
    this.editingNote = note || null;
    this.noteContent = note ? note.content : '';
    this.isNoteModalOpen = true;
  }

  closeNoteModal(): void {
    this.isNoteModalOpen = false;
    this.editingNote = null;
    this.noteContent = '';
  }

  saveNote(): void {
    if (!this.activeSession || !this.noteContent.trim()) return;
    const sessionId = this.activeSession._id;
    if (this.editingNote) {
      this.sessionService.updateNote(sessionId, this.editingNote._id, { content: this.noteContent.trim() })
        .subscribe((updated) => { this.replaceSession(updated); this.closeNoteModal(); });
    } else {
      this.sessionService.addNote(sessionId, this.noteContent.trim())
        .subscribe((updated) => { this.replaceSession(updated); this.closeNoteModal(); });
    }
  }

  deleteNote(note: SessionNote): void {
    if (!this.activeSession || !confirm('Delete this note?')) return;
    this.sessionService.deleteNote(this.activeSession._id, note._id).subscribe((updated) => {
      this.replaceSession(updated);
    });
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  // keep the session list and active session in sync after a mutation
  private replaceSession(updated: WorkSession): void {
    this.sessions = this.sessions.map(s => s._id === updated._id ? updated : s);
    if (this.activeSession?._id === updated._id) {
      this.activeSession = updated;
    }
  }

  trackById(_index: number, item: { _id: string }): string {
    return item._id;
  }
}
