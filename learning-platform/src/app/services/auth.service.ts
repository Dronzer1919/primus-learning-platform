import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { User, LoginCredentials, SignupData, UserStats } from '../models/user.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser: Observable<User | null>;
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {
    const storedUser = localStorage.getItem('currentUser');
    this.currentUserSubject = new BehaviorSubject<User | null>(
      storedUser ? JSON.parse(storedUser) : null
    );
    this.currentUser = this.currentUserSubject.asObservable();
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  public getToken(): string | null {
    return localStorage.getItem('token');
  }

  private storeSession(response: any): User {
    const user: User = {
      id: response.user.id,
      email: response.user.email,
      username: response.user.username,
      displayName: response.user.displayName || response.user.username,
      avatar: response.user.avatar || null,
      role: response.user.role,
      createdAt: new Date(),
      lastLogin: response.user.lastLogin ? new Date(response.user.lastLogin) : new Date(),
      loginCount: response.user.loginCount || 0
    };
    localStorage.setItem('currentUser', JSON.stringify(user));
    localStorage.setItem('token', response.token);
    this.currentUserSubject.next(user);
    return user;
  }

  login(credentials: LoginCredentials): Observable<User> {
    return this.http.post<any>(`${this.apiUrl}/auth/login`, {
      username: credentials.email,
      password: credentials.password
    }).pipe(
      tap(response => { if (response.success) this.storeSession(response); }),
      map(response => response.user)
    );
  }

  signup(signupData: SignupData): Observable<User> {
    return this.http.post<any>(`${this.apiUrl}/auth/register`, signupData).pipe(
      tap(response => { if (response.success) this.storeSession(response); }),
      map(response => response.user)
    );
  }

  loginWithGoogle(idToken: string): Observable<User> {
    return this.http.post<any>(`${this.apiUrl}/auth/google`, { idToken }).pipe(
      tap(response => { if (response.success) this.storeSession(response); }),
      map(response => response.user)
    );
  }

  getCurrentUser(): Observable<User> {
    return this.http.get<any>(`${this.apiUrl}/auth/me`).pipe(
      tap(response => {
        if (response.success && response.user) {
          const user: User = {
            id: response.user.id,
            email: response.user.email,
            username: response.user.username,
            displayName: response.user.displayName || response.user.username,
            avatar: response.user.avatar || null,
            role: response.user.role,
            createdAt: new Date(response.user.createdAt || Date.now()),
            lastLogin: response.user.lastLogin ? new Date(response.user.lastLogin) : undefined,
            loginCount: response.user.loginCount
          };
          localStorage.setItem('currentUser', JSON.stringify(user));
          this.currentUserSubject.next(user);
        }
      }),
      map(response => response.user)
    );
  }

  logout(): void {
    // Tell backend to close the session (fire-and-forget)
    this.http.post(`${this.apiUrl}/auth/logout`, {}).subscribe({ error: () => {} });
    localStorage.removeItem('currentUser');
    localStorage.removeItem('token');
    this.currentUserSubject.next(null);
  }

  getStats(): Observable<UserStats> {
    return this.http.get<any>(`${this.apiUrl}/auth/stats`).pipe(
      map(response => response.stats)
    );
  }

  isAdmin(): boolean {
    return this.currentUserValue?.role === 'admin';
  }

  isAuthenticated(): boolean {
    return this.currentUserValue !== null;
  }
}
