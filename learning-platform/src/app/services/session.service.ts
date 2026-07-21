import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { WorkSession } from '../models/session.model';

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  count?: number;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private apiUrl = `${environment.apiUrl}/sessions`;

  constructor(private http: HttpClient) {}

  // ---- Sessions ----
  getSessions(): Observable<WorkSession[]> {
    return this.http.get<ApiResponse<WorkSession[]>>(this.apiUrl).pipe(map(r => r.data));
  }

  getSession(id: string): Observable<WorkSession> {
    return this.http.get<ApiResponse<WorkSession>>(`${this.apiUrl}/${id}`).pipe(map(r => r.data));
  }

  createSession(title?: string): Observable<WorkSession> {
    return this.http.post<ApiResponse<WorkSession>>(this.apiUrl, { title }).pipe(map(r => r.data));
  }

  renameSession(id: string, title: string): Observable<WorkSession> {
    return this.http.put<ApiResponse<WorkSession>>(`${this.apiUrl}/${id}`, { title }).pipe(map(r => r.data));
  }

  deleteSession(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}`).pipe(map(() => undefined));
  }

  // ---- Todos (return the updated session) ----
  addTodo(sessionId: string, text: string): Observable<WorkSession> {
    return this.http.post<ApiResponse<WorkSession>>(`${this.apiUrl}/${sessionId}/todos`, { text }).pipe(map(r => r.data));
  }

  updateTodo(sessionId: string, todoId: string, changes: { text?: string; completed?: boolean }): Observable<WorkSession> {
    return this.http.put<ApiResponse<WorkSession>>(`${this.apiUrl}/${sessionId}/todos/${todoId}`, changes).pipe(map(r => r.data));
  }

  deleteTodo(sessionId: string, todoId: string): Observable<WorkSession> {
    return this.http.delete<ApiResponse<WorkSession>>(`${this.apiUrl}/${sessionId}/todos/${todoId}`).pipe(map(r => r.data));
  }

  // ---- Notes (return the updated session) ----
  addNote(sessionId: string, content: string): Observable<WorkSession> {
    return this.http.post<ApiResponse<WorkSession>>(`${this.apiUrl}/${sessionId}/notes`, { content }).pipe(map(r => r.data));
  }

  updateNote(sessionId: string, noteId: string, changes: { content?: string; isPinned?: boolean }): Observable<WorkSession> {
    return this.http.put<ApiResponse<WorkSession>>(`${this.apiUrl}/${sessionId}/notes/${noteId}`, changes).pipe(map(r => r.data));
  }

  deleteNote(sessionId: string, noteId: string): Observable<WorkSession> {
    return this.http.delete<ApiResponse<WorkSession>>(`${this.apiUrl}/${sessionId}/notes/${noteId}`).pipe(map(r => r.data));
  }
}
