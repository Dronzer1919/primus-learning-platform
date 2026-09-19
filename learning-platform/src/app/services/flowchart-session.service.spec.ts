import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FlowchartSessionService } from './flowchart-session.service';
import { environment } from '../../environments/environment';
import { FlowchartSession } from '../models/flowchart-session.model';

const apiUrl = `${environment.apiUrl}/flowchart-sessions`;

function makeSession(overrides: Partial<FlowchartSession> = {}): FlowchartSession {
  return {
    _id: '1',
    userId: 'u1',
    title: 'A',
    nodes: [],
    edges: [],
    canvasBg: 'dots',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides
  };
}

describe('FlowchartSessionService', () => {
  let service: FlowchartSessionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(FlowchartSessionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getSessions()', () => {
    it('GETs the collection and unwraps the data envelope', (done) => {
      const sessions = [makeSession()];
      service.getSessions().subscribe((result) => {
        expect(result).toEqual(sessions);
        done();
      });
      const req = httpMock.expectOne(apiUrl);
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: sessions });
    });

    it('propagates a 401', (done) => {
      service.getSessions().subscribe({
        next: () => fail('expected an error'),
        error: (err) => {
          expect(err.status).toBe(401);
          done();
        }
      });
      httpMock.expectOne(apiUrl).flush({}, { status: 401, statusText: 'Unauthorized' });
    });

    it('propagates a network failure (status 0)', (done) => {
      service.getSessions().subscribe({
        next: () => fail('expected an error'),
        error: (err) => {
          expect(err.status).toBe(0);
          done();
        }
      });
      httpMock.expectOne(apiUrl).error(new ProgressEvent('Network error'), { status: 0 });
    });
  });

  describe('getSession()', () => {
    it('GETs a single session by id', (done) => {
      const session = makeSession({ _id: '42' });
      service.getSession('42').subscribe((result) => {
        expect(result).toEqual(session);
        done();
      });
      const req = httpMock.expectOne(`${apiUrl}/42`);
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: session });
    });

    it('propagates a 404', (done) => {
      service.getSession('missing').subscribe({
        next: () => fail('expected an error'),
        error: (err) => {
          expect(err.status).toBe(404);
          done();
        }
      });
      httpMock.expectOne(`${apiUrl}/missing`).flush({}, { status: 404, statusText: 'Not Found' });
    });
  });

  describe('createSession()', () => {
    it('POSTs the full payload and unwraps the created session', (done) => {
      const payload = { title: 'Flow', nodes: [{ id: 'n1' }] as any, edges: [], canvasBg: 'grid' as const };
      const created = makeSession(payload);
      service.createSession(payload).subscribe((result) => {
        expect(result.title).toBe('Flow');
        done();
      });
      const req = httpMock.expectOne(apiUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      req.flush({ success: true, data: created });
    });

    it('propagates a 400 for an invalid payload', (done) => {
      service.createSession({}).subscribe({
        next: () => fail('expected an error'),
        error: (err) => {
          expect(err.status).toBe(400);
          done();
        }
      });
      httpMock.expectOne(apiUrl).flush({}, { status: 400, statusText: 'Bad Request' });
    });
  });

  describe('updateSession()', () => {
    it('PUTs a partial payload and unwraps the response', (done) => {
      const session = makeSession({ title: 'Renamed' });
      service.updateSession('1', { title: 'Renamed' }).subscribe((result) => {
        expect(result.title).toBe('Renamed');
        done();
      });
      const req = httpMock.expectOne(`${apiUrl}/1`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ title: 'Renamed' });
      req.flush({ success: true, data: session });
    });
  });

  describe('deleteSession()', () => {
    it('DELETEs by id and resolves void', (done) => {
      service.deleteSession('1').subscribe((result) => {
        expect(result).toBeUndefined();
        done();
      });
      const req = httpMock.expectOne(`${apiUrl}/1`);
      expect(req.request.method).toBe('DELETE');
      req.flush({ success: true, data: null });
    });

    it('propagates a 403', (done) => {
      service.deleteSession('not-mine').subscribe({
        next: () => fail('expected an error'),
        error: (err) => {
          expect(err.status).toBe(403);
          done();
        }
      });
      httpMock.expectOne(`${apiUrl}/not-mine`).flush({}, { status: 403, statusText: 'Forbidden' });
    });
  });
});
