import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { IssueService } from './issue.service';
import { environment } from '../../environments/environment';

const apiUrl = environment.apiUrl;
const uploadsOrigin = apiUrl.replace(/\/api\/?$/, '');

function rawIssue(overrides: any = {}): any {
  return {
    _id: 'i1', userId: 'u1', name: 'Alice', email: 'a@b.com', description: 'It broke',
    imageUrl: null, status: 'pending', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides
  };
}

describe('IssueService', () => {
  let service: IssueService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(IssueService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('loadMyIssues()', () => {
    it('GETs /issues/my and maps the response, resolving imageUrl to an absolute URL', (done) => {
      service.loadMyIssues().subscribe((issues) => {
        expect(issues.length).toBe(1);
        done();
      });
      const req = httpMock.expectOne(`${apiUrl}/issues/my`);
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: [rawIssue({ imageUrl: '/uploads/x.png' })] });
    });

    it('resolves imageUrl against the uploads origin (API origin minus /api)', (done) => {
      service.loadMyIssues().subscribe(() => {
        const issue = service['myIssuesSubject'].value[0];
        expect(issue.imageUrl).toBe(`${uploadsOrigin}/uploads/x.png`);
        done();
      });
      httpMock.expectOne(`${apiUrl}/issues/my`).flush({ success: true, data: [rawIssue({ imageUrl: '/uploads/x.png' })] });
    });

    it('leaves imageUrl null when the issue has no image', (done) => {
      service.loadMyIssues().subscribe(() => {
        expect(service['myIssuesSubject'].value[0].imageUrl).toBeNull();
        done();
      });
      httpMock.expectOne(`${apiUrl}/issues/my`).flush({ success: true, data: [rawIssue({ imageUrl: null })] });
    });

    it('updates myIssues$ with converted Date objects', (done) => {
      service.myIssues$.subscribe((issues) => {
        if (issues.length === 0) return;
        expect(issues[0].createdAt).toEqual(jasmine.any(Date));
        done();
      });
      service.loadMyIssues().subscribe();
      httpMock.expectOne(`${apiUrl}/issues/my`).flush({ success: true, data: [rawIssue()] });
    });

    it('leaves myIssues$ unchanged on a malformed response', (done) => {
      service.loadMyIssues().subscribe(() => {
        expect(service['myIssuesSubject'].value).toEqual([]);
        done();
      });
      httpMock.expectOne(`${apiUrl}/issues/my`).flush({ success: false });
    });
  });

  describe('reportIssue()', () => {
    it('POSTs a FormData body with name/email/description', (done) => {
      service.reportIssue({ name: 'Alice', email: 'a@b.com', description: 'broke' }).subscribe((issue) => {
        expect(issue.id).toBe('i1');
        done();
      });
      const req = httpMock.expectOne(`${apiUrl}/issues`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body instanceof FormData).toBeTrue();
      expect((req.request.body as FormData).get('name')).toBe('Alice');
      expect((req.request.body as FormData).get('email')).toBe('a@b.com');
      expect((req.request.body as FormData).get('description')).toBe('broke');
      req.flush({ success: true, data: rawIssue() });
      httpMock.expectOne(`${apiUrl}/issues/my`).flush({ success: true, data: [] }); // the reload
    });

    it('includes the image file in the form data when provided', (done) => {
      const file = new File(['x'], 'screenshot.png', { type: 'image/png' });
      service.reportIssue({ name: 'A', email: 'a@b.com', description: 'd', image: file }).subscribe(() => done());
      const req = httpMock.expectOne(`${apiUrl}/issues`);
      expect((req.request.body as FormData).get('image')).toBe(file);
      req.flush({ success: true, data: rawIssue() });
      httpMock.expectOne(`${apiUrl}/issues/my`).flush({ success: true, data: [] }); // the reload
    });

    it('omits the image field entirely when none is provided', (done) => {
      service.reportIssue({ name: 'A', email: 'a@b.com', description: 'd' }).subscribe(() => done());
      const req = httpMock.expectOne(`${apiUrl}/issues`);
      expect((req.request.body as FormData).has('image')).toBeFalse();
      req.flush({ success: true, data: rawIssue() });
      httpMock.expectOne(`${apiUrl}/issues/my`).flush({ success: true, data: [] }); // the reload
    });

    it('triggers a reload of myIssues on success', (done) => {
      service.reportIssue({ name: 'A', email: 'a@b.com', description: 'd' }).subscribe(() => done());
      httpMock.expectOne(`${apiUrl}/issues`).flush({ success: true, data: rawIssue() });
      httpMock.expectOne(`${apiUrl}/issues/my`).flush({ success: true, data: [] }); // the reload
    });

    it('propagates an error without reloading', (done) => {
      service.reportIssue({ name: 'A', email: 'a@b.com', description: 'd' }).subscribe({
        next: () => fail('expected an error'),
        error: (err) => {
          expect(err.status).toBe(500);
          done();
        }
      });
      httpMock.expectOne(`${apiUrl}/issues`).flush({}, { status: 500, statusText: 'Server Error' });
    });
  });

  describe('loadAllIssues() (admin-only)', () => {
    it('GETs /issues/admin and maps the response', (done) => {
      service.loadAllIssues().subscribe((issues) => {
        expect(issues.length).toBe(2);
        done();
      });
      httpMock.expectOne(`${apiUrl}/issues/admin`).flush({ success: true, data: [rawIssue({ _id: '1' }), rawIssue({ _id: '2' })] });
    });

    it('propagates a 403 for a non-admin caller', (done) => {
      service.loadAllIssues().subscribe({
        next: () => fail('expected an error'),
        error: (err) => {
          expect(err.status).toBe(403);
          done();
        }
      });
      httpMock.expectOne(`${apiUrl}/issues/admin`).flush({}, { status: 403, statusText: 'Forbidden' });
    });
  });

  describe('updateIssueStatus()', () => {
    it('PATCHes the status and triggers an admin-list reload on success', (done) => {
      service.updateIssueStatus('i1', 'resolved').subscribe((issue) => {
        expect(issue.status).toBe('resolved');
        done();
      });
      const req = httpMock.expectOne(`${apiUrl}/issues/admin/i1/status`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ status: 'resolved' });
      req.flush({ success: true, data: rawIssue({ status: 'resolved' }) });
      httpMock.expectOne(`${apiUrl}/issues/admin`).flush({ success: true, data: [] }); // the reload
    });

    it('propagates an error without reloading', (done) => {
      service.updateIssueStatus('i1', 'resolved').subscribe({
        next: () => fail('expected an error'),
        error: (err) => {
          expect(err.status).toBe(404);
          done();
        }
      });
      httpMock.expectOne(`${apiUrl}/issues/admin/i1/status`).flush({}, { status: 404, statusText: 'Not Found' });
    });
  });
});
