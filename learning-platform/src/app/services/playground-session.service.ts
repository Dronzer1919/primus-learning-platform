import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { PlaygroundSession } from '../models/playground-session.model';

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  count?: number;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class PlaygroundSessionService {
  private apiUrl = `${environment.apiUrl}/playground-sessions`;

  constructor(private http: HttpClient) {}

  getSessions(): Observable<PlaygroundSession[]> {
    return this.http.get<ApiResponse<PlaygroundSession[]>>(this.apiUrl).pipe(map(r => r.data));
  }

  getSession(id: string): Observable<PlaygroundSession> {
    return this.http.get<ApiResponse<PlaygroundSession>>(`${this.apiUrl}/${id}`).pipe(map(r => r.data));
  }

  createSession(title?: string): Observable<PlaygroundSession> {
    return this.http.post<ApiResponse<PlaygroundSession>>(this.apiUrl, { title }).pipe(map(r => r.data));
  }

  updateSession(id: string, data: Partial<PlaygroundSession>): Observable<PlaygroundSession> {
    return this.http.put<ApiResponse<PlaygroundSession>>(`${this.apiUrl}/${id}`, data).pipe(map(r => r.data));
  }

  deleteSession(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}`).pipe(map(() => undefined));
  }
}
