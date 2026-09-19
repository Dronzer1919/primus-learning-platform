import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastController } from '@ionic/angular';
import { of, throwError, BehaviorSubject, Subject } from 'rxjs';
import { IssuesManagerComponent } from './issues-manager.component';
import { IssueService } from '../../../services/issue.service';
import { IssueReport } from '../../../models/issue.model';

function makeIssue(overrides: Partial<IssueReport> = {}): IssueReport {
  return {
    id: 'i1', userId: 'u1', name: 'Alice', email: 'a@b.com', description: 'broke',
    imageUrl: null, status: 'pending', createdAt: new Date('2024-01-01'), updatedAt: new Date('2024-01-01'),
    ...overrides
  };
}

describe('IssuesManagerComponent', () => {
  let fixture: ComponentFixture<IssuesManagerComponent>;
  let component: IssuesManagerComponent;
  let issueService: jasmine.SpyObj<IssueService>;
  let allIssuesSubject: BehaviorSubject<IssueReport[]>;
  let toastController: jasmine.SpyObj<ToastController>;
  let toastConfig: any;

  beforeEach(async () => {
    allIssuesSubject = new BehaviorSubject<IssueReport[]>([]);
    issueService = jasmine.createSpyObj<IssueService>('IssueService', ['loadAllIssues', 'updateIssueStatus'], {
      allIssues$: allIssuesSubject.asObservable()
    });
    issueService.loadAllIssues.and.returnValue(of([]));

    toastController = jasmine.createSpyObj<ToastController>('ToastController', ['create']);
    toastController.create.and.callFake((config: any) => {
      toastConfig = config;
      return Promise.resolve({ present: jasmine.createSpy().and.resolveTo() } as any);
    });

    await TestBed.configureTestingModule({
      imports: [IssuesManagerComponent],
      providers: [
        { provide: IssueService, useValue: issueService },
        { provide: ToastController, useValue: toastController }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(IssuesManagerComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture?.destroy());

  describe('rendering', () => {
    it('creates', () => {
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('shows a loading indicator while the initial load is in flight', () => {
      issueService.loadAllIssues.and.returnValue(new Subject<IssueReport[]>().asObservable());
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.ion-text-center.ion-padding')).toBeTruthy();
    });

    it('shows the error banner on load failure', () => {
      issueService.loadAllIssues.and.returnValue(throwError(() => new Error('down')));
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.issues-error')).toBeTruthy();
    });

    it('renders one row per issue and the count badge', () => {
      fixture.detectChanges();
      allIssuesSubject.next([makeIssue({ id: 'a' }), makeIssue({ id: 'b' })]);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('.issue-row:not(.header-row)').length).toBe(2);
      expect(fixture.nativeElement.textContent).toContain('(2)');
    });
  });

  describe('reload()', () => {
    it('sets loading true while pending and false once resolved', () => {
      fixture.detectChanges();
      expect(component.loading).toBeFalse();
    });

    it('clears a previous error on a successful reload', () => {
      component.error = 'stale';
      issueService.loadAllIssues.and.returnValue(of([]));
      component.reload();
      expect(component.error).toBeNull();
    });

    it('sets an error message on failure without throwing', () => {
      issueService.loadAllIssues.and.returnValue(throwError(() => new Error('down')));
      expect(() => component.reload()).not.toThrow();
      expect(component.error).toContain('Could not load issue reports');
      expect(component.loading).toBeFalse();
    });
  });

  describe('onStatusChange()', () => {
    beforeEach(() => fixture.detectChanges());

    it('calls updateIssueStatus and shows a success toast', () => {
      issueService.updateIssueStatus.and.returnValue(of(makeIssue({ status: 'resolved' })));
      component.onStatusChange(makeIssue(), 'resolved');
      expect(issueService.updateIssueStatus).toHaveBeenCalledWith('i1', 'resolved');
      expect(toastConfig.color).toBe('success');
    });

    it('shows a danger toast on failure', () => {
      issueService.updateIssueStatus.and.returnValue(throwError(() => new Error('down')));
      component.onStatusChange(makeIssue(), 'rejected');
      expect(toastConfig.color).toBe('danger');
    });
  });

  describe('lightbox', () => {
    it('openLightbox()/closeLightbox() toggle lightboxUrl', () => {
      fixture.detectChanges();
      component.openLightbox('https://example.com/x.png');
      expect(component.lightboxUrl).toBe('https://example.com/x.png');
      component.closeLightbox();
      expect(component.lightboxUrl).toBeNull();
    });
  });

  describe('statusColor() / statusLabel() / formatDate()', () => {
    beforeEach(() => fixture.detectChanges());

    it('maps every status to a distinct colour and label', () => {
      const statuses: Array<IssueReport['status']> = ['pending', 'in-progress', 'resolved', 'rejected'];
      const colors = statuses.map((s) => component.statusColor(s));
      const labels = statuses.map((s) => component.statusLabel(s));
      expect(new Set(colors).size).toBe(4);
      expect(new Set(labels).size).toBe(4);
    });

    it('formats a date with a bullet separator', () => {
      expect(component.formatDate(new Date('2024-12-04T18:22:00.000Z'))).toContain('•');
    });
  });

  describe('ngOnDestroy() — memory leak', () => {
    it('unsubscribes from allIssues$', () => {
      fixture.detectChanges();
      fixture.destroy();
      expect(() => allIssuesSubject.next([makeIssue()])).not.toThrow();
      expect(component.issues).toEqual([]);
    });
  });
});
