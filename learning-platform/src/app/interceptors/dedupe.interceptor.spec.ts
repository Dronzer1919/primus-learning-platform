import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { dedupeInterceptor, inFlightCount } from './dedupe.interceptor';

describe('dedupeInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([dedupeInterceptor])), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('collapses two simultaneous GETs to the same URL into a single real request', () => {
    let a: unknown;
    let b: unknown;
    http.get('/api/dedupe-test-1').subscribe((r) => (a = r));
    http.get('/api/dedupe-test-1').subscribe((r) => (b = r));

    httpMock.expectOne('/api/dedupe-test-1').flush({ hello: 'world' });

    expect(a).toEqual({ hello: 'world' });
    expect(b).toEqual({ hello: 'world' });
  });

  it('never dedupes a POST — two writes are two intents', () => {
    http.post('/api/dedupe-test-2', { a: 1 }).subscribe();
    http.post('/api/dedupe-test-2', { a: 1 }).subscribe();

    const reqs = httpMock.match('/api/dedupe-test-2');
    expect(reqs.length).toBe(2);
    reqs.forEach((r) => r.flush({}));
  });

  it('issues a fresh request for the same URL once the first has completed', () => {
    http.get('/api/dedupe-test-3').subscribe();
    httpMock.expectOne('/api/dedupe-test-3').flush({});

    http.get('/api/dedupe-test-3').subscribe();
    // expectOne() throws if the second call reused the first (completed) shared stream
    // instead of issuing a real request — reaching flush() below is itself the assertion.
    const second = httpMock.expectOne('/api/dedupe-test-3');
    second.flush({});
    expect().nothing();
  });

  it('distinguishes GETs by their full URL including query params', () => {
    http.get('/api/dedupe-test-4', { params: { page: '1' } }).subscribe();
    http.get('/api/dedupe-test-4', { params: { page: '2' } }).subscribe();

    const reqs = httpMock.match((r) => r.url === '/api/dedupe-test-4');
    expect(reqs.length).toBe(2);
    reqs.forEach((r) => r.flush({}));
  });

  it('removes the entry from the in-flight map once the shared response settles', () => {
    const before = inFlightCount();
    http.get('/api/dedupe-test-5').subscribe();
    expect(inFlightCount()).toBe(before + 1);
    httpMock.expectOne('/api/dedupe-test-5').flush({});
    expect(inFlightCount()).toBe(before);
  });

  it('cancels the real request once every subscriber unsubscribes before it settles (resetOnRefCountZero)', () => {
    const sub = http.get('/api/dedupe-test-6').subscribe();
    const req = httpMock.expectOne('/api/dedupe-test-6');
    sub.unsubscribe();
    expect(req.cancelled).toBeTrue();
  });

  it('resets sharing after an error, so a retried GET to the same URL is a fresh call', () => {
    http.get('/api/dedupe-test-7').subscribe({ error: () => {} });
    httpMock.expectOne('/api/dedupe-test-7').flush({}, { status: 500, statusText: 'Server Error' });

    http.get('/api/dedupe-test-7').subscribe({ error: () => {} });
    // Same reasoning as above: expectOne() failing would mean the errored stream was
    // still being shared instead of a fresh request being issued.
    httpMock.expectOne('/api/dedupe-test-7').flush({}, { status: 500, statusText: 'Server Error' });
    expect().nothing();
  });
});
