import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PlaygroundSessionService } from './playground-session.service';
import { environment } from '../../environments/environment';
import { PlaygroundSession } from '../models/playground-session.model';

const apiUrl = `${environment.apiUrl}/playground-sessions`;

function makeSession(overrides: Partial<PlaygroundSession> = {}): PlaygroundSession {
  return {
    _id: '1',
    userId: 'u1',
    title: 'A',
    mode: 'web',
    htmlCode: '',
    cssCode: '',
    jsCode: '',
    jsOnlyCode: '',
    tsCode: '',
    selectedTab: 'html',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides
  };
}

describe('PlaygroundSessionService', () => {
  let service: PlaygroundSessionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(PlaygroundSessionService);
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
      req.flush({ success: true, count: 1, data: sessions });
    });

    it('propagates a 401 (auth token missing/expired)', (done) => {
      service.getSessions().subscribe({
        next: () => fail('expected an error'),
        error: (err) => {
          expect(err.status).toBe(401);
          done();
        }
      });
      httpMock.expectOne(apiUrl).flush({}, { status: 401, statusText: 'Unauthorized' });
    });

    it('propagates a 500 server error', (done) => {
      service.getSessions().subscribe({
        next: () => fail('expected an error'),
        error: (err) => {
          expect(err.status).toBe(500);
          done();
        }
      });
      httpMock.expectOne(apiUrl).flush({}, { status: 500, statusText: 'Server Error' });
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

    it('propagates a 404 for a missing session', (done) => {
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
    it('POSTs the title and unwraps the created session', (done) => {
      const session = makeSession({ title: 'New' });
      service.createSession('New').subscribe((result) => {
        expect(result.title).toBe('New');
        done();
      });
      const req = httpMock.expectOne(apiUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ title: 'New' });
      req.flush({ success: true, data: session });
    });

    it('sends an undefined title when none is given', (done) => {
      service.createSession().subscribe(() => done());
      const req = httpMock.expectOne(apiUrl);
      expect(req.request.body).toEqual({ title: undefined });
      req.flush({ success: true, data: makeSession() });
    });
  });

  describe('updateSession()', () => {
    it('PUTs partial data and unwraps the response', (done) => {
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

    it('propagates a 413 when the payload is too large', (done) => {
      service.updateSession('1', { htmlCode: 'x'.repeat(1000) }).subscribe({
        next: () => fail('expected an error'),
        error: (err) => {
          expect(err.status).toBe(413);
          done();
        }
      });
      httpMock.expectOne(`${apiUrl}/1`).flush({}, { status: 413, statusText: 'Payload Too Large' });
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

    it('propagates a 403 (deleting another user\'s session)', (done) => {
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
