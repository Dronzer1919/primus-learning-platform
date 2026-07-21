import { Component, OnInit, AfterViewChecked, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController, AlertController } from '@ionic/angular';
import { PlaygroundSessionService } from '../../services/playground-session.service';
import { PlaygroundSession } from '../../models/playground-session.model';
import { PlaygroundWorkspaceComponent } from '../playground-workspace/playground-workspace.component';

@Component({
  selector: 'app-playground-sessions',
  templateUrl: './playground-sessions.component.html',
  styleUrls: ['./playground-sessions.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, PlaygroundWorkspaceComponent]
})
export class PlaygroundSessionsComponent implements OnInit, AfterViewChecked {
  @ViewChild(PlaygroundWorkspaceComponent) workspace!: PlaygroundWorkspaceComponent;

  sessions: PlaygroundSession[] = [];
  activeSession: PlaygroundSession | null = null;
  editingTitle = '';
  loading = false;
  isSaving = false;
  private pendingSession: PlaygroundSession | null = null;

  constructor(
    private pgSessionService: PlaygroundSessionService,
    private cdr: ChangeDetectorRef,
    private toastController: ToastController,
    private alertController: AlertController
  ) {}

  ngOnInit(): void {
    this.loadSessions();
  }

  ngAfterViewChecked(): void {
    // When activeSession is set from null (workspace just appeared via *ngIf),
    // apply the pending code once ViewChild is populated.
    if (this.pendingSession && this.workspace) {
      const s = this.pendingSession;
      this.pendingSession = null;
      // Use Promise.resolve to avoid ExpressionChangedAfterItHasBeenCheckedError
      Promise.resolve().then(() => this.doLoadSession(s));
    }
  }

  loadSessions(selectId?: string): void {
    this.loading = true;
    this.pgSessionService.getSessions().subscribe({
      next: (sessions) => {
        this.sessions = sessions;
        this.loading = false;
        const target = selectId
          ? sessions.find(s => s._id === selectId)
          : (this.activeSession
            ? sessions.find(s => s._id === this.activeSession!._id)
            : sessions[0]);
        const toSelect = target || sessions[0] || null;
        if (toSelect) {
          this.applySession(toSelect);
        }
      },
      error: () => { this.loading = false; }
    });
  }

  selectSession(session: PlaygroundSession): void {
    this.applySession(session);
  }

  private applySession(session: PlaygroundSession): void {
    this.activeSession = session;
    this.editingTitle = session.title;
    if (this.workspace) {
      this.doLoadSession(session);
    } else {
      // Workspace not in DOM yet (*ngIf was false); defer to ngAfterViewChecked
      this.pendingSession = session;
    }
  }

  private doLoadSession(session: PlaygroundSession): void {
    if (!this.workspace) return;
    this.workspace.selectedMode = session.mode;
    this.workspace.htmlCode = session.htmlCode;
    this.workspace.cssCode = session.cssCode;
    this.workspace.jsCode = session.jsCode;
    this.workspace.jsOnlyCode = session.jsOnlyCode;
    this.workspace.tsCode = session.tsCode;
    this.workspace.selectedTab = session.selectedTab;
    this.cdr.detectChanges();
  }

  createSession(): void {
    this.pgSessionService.createSession().subscribe({
      next: (session) => {
        this.sessions = [session, ...this.sessions];
        this.applySession(session);
      },
      error: () => this.showToast('Failed to create session. Is the server running?', 'danger')
    });
  }

  async openSaveDialog(): Promise<void> {
    if (!this.activeSession) return;
    const alert = await this.alertController.create({
      header: 'Save Playground Session',
      inputs: [
        {
          name: 'title',
          type: 'text',
          value: this.editingTitle || this.activeSession.title,
          placeholder: 'Session name',
          attributes: { autofocus: true }
        }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Save',
          cssClass: 'alert-save-btn',
          handler: (data) => {
            const title = data.title?.trim();
            if (title) this.editingTitle = title;
            this.saveSession();
          }
        }
      ]
    });
    await alert.present();
  }

  saveSession(): void {
    if (!this.activeSession || !this.workspace || this.isSaving) return;
    this.isSaving = true;
    const data = {
      title: this.editingTitle.trim() || this.activeSession.title,
      mode: this.workspace.selectedMode,
      htmlCode: this.workspace.htmlCode,
      cssCode: this.workspace.cssCode,
      jsCode: this.workspace.jsCode,
      jsOnlyCode: this.workspace.jsOnlyCode,
      tsCode: this.workspace.tsCode,
      selectedTab: this.workspace.selectedTab,
    };
    this.pgSessionService.updateSession(this.activeSession._id, data).subscribe({
      next: (updated) => {
        this.isSaving = false;
        this.replaceSession(updated);
        this.activeSession = updated;
        this.showToast('Session saved!', 'success');
      },
      error: () => {
        this.isSaving = false;
        this.showToast('Failed to save session.', 'danger');
      }
    });
  }

  renameSession(session: PlaygroundSession): void {
    const title = prompt('Rename session', session.title);
    if (title && title.trim()) {
      this.pgSessionService.updateSession(session._id, { title: title.trim() }).subscribe(updated => {
        this.replaceSession(updated);
        if (this.activeSession?._id === updated._id) {
          this.activeSession = updated;
        }
      });
    }
  }

  async deleteSession(session: PlaygroundSession, event?: Event): Promise<void> {
    event?.stopPropagation();
    const alert = await this.alertController.create({
      header: 'Delete Session',
      message: `Delete "<strong>${session.title}</strong>"? This cannot be undone.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          cssClass: 'alert-button-danger',
          handler: () => {
            this.pgSessionService.deleteSession(session._id).subscribe(() => {
              this.sessions = this.sessions.filter(s => s._id !== session._id);
              if (this.activeSession?._id === session._id) {
                const next = this.sessions[0] || null;
                if (next) {
                  this.applySession(next);
                } else {
                  this.activeSession = null;
                }
              }
            });
          }
        }
      ]
    });
    await alert.present();
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  trackById(_: number, item: { _id: string }): string {
    return item._id;
  }

  private replaceSession(updated: PlaygroundSession): void {
    this.sessions = this.sessions.map(s => s._id === updated._id ? updated : s);
  }

  private async showToast(message: string, color: string): Promise<void> {
    const toast = await this.toastController.create({ message, duration: 1800, color, position: 'bottom' });
    toast.present();
  }
}
