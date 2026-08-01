import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AlertController, IonicModule, ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { ContentService } from '../../services/content.service';
import { AuthService } from '../../services/auth.service';
import { NoteStyle, UserNote } from '../../models/content.model';
// The same list the flowchart's Text panel offers — shared rather than duplicated so
// the two editors never drift apart on which fonts exist.
import { FONT_FAMILIES } from '../../models/flowchart.model';

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

  // --- Note styling ------------------------------------------------------
  /** The style being edited in the modal. Committed to the note on save. */
  noteStyle: NoteStyle = {};

  readonly fontFamilies = FONT_FAMILIES;
  readonly defaultFontSize = 15;
  readonly alignments: Array<'left' | 'center' | 'right'> = ['left', 'center', 'right'];

  /** Card backgrounds. `null` is "theme default" and clears any custom colour. */
  readonly bgSwatches: (string | null)[] = [
    null, '#fff8c5', '#d8f3dc', '#d7ebff', '#fbdce8', '#e9dcff', '#ffe4cc', '#e6e8eb'
  ];

  /** Ink colour used when a note has a background but no explicit text colour.
   *  The swatches above are all pale, so the theme's own text colour would be
   *  invisible on them under any of the dark themes. */
  private readonly inkOnBackground = '#1f2937';

  private notesSub?: Subscription;

  constructor(
    private contentService: ContentService,
    private authService: AuthService,
    private alertController: AlertController,
    private toastController: ToastController
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
      // A copy, not the note's own object: abandoning the modal must not leave
      // half-applied styling behind on the card.
      this.noteStyle = { ...(note.style ?? {}) };
    } else {
      this.editingNote = null;
      this.noteContent = '';
      this.noteStyle = {};
    }
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
    this.editingNote = null;
    this.noteContent = '';
    this.noteStyle = {};
  }

  // --- Style controls (mirrors the flowchart Text panel) -------------------

  toggleStyle(prop: 'bold' | 'italic' | 'underline' | 'strikethrough'): void {
    this.noteStyle = { ...this.noteStyle, [prop]: !this.noteStyle[prop] };
  }

  setFontFamily(family: string): void {
    this.noteStyle = { ...this.noteStyle, fontFamily: family };
  }

  setFontSize(size: number): void {
    if (!Number.isFinite(size)) return;
    this.noteStyle = { ...this.noteStyle, fontSize: Math.min(48, Math.max(10, Math.round(size))) };
  }

  setAlign(align: 'left' | 'center' | 'right'): void {
    this.noteStyle = { ...this.noteStyle, align };
  }

  setTextColor(color: string): void {
    this.noteStyle = { ...this.noteStyle, textColor: color };
  }

  setBgColor(color: string | null): void {
    this.noteStyle = { ...this.noteStyle, bgColor: color ?? undefined };
  }

  /** Drops every override at once, back to the theme defaults. */
  resetStyle(): void {
    this.noteStyle = {};
  }

  get hasCustomStyle(): boolean {
    return Object.values(this.noteStyle).some(v => v !== undefined && v !== false);
  }

  /**
   * Inline text styles for a note card — font, weight, alignment and colour.
   *
   * Deliberately drops the note's font size. The cards sit in a fixed grid whose
   * text box is exactly three lines tall, so honouring a 48px size here would let
   * one note stretch its whole row. The chosen size still applies in the editor,
   * which is where it is being set.
   */
  textStyle(style: NoteStyle | null | undefined): { [prop: string]: string } {
    const s = style ?? {};
    const css = this.typography(s);
    delete css['font-size'];
    // An explicit colour always wins; otherwise a background forces dark ink.
    if (s.textColor) {
      css['color'] = s.textColor;
    } else if (s.bgColor) {
      css['color'] = this.inkOnBackground;
    }
    return css;
  }

  /**
   * The same typography for the modal's editor, but never the background-derived
   * ink: the editor keeps the app's own surface, so dark ink there would be
   * invisible on the dark themes. Only an explicitly chosen colour is previewed.
   */
  editorTextStyle(): { [prop: string]: string } {
    const css = this.typography(this.noteStyle);
    if (this.noteStyle.textColor) {
      css['color'] = this.noteStyle.textColor;
    }
    return css;
  }

  private typography(s: NoteStyle): { [prop: string]: string } {
    const css: { [prop: string]: string } = {};
    if (s.fontFamily) css['font-family'] = s.fontFamily;
    css['font-size'] = `${s.fontSize ?? this.defaultFontSize}px`;
    if (s.bold) css['font-weight'] = '700';
    if (s.italic) css['font-style'] = 'italic';
    const decorations = [s.underline ? 'underline' : '', s.strikethrough ? 'line-through' : '']
      .filter(Boolean);
    if (decorations.length) css['text-decoration'] = decorations.join(' ');
    css['text-align'] = s.align ?? 'left';
    return css;
  }

  /** Background for a note card. Returns {} when the note uses the theme default. */
  cardStyle(style: NoteStyle | null | undefined): { [prop: string]: string } {
    return style?.bgColor ? { background: style.bgColor } : {};
  }

  // Every ContentService note method returns a cold HttpClient observable: nothing is
  // sent until something subscribes. These previously called the service and dropped the
  // returned observable on the floor, so create/update/pin/delete all silently did
  // nothing — no request ever left the browser.
  saveNote() {
    const userId = this.authService.currentUserValue?.id;
    if (!userId || !this.noteContent.trim() || this.saving) return;

    this.saving = true;
    // closeModal() clears editingNote, so the wording is decided before it runs.
    const wasEditing = !!this.editingNote;
    const done = {
      next: () => {
        this.saving = false;
        this.error = null;
        this.closeModal();
        this.showToast(wasEditing ? 'Note updated' : 'Note created', 'success');
      },
      error: () => {
        this.saving = false;
        // A toast rather than the inline banner: the modal stays open on failure and
        // covers the banner entirely, so the user would see nothing at all.
        this.showToast('Could not save the note. Check that the backend is running.', 'danger');
      }
    };

    // Explicit null, not undefined: undefined keys vanish in JSON.stringify, so
    // clearing a note's formatting would leave the old style on the server.
    const style = this.hasCustomStyle ? this.noteStyle : null;

    if (this.editingNote) {
      this.contentService
        .updateUserNote({
          ...this.editingNote,
          content: this.noteContent,
          style,
          updatedAt: new Date()
        })
        .subscribe(done);
    } else {
      // No client-side id: the server assigns _id, and loadUserNotes() maps it back.
      this.contentService
        .addUserNote({ userId, content: this.noteContent, isPinned: false, style })
        .subscribe(done);
    }
  }

  async deleteNote(note: UserNote) {
    const alert = await this.alertController.create({
      header: 'Delete note',
      cssClass: 'app-confirm-alert app-confirm-danger',
      // Quoting the note makes it clear which card is going, since the dialog covers them.
      message: `Delete “${this.preview(note.content)}”? This cannot be undone.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          cssClass: 'alert-button-danger',
          handler: () => {
            this.contentService.deleteUserNote(note.id).subscribe({
              next: () => {
                this.error = null;
                this.showToast('Note deleted', 'success');
              },
              error: () =>
                this.showToast('Could not delete the note. Check that the backend is running.', 'danger')
            });
          }
        }
      ]
    });
    await alert.present();
  }

  togglePin(note: UserNote) {
    const pinning = !note.isPinned;
    this.contentService.updateUserNote({ ...note, isPinned: pinning }).subscribe({
      next: () => {
        this.error = null;
        this.showToast(pinning ? 'Note pinned to the top' : 'Note unpinned', 'success');
      },
      error: () =>
        this.showToast('Could not update the note. Check that the backend is running.', 'danger')
    });
  }

  /** First line of a note, clipped — used where a note has to be named in one phrase. */
  private preview(content: string): string {
    const line = content.trim().split('\n')[0];
    return line.length > 48 ? `${line.slice(0, 48).trim()}…` : line;
  }

  private async showToast(message: string, color: 'success' | 'danger'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: color === 'danger' ? 3200 : 1800,
      color,
      position: 'bottom',
      cssClass: 'app-toast',
      icon: color === 'danger' ? 'alert-circle-outline' : 'checkmark-circle-outline'
    });
    toast.present();
  }

  /** e.g. "Dec 4, 2025 • 06:22 PM". Date and time are formatted separately so the two
   *  halves are joined by a bullet rather than the locale's comma. */
  formatDate(date: Date): string {
    const d = new Date(date);
    const day = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return `${day} • ${time}`;
  }
}
