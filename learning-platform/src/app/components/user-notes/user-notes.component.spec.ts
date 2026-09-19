import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AlertController, ToastController } from '@ionic/angular';
import { of, throwError, Subject, BehaviorSubject } from 'rxjs';
import { UserNotesComponent } from './user-notes.component';
import { ContentService } from '../../services/content.service';
import { AuthService } from '../../services/auth.service';
import { UserNote } from '../../models/content.model';
import { User } from '../../models/user.model';

function makeNote(overrides: Partial<UserNote> = {}): UserNote {
  return {
    id: 'n1', userId: 'u1', content: 'Hello note', createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'), isPinned: false, ...overrides
  };
}

function makeUser(overrides: Partial<User> = {}): User {
  return { id: 'u1', email: 'a@b.com', username: 'alice', role: 'user', createdAt: new Date(), ...overrides };
}

describe('UserNotesComponent', () => {
  let fixture: ComponentFixture<UserNotesComponent>;
  let component: UserNotesComponent;
  let contentService: jasmine.SpyObj<ContentService>;
  let authService: jasmine.SpyObj<AuthService>;
  let alertController: jasmine.SpyObj<AlertController>;
  let toastController: jasmine.SpyObj<ToastController>;
  let userNotesSubject: BehaviorSubject<UserNote[]>;
  let alertConfig: any;
  let toastConfig: any;

  beforeEach(async () => {
    userNotesSubject = new BehaviorSubject<UserNote[]>([]);

    contentService = jasmine.createSpyObj<ContentService>('ContentService', [
      'loadUserNotes', 'addUserNote', 'updateUserNote', 'deleteUserNote'
    ], { userNotes$: userNotesSubject.asObservable() });
    contentService.loadUserNotes.and.returnValue(of([]));

    authService = jasmine.createSpyObj<AuthService>('AuthService', [], {
      currentUserValue: makeUser()
    });

    alertController = jasmine.createSpyObj<AlertController>('AlertController', ['create']);
    alertController.create.and.callFake((config: any) => {
      alertConfig = config;
      return Promise.resolve({ present: jasmine.createSpy().and.resolveTo() } as any);
    });

    toastController = jasmine.createSpyObj<ToastController>('ToastController', ['create']);
    toastController.create.and.callFake((config: any) => {
      toastConfig = config;
      return Promise.resolve({ present: jasmine.createSpy().and.resolveTo() } as any);
    });

    await TestBed.configureTestingModule({
      imports: [UserNotesComponent],
      providers: [
        { provide: ContentService, useValue: contentService },
        { provide: AuthService, useValue: authService },
        { provide: AlertController, useValue: alertController },
        { provide: ToastController, useValue: toastController }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UserNotesComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture?.destroy());

  // ---------- Rendering ----------
  describe('rendering', () => {
    it('creates', () => {
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('shows the empty state when there are no notes', () => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.empty-state')).toBeTruthy();
    });

    it('renders a card per note once loaded', () => {
      fixture.detectChanges();
      userNotesSubject.next([makeNote({ id: 'a' }), makeNote({ id: 'b' })]);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('.note-body').length).toBe(2);
    });

    it('shows the error banner only when loading fails', () => {
      contentService.loadUserNotes.and.returnValue(throwError(() => new Error('down')));
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.notes-error')).toBeTruthy();
    });

    it('does not render the error banner on a clean load', () => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.notes-error')).toBeNull();
    });

    it('shows a pin flag only on pinned notes', () => {
      fixture.detectChanges();
      userNotesSubject.next([makeNote({ id: 'a', isPinned: true }), makeNote({ id: 'b', isPinned: false })]);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('.note-flag').length).toBe(1);
    });
  });

  // ---------- loadNotes() / reload() ----------
  describe('loadNotes()', () => {
    it('does nothing when no user is signed in', () => {
      Object.defineProperty(authService, 'currentUserValue', { get: () => null });
      fixture.detectChanges();
      expect(contentService.loadUserNotes).not.toHaveBeenCalled();
    });

    it('filters userNotes$ down to the current user and sorts pinned-first, newest-first', () => {
      fixture.detectChanges();
      userNotesSubject.next([
        makeNote({ id: 'other-user', userId: 'someone-else' }),
        makeNote({ id: 'old', updatedAt: new Date('2024-01-01') }),
        makeNote({ id: 'pinned', isPinned: true, updatedAt: new Date('2023-01-01') }),
        makeNote({ id: 'new', updatedAt: new Date('2024-06-01') })
      ]);
      expect(component.notes.map((n) => n.id)).toEqual(['pinned', 'new', 'old']);
    });

    it('sets the error banner text when reload fails', () => {
      contentService.loadUserNotes.and.returnValue(throwError(() => new Error('down')));
      fixture.detectChanges();
      expect(component.error).toContain('Could not load your notes');
    });

    it('clears a previous error on a successful reload', () => {
      component.error = 'stale error';
      contentService.loadUserNotes.and.returnValue(of([]));
      component.reload();
      expect(component.error).toBeNull();
    });
  });

  // ---------- Modal open/close ----------
  describe('openModal() / closeModal()', () => {
    beforeEach(() => fixture.detectChanges());

    it('opens blank for a new note', () => {
      component.openModal();
      expect(component.isModalOpen).toBeTrue();
      expect(component.editingNote).toBeNull();
      expect(component.noteContent).toBe('');
    });

    it('opens prefilled for an existing note, copying its style (not referencing it)', () => {
      const note = makeNote({ content: 'Existing', style: { bold: true } });
      component.openModal(note);
      expect(component.noteContent).toBe('Existing');
      expect(component.noteStyle).toEqual({ bold: true });
      expect(component.noteStyle).not.toBe(note.style as any);
    });

    it('closeModal() resets all editing state', () => {
      component.openModal(makeNote());
      component.closeModal();
      expect(component.isModalOpen).toBeFalse();
      expect(component.editingNote).toBeNull();
      expect(component.noteContent).toBe('');
      expect(component.noteStyle).toEqual({});
    });
  });

  // ---------- Style controls ----------
  describe('style controls', () => {
    beforeEach(() => {
      fixture.detectChanges();
      component.openModal();
    });

    it('toggleStyle() flips a boolean flag', () => {
      component.toggleStyle('bold');
      expect(component.noteStyle.bold).toBeTrue();
      component.toggleStyle('bold');
      expect(component.noteStyle.bold).toBeFalse();
    });

    it('setFontSize() clamps to [10, 48]', () => {
      component.setFontSize(5);
      expect(component.noteStyle.fontSize).toBe(10);
      component.setFontSize(999);
      expect(component.noteStyle.fontSize).toBe(48);
    });

    it('setFontSize() ignores non-finite input', () => {
      component.setFontSize(NaN);
      expect(component.noteStyle.fontSize).toBeUndefined();
    });

    it('setBgColor(null) clears the background', () => {
      component.setBgColor('#fff8c5');
      component.setBgColor(null);
      expect(component.noteStyle.bgColor).toBeUndefined();
    });

    it('resetStyle() drops every override', () => {
      component.toggleStyle('bold');
      component.setTextColor('#111');
      component.resetStyle();
      expect(component.noteStyle).toEqual({});
    });

    it('hasCustomStyle is false for an empty style and true once something is set', () => {
      expect(component.hasCustomStyle).toBeFalse();
      component.toggleStyle('italic');
      expect(component.hasCustomStyle).toBeTrue();
    });
  });

  describe('textStyle() / cardStyle() / editorTextStyle()', () => {
    beforeEach(() => fixture.detectChanges());

    it('textStyle() never includes an explicit font-size (grid constraint)', () => {
      const css = component.textStyle({ fontSize: 30 });
      expect(css['font-size']).toBeUndefined();
    });

    it('textStyle() forces dark ink when a background is set with no explicit text colour', () => {
      const css = component.textStyle({ bgColor: '#fff8c5' });
      expect(css['color']).toBe('#1f2937');
    });

    it('textStyle() prefers an explicit text colour over the background-derived ink', () => {
      const css = component.textStyle({ bgColor: '#fff8c5', textColor: '#0000ff' });
      expect(css['color']).toBe('#0000ff');
    });

    it('textStyle() handles null/undefined style without throwing', () => {
      expect(() => component.textStyle(null)).not.toThrow();
      expect(() => component.textStyle(undefined)).not.toThrow();
    });

    it('cardStyle() returns {} for a note with no custom background', () => {
      expect(component.cardStyle(null)).toEqual({});
    });

    it('cardStyle() returns the background when set', () => {
      expect(component.cardStyle({ bgColor: '#d8f3dc' })).toEqual({ background: '#d8f3dc' });
    });

    it('editorTextStyle() never applies background-derived ink (only explicit colour)', () => {
      component.noteStyle = { bgColor: '#fff8c5' };
      const css = component.editorTextStyle();
      expect(css['color']).toBeUndefined();
    });
  });

  // ---------- saveNote() ----------
  describe('saveNote()', () => {
    beforeEach(() => fixture.detectChanges());

    it('is a no-op with blank content', () => {
      component.openModal();
      component.noteContent = '   ';
      component.saveNote();
      expect(contentService.addUserNote).not.toHaveBeenCalled();
    });

    it('is a no-op while already saving', () => {
      component.openModal();
      component.noteContent = 'text';
      component.saving = true;
      component.saveNote();
      expect(contentService.addUserNote).not.toHaveBeenCalled();
    });

    it('creates a new note with a null style when nothing was customised', () => {
      component.openModal();
      component.noteContent = 'New note';
      contentService.addUserNote.and.returnValue(of(makeNote()));
      component.saveNote();
      const payload = contentService.addUserNote.calls.mostRecent().args[0];
      expect(payload.style).toBeNull();
    });

    it('creates with the custom style when one was set', () => {
      component.openModal();
      component.noteContent = 'New note';
      component.toggleStyle('bold');
      contentService.addUserNote.and.returnValue(of(makeNote()));
      component.saveNote();
      const payload = contentService.addUserNote.calls.mostRecent().args[0];
      expect(payload.style).toEqual({ bold: true });
    });

    it('updates an existing note via updateUserNote', () => {
      const existing = makeNote({ id: 'n1' });
      component.openModal(existing);
      component.noteContent = 'Edited';
      contentService.updateUserNote.and.returnValue(of(existing));
      component.saveNote();
      expect(contentService.updateUserNote).toHaveBeenCalledWith(jasmine.objectContaining({ id: 'n1', content: 'Edited' }));
    });

    it('closes the modal and shows a success toast on success', () => {
      component.openModal();
      component.noteContent = 'New note';
      contentService.addUserNote.and.returnValue(of(makeNote()));
      component.saveNote();
      expect(component.isModalOpen).toBeFalse();
      expect(toastConfig.color).toBe('success');
    });

    it('keeps the modal open and shows a danger toast on failure', () => {
      component.openModal();
      component.noteContent = 'New note';
      contentService.addUserNote.and.returnValue(throwError(() => new Error('down')));
      component.saveNote();
      expect(component.isModalOpen).toBeTrue();
      expect(component.saving).toBeFalse();
      expect(toastConfig.color).toBe('danger');
    });

    it('sets saving=true while the request is pending', () => {
      component.openModal();
      component.noteContent = 'New note';
      const subject = new Subject<UserNote>();
      contentService.addUserNote.and.returnValue(subject.asObservable());
      component.saveNote();
      expect(component.saving).toBeTrue();
      subject.next(makeNote());
      subject.complete();
      expect(component.saving).toBeFalse();
    });
  });

  // ---------- deleteNote() ----------
  describe('deleteNote()', () => {
    beforeEach(() => fixture.detectChanges());

    it('presents a confirmation quoting the note preview', async () => {
      await component.deleteNote(makeNote({ content: 'Buy milk' }));
      expect(alertConfig.message).toContain('Buy milk');
    });

    it('truncates a long note in the confirmation message', async () => {
      const long = 'x'.repeat(100);
      await component.deleteNote(makeNote({ content: long }));
      expect(alertConfig.message).toContain('…');
    });

    it('deletes on confirm and shows a success toast', async () => {
      contentService.deleteUserNote.and.returnValue(of(undefined));
      await component.deleteNote(makeNote({ id: 'n1' }));
      const deleteBtn = alertConfig.buttons.find((b: any) => b.text === 'Delete');
      deleteBtn.handler();
      expect(contentService.deleteUserNote).toHaveBeenCalledWith('n1');
      expect(toastConfig.color).toBe('success');
    });

    it('shows a danger toast on delete failure', async () => {
      contentService.deleteUserNote.and.returnValue(throwError(() => new Error('down')));
      await component.deleteNote(makeNote({ id: 'n1' }));
      const deleteBtn = alertConfig.buttons.find((b: any) => b.text === 'Delete');
      deleteBtn.handler();
      expect(toastConfig.color).toBe('danger');
    });
  });

  // ---------- togglePin() ----------
  describe('togglePin()', () => {
    beforeEach(() => fixture.detectChanges());

    it('pins an unpinned note', () => {
      contentService.updateUserNote.and.returnValue(of(makeNote({ isPinned: true })));
      component.togglePin(makeNote({ isPinned: false }));
      expect(contentService.updateUserNote).toHaveBeenCalledWith(jasmine.objectContaining({ isPinned: true }));
      expect(toastConfig.message).toContain('pinned');
    });

    it('unpins a pinned note', () => {
      contentService.updateUserNote.and.returnValue(of(makeNote({ isPinned: false })));
      component.togglePin(makeNote({ isPinned: true }));
      expect(contentService.updateUserNote).toHaveBeenCalledWith(jasmine.objectContaining({ isPinned: false }));
      expect(toastConfig.message).toContain('unpinned');
    });

    it('shows a danger toast on failure', () => {
      contentService.updateUserNote.and.returnValue(throwError(() => new Error('down')));
      component.togglePin(makeNote());
      expect(toastConfig.color).toBe('danger');
    });
  });

  // ---------- formatDate() ----------
  describe('formatDate()', () => {
    it('formats a date with a bullet separator', () => {
      fixture.detectChanges();
      const formatted = component.formatDate(new Date('2024-12-04T18:22:00.000Z'));
      expect(formatted).toContain('•');
    });
  });

  // ---------- Enterprise: memory leak ----------
  describe('ngOnDestroy()', () => {
    it('unsubscribes from userNotes$ so a later emission does not update a destroyed component', () => {
      fixture.detectChanges();
      fixture.destroy();
      expect(() => userNotesSubject.next([makeNote()])).not.toThrow();
      expect(component.notes).toEqual([]);
    });
  });
});
