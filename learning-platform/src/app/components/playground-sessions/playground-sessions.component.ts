import { Component, OnInit, AfterViewChecked, ViewChild, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
  isCreating = false;
  private pendingSession: PlaygroundSession | null = null;

  // Every request below is tied to this. Without it, leaving the page mid-load
  // leaves the response to arrive at a destroyed component and write to fields
  // nothing will ever render — and each visit adds another one.
  private readonly destroyRef = inject(DestroyRef);

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
    this.pgSessionService.getSessions().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (sessions) => {
        // Normalised first: everything below indexes and searches this list, and
        // a non-array response (an error page, a changed envelope) would throw
        // inside the callback rather than simply showing nothing.
        this.sessions = Array.isArray(sessions) ? sessions : [];
        this.loading = false;
        const list = this.sessions;
        const target = selectId
          ? list.find(s => s._id === selectId)
          : (this.activeSession
            ? list.find(s => s._id === this.activeSession!._id)
            : list[0]);
        const toSelect = target || list[0] || null;
        if (toSelect) {
          this.applySession(toSelect);
        }
      },
      error: () => {
        // The spinner must stop whatever happened; the list keeps whatever it
        // last had rather than being emptied by a transient failure.
        this.loading = false;
        this.showToast('Could not load your sessions. Please try again.', 'danger');
      }
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
    // A double-tap on "New" used to create two sessions: the button stays live
    // for the whole round trip, and nothing here was tracking that one was
    // already in flight. POSTs are never de-duplicated at the HTTP layer — two
    // saves are two intents — so the guard has to be here.
    if (this.isCreating) return;
    this.isCreating = true;

    this.pgSessionService.createSession().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (session) => {
        this.isCreating = false;
        this.sessions = [session, ...this.sessions];
        this.applySession(session);
      },
      error: () => {
        this.isCreating = false;
        this.showToast('Failed to create session. Is the server running?', 'danger');
      }
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
    this.pgSessionService.updateSession(this.activeSession._id, data).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
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
    if (!title || !title.trim()) return;

    // A cap here as well as on the server: the API rejects an over-long title
    // with a 400, and there is no reason to make the round trip to find out.
    const trimmed = title.trim().slice(0, 120);

    this.pgSessionService
      .updateSession(session._id, { title: trimmed })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.replaceSession(updated);
          if (this.activeSession?._id === updated._id) {
            this.activeSession = updated;
          }
        },
        // This subscribe had no error callback at all, so a failed rename became
        // an unhandled rejection — a full-page error for a request that simply
        // did not go through.
        error: () => this.showToast('Could not rename that session.', 'danger')
      });
  }

  async deleteSession(session: PlaygroundSession, event?: Event): Promise<void> {
    event?.stopPropagation();
    const alert = await this.alertController.create({
      header: 'Delete Session',
      cssClass: 'delete-alert',
      message: `Delete "${session.title}"? This cannot be undone.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          cssClass: 'alert-button-danger',
          handler: () => {
            this.pgSessionService
              .deleteSession(session._id)
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe({
                next: () => {
                  this.sessions = this.sessions.filter(s => s._id !== session._id);
                  if (this.activeSession?._id === session._id) {
                    const next = this.sessions[0] || null;
                    if (next) {
                      this.applySession(next);
                    } else {
                      this.activeSession = null;
                    }
                  }
                },
                // Without this the list would show the session as deleted only
                // because nothing told it otherwise — and it would reappear on
                // the next load. Say so instead.
                error: () => this.showToast('Could not delete that session.', 'danger')
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
