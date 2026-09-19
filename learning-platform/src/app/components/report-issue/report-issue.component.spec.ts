import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastController } from '@ionic/angular';
import { of, throwError, BehaviorSubject, Subject } from 'rxjs';
import { ReportIssueComponent } from './report-issue.component';
import { IssueService } from '../../services/issue.service';
import { AuthService } from '../../services/auth.service';
import { IssueReport } from '../../models/issue.model';
import { User } from '../../models/user.model';

function makeIssue(overrides: Partial<IssueReport> = {}): IssueReport {
  return {
    id: 'i1', userId: 'u1', name: 'Alice', email: 'a@b.com', description: 'broke',
    imageUrl: null, status: 'pending', createdAt: new Date('2024-01-01'), updatedAt: new Date('2024-01-01'),
    ...overrides
  };
}

function makeUser(overrides: Partial<User> = {}): User {
  return { id: 'u1', email: 'a@b.com', username: 'alice', displayName: 'Alice A', role: 'user', createdAt: new Date(), ...overrides };
}

describe('ReportIssueComponent', () => {
  let fixture: ComponentFixture<ReportIssueComponent>;
  let component: ReportIssueComponent;
  let issueService: jasmine.SpyObj<IssueService>;
  let authService: jasmine.SpyObj<AuthService>;
  let myIssuesSubject: BehaviorSubject<IssueReport[]>;
  let toastController: jasmine.SpyObj<ToastController>;
  let toastConfig: any;

  beforeEach(async () => {
    myIssuesSubject = new BehaviorSubject<IssueReport[]>([]);
    issueService = jasmine.createSpyObj<IssueService>('IssueService', ['loadMyIssues', 'reportIssue'], {
      myIssues$: myIssuesSubject.asObservable()
    });
    issueService.loadMyIssues.and.returnValue(of([]));

    authService = jasmine.createSpyObj<AuthService>('AuthService', [], { currentUserValue: makeUser() });

    toastController = jasmine.createSpyObj<ToastController>('ToastController', ['create']);
    toastController.create.and.callFake((config: any) => {
      toastConfig = config;
      return Promise.resolve({ present: jasmine.createSpy().and.resolveTo() } as any);
    });

    await TestBed.configureTestingModule({
      imports: [ReportIssueComponent],
      providers: [
        { provide: IssueService, useValue: issueService },
        { provide: AuthService, useValue: authService },
        { provide: ToastController, useValue: toastController }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ReportIssueComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture?.destroy());

  describe('rendering / ngOnInit()', () => {
    it('creates', () => {
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('prefills name/email from the signed-in user', () => {
      fixture.detectChanges();
      expect(component.name).toBe('Alice A');
      expect(component.email).toBe('a@b.com');
    });

    it('falls back to username when displayName is absent', () => {
      Object.defineProperty(authService, 'currentUserValue', { get: () => makeUser({ displayName: undefined }) });
      fixture.detectChanges();
      expect(component.name).toBe('alice');
    });

    it('starts on the "report" segment', () => {
      fixture.detectChanges();
      expect(component.segment).toBe('report');
      expect(fixture.nativeElement.querySelector('form.issue-form')).toBeTruthy();
    });

    it('shows the empty state on the my-reports segment with nothing reported', () => {
      fixture.detectChanges();
      component.segment = 'my-reports';
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.empty-state')).toBeTruthy();
    });

    it('shows the error banner when the initial load fails', () => {
      issueService.loadMyIssues.and.returnValue(throwError(() => new Error('down')));
      fixture.detectChanges();
      component.segment = 'my-reports';
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.reports-error')).toBeTruthy();
    });
  });

  describe('onImageSelected()', () => {
    beforeEach(() => fixture.detectChanges());

    function fileInputEvent(file: File | null): Event {
      const input = document.createElement('input');
      input.type = 'file';
      spyOnProperty(input, 'files').and.returnValue(file ? ([file] as any) : ([] as any));
      return { target: input } as unknown as Event;
    }

    it('accepts a valid image and creates a preview URL', () => {
      const createSpy = spyOn(URL, 'createObjectURL').and.returnValue('blob:preview');
      const file = new File(['x'], 'a.png', { type: 'image/png' });
      component.onImageSelected(fileInputEvent(file));
      expect(component.imageFile).toBe(file);
      expect(component.imagePreviewUrl).toBe('blob:preview');
      expect(createSpy).toHaveBeenCalledWith(file);
    });

    it('rejects a non-image file', () => {
      const file = new File(['x'], 'a.pdf', { type: 'application/pdf' });
      component.onImageSelected(fileInputEvent(file));
      expect(component.imageFile).toBeNull();
      expect(toastConfig.message).toContain('image file');
    });

    it('rejects a file over 5MB', () => {
      const bigFile = new File([new ArrayBuffer(6 * 1024 * 1024)], 'big.png', { type: 'image/png' });
      component.onImageSelected(fileInputEvent(bigFile));
      expect(component.imageFile).toBeNull();
      expect(toastConfig.message).toContain('too large');
    });

    it('does nothing when no file was selected', () => {
      component.onImageSelected(fileInputEvent(null));
      expect(component.imageFile).toBeNull();
    });

    it('revokes the previous preview URL when replacing an image', () => {
      const revokeSpy = spyOn(URL, 'revokeObjectURL');
      spyOn(URL, 'createObjectURL').and.returnValues('blob:one', 'blob:two');
      component.onImageSelected(fileInputEvent(new File(['x'], 'a.png', { type: 'image/png' })));
      component.onImageSelected(fileInputEvent(new File(['y'], 'b.png', { type: 'image/png' })));
      expect(revokeSpy).toHaveBeenCalledWith('blob:one');
    });
  });

  describe('removeImage()', () => {
    it('clears the file/preview and revokes the object URL', () => {
      fixture.detectChanges();
      const revokeSpy = spyOn(URL, 'revokeObjectURL');
      component.imageFile = new File(['x'], 'a.png');
      component.imagePreviewUrl = 'blob:x';
      component.removeImage();
      expect(component.imageFile).toBeNull();
      expect(component.imagePreviewUrl).toBeNull();
      expect(revokeSpy).toHaveBeenCalledWith('blob:x');
    });

    it('is safe to call with no image set', () => {
      fixture.detectChanges();
      expect(() => component.removeImage()).not.toThrow();
    });
  });

  describe('submitReport()', () => {
    beforeEach(() => fixture.detectChanges());

    it('is a no-op with a blank name/email/description', () => {
      component.name = '';
      component.email = 'a@b.com';
      component.description = 'x';
      component.submitReport();
      expect(issueService.reportIssue).not.toHaveBeenCalled();
    });

    it('is a no-op while already saving', () => {
      component.name = 'A';
      component.email = 'a@b.com';
      component.description = 'x';
      component.saving = true;
      component.submitReport();
      expect(issueService.reportIssue).not.toHaveBeenCalled();
    });

    it('trims fields and submits with the current image', () => {
      component.name = '  Alice  ';
      component.email = ' a@b.com ';
      component.description = ' broke ';
      const file = new File(['x'], 'a.png');
      component.imageFile = file;
      issueService.reportIssue.and.returnValue(of(makeIssue()));

      component.submitReport();

      expect(issueService.reportIssue).toHaveBeenCalledWith({
        name: 'Alice', email: 'a@b.com', description: 'broke', image: file
      });
    });

    it('sets saving=true while pending', () => {
      const subject = new Subject<IssueReport>();
      issueService.reportIssue.and.returnValue(subject.asObservable());
      component.name = 'A'; component.email = 'a@b.com'; component.description = 'x';
      component.submitReport();
      expect(component.saving).toBeTrue();
      subject.next(makeIssue());
      subject.complete();
      expect(component.saving).toBeFalse();
    });

    it('clears the form, switches to my-reports, and toasts success', () => {
      component.name = 'A'; component.email = 'a@b.com'; component.description = 'x';
      issueService.reportIssue.and.returnValue(of(makeIssue()));
      component.submitReport();
      expect(component.description).toBe('');
      expect(component.segment).toBe('my-reports');
      expect(toastConfig.color).toBe('success');
    });

    it('shows a danger toast on failure and stays on the report segment', () => {
      component.name = 'A'; component.email = 'a@b.com'; component.description = 'x';
      issueService.reportIssue.and.returnValue(throwError(() => new Error('down')));
      component.submitReport();
      expect(component.segment).toBe('report');
      expect(toastConfig.color).toBe('danger');
      expect(component.saving).toBeFalse();
    });
  });

  describe('lightbox', () => {
    it('openLightbox()/closeLightbox() toggle lightboxUrl', () => {
      fixture.detectChanges();
      component.openLightbox('https://x/y.png');
      expect(component.lightboxUrl).toBe('https://x/y.png');
      component.closeLightbox();
      expect(component.lightboxUrl).toBeNull();
    });
  });

  describe('statusColor() / statusLabel() / formatDate()', () => {
    beforeEach(() => fixture.detectChanges());

    it('maps every status to a distinct colour and label', () => {
      const statuses: Array<IssueReport['status']> = ['pending', 'in-progress', 'resolved', 'rejected'];
      expect(new Set(statuses.map((s) => component.statusColor(s))).size).toBe(4);
      expect(new Set(statuses.map((s) => component.statusLabel(s))).size).toBe(4);
    });
  });

  describe('ngOnDestroy() — memory leak', () => {
    it('unsubscribes from myIssues$', () => {
      fixture.detectChanges();
      fixture.destroy();
      expect(() => myIssuesSubject.next([makeIssue()])).not.toThrow();
      expect(component.myIssues).toEqual([]);
    });

    it('revokes any outstanding preview object URL', () => {
      fixture.detectChanges();
      const revokeSpy = spyOn(URL, 'revokeObjectURL');
      component.imagePreviewUrl = 'blob:leftover';
      fixture.destroy();
      expect(revokeSpy).toHaveBeenCalledWith('blob:leftover');
    });
  });
});
