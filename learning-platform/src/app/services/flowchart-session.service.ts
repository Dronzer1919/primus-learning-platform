import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { FlowchartSession, FlowchartSessionPayload } from '../models/flowchart-session.model';

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  count?: number;
  data: T;
}

/**
 * Saved flowcharts, per user. The JWT is attached by authInterceptor, so
 * nothing here sets an Authorization header of its own.
 */
@Injectable({ providedIn: 'root' })
export class FlowchartSessionService {
  private apiUrl = `${environment.apiUrl}/flowchart-sessions`;

  constructor(private http: HttpClient) {}

  getSessions(): Observable<FlowchartSession[]> {
    return this.http.get<ApiResponse<FlowchartSession[]>>(this.apiUrl).pipe(map(r => r.data));
  }

  getSession(id: string): Observable<FlowchartSession> {
    return this.http.get<ApiResponse<FlowchartSession>>(`${this.apiUrl}/${id}`).pipe(map(r => r.data));
  }

  createSession(payload: FlowchartSessionPayload): Observable<FlowchartSession> {
    return this.http.post<ApiResponse<FlowchartSession>>(this.apiUrl, payload).pipe(map(r => r.data));
  }

  updateSession(id: string, payload: FlowchartSessionPayload): Observable<FlowchartSession> {
    return this.http.put<ApiResponse<FlowchartSession>>(`${this.apiUrl}/${id}`, payload).pipe(map(r => r.data));
  }

  deleteSession(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}`).pipe(map(() => undefined));
  }
}
