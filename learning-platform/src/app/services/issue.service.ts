import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { IssueReport, IssueStatus } from '../models/issue.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class IssueService {
  private myIssuesSubject = new BehaviorSubject<IssueReport[]>([]);
  private allIssuesSubject = new BehaviorSubject<IssueReport[]>([]); // admin-only

  public myIssues$ = this.myIssuesSubject.asObservable();
  public allIssues$ = this.allIssuesSubject.asObservable();

  private apiUrl = environment.apiUrl;

  // apiUrl is e.g. "https://api.primuscodex.com/api"; uploaded images are served
  // from "/uploads", a sibling of "/api" on the same origin — so the "/api" suffix
  // has to come off before appending the relative path the backend returns.
  private uploadsOrigin = this.apiUrl.replace(/\/api\/?$/, '');

  constructor(private http: HttpClient) {}

  private mapIssue = (raw: any): IssueReport => ({
    id: raw._id,
    userId: raw.userId,
    name: raw.name,
    email: raw.email,
    description: raw.description,
    imageUrl: raw.imageUrl ? `${this.uploadsOrigin}${raw.imageUrl}` : null,
    status: raw.status,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt)
  });

  // --- User-facing -----------------------------------------------------------

  loadMyIssues(): Observable<IssueReport[]> {
    return this.http.get<any>(`${this.apiUrl}/issues/my`).pipe(
      tap(response => {
        if (response?.success && Array.isArray(response.data)) {
          this.myIssuesSubject.next(response.data.map(this.mapIssue));
        }
      }),
      map(response => response.data)
    );
  }

  reportIssue(payload: { name: string; email: string; description: string; image?: File | null }): Observable<IssueReport> {
    const form = new FormData();
    form.append('name', payload.name);
    form.append('email', payload.email);
    form.append('description', payload.description);
    if (payload.image) form.append('image', payload.image);

    // No manual Content-Type: HttpClient sets multipart/form-data with the
    // right boundary itself when the body is a FormData instance.
    return this.http.post<any>(`${this.apiUrl}/issues`, form).pipe(
      tap(response => {
        if (response.success) this.loadMyIssues().subscribe();
      }),
      map(response => this.mapIssue(response.data))
    );
  }

  // --- Admin-only --------------------------------------------------------------

  loadAllIssues(): Observable<IssueReport[]> {
    return this.http.get<any>(`${this.apiUrl}/issues/admin`).pipe(
      tap(response => {
        if (response?.success && Array.isArray(response.data)) {
          this.allIssuesSubject.next(response.data.map(this.mapIssue));
        }
      }),
      map(response => response.data)
    );
  }

  updateIssueStatus(id: string, status: IssueStatus): Observable<IssueReport> {
    return this.http.patch<any>(`${this.apiUrl}/issues/admin/${id}/status`, { status }).pipe(
      tap(response => {
        if (response.success) this.loadAllIssues().subscribe();
      }),
      map(response => this.mapIssue(response.data))
    );
  }
}
