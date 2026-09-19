import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { environment } from '../../environments/environment';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.removeItem('token');
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem('token');
  });

  it('attaches the bearer token to a same-origin API request', () => {
    localStorage.setItem('token', 'abc123');
    http.get(`${environment.apiUrl}/foo`).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/foo`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer abc123');
    req.flush({});
  });

  it('does not attach a header when there is no token', () => {
    http.get(`${environment.apiUrl}/foo`).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/foo`);
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('attaches the header for a relative-URL request (treated as same-origin)', () => {
    localStorage.setItem('token', 'abc123');
    http.get('/relative/path').subscribe();
    const req = httpMock.expectOne('/relative/path');
    expect(req.request.headers.get('Authorization')).toBe('Bearer abc123');
    req.flush({});
  });

  it('does NOT attach the token to a third-party absolute URL (the whole point of this interceptor)', () => {
    localStorage.setItem('token', 'abc123');
    http.get('https://evil-analytics.example.com/beacon').subscribe();
    const req = httpMock.expectOne('https://evil-analytics.example.com/beacon');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('treats a storage read failure as "no token" instead of throwing', () => {
    spyOn(localStorage, 'getItem').and.throwError('SecurityError');
    expect(() => http.get(`${environment.apiUrl}/foo`).subscribe()).not.toThrow();
    const req = httpMock.expectOne(`${environment.apiUrl}/foo`);
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });
});
