import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { distinctUntilChanged, map, tap } from 'rxjs/operators';
import { User, LoginCredentials, SignupData, UserStats } from '../models/user.model';
import { environment } from '../../environments/environment';
import { logWarn } from '../core/logger';

const TOKEN_KEY = 'token';
const USER_KEY = 'currentUser';

/** Dispatched by errorInterceptor when the API rejects the token with a 401. */
export const SESSION_EXPIRED_EVENT = 'app:session-expired';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser: Observable<User | null>;

  /**
   * Reactive counterpart to isAuthenticated(), for templates to bind to.
   *
   * Views must key off this rather than `currentUser` alone. The stored user
   * and the token are separate entries with different lifetimes: the token can
   * expire, or be cleared by a sign-out in another tab, while the user object
   * is still sitting in storage. A view that only asks "is there a user?" then
   * offers Logout for a session the server will reject on the next request —
   * and conversely keeps Sign In on screen for a session that is perfectly
   * valid.
   *
   * Deliberately free of side effects. isAuthenticated() clears the stale
   * session as it checks, which is what a guard wants but not something that
   * may run inside change detection — mutating state there is what produces
   * ExpressionChangedAfterItHasBeenCheckedError.
   */
  public isLoggedIn$: Observable<boolean>;

  /**
   * Fires once per successful login/signup/Google-login — never on the
   * initial page-load rehydration from storage. Lets a single subscriber
   * (see app.component.ts) offer to migrate guest-mode local data without
   * every auth entry point having to remember to call it.
   */
  private justAuthenticatedSubject = new Subject<User>();
  public justAuthenticated: Observable<User> = this.justAuthenticatedSubject.asObservable();

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {
    this.currentUserSubject = new BehaviorSubject<User | null>(this.readStoredUser());
    this.currentUser = this.currentUserSubject.asObservable();
    this.isLoggedIn$ = this.currentUser.pipe(
      map(user => user !== null && this.hasUsableToken()),
      distinctUntilChanged()
    );

    // The interceptor cannot inject this service (HttpClient would be building
    // its own consumer), so a 401 is announced as a DOM event instead. Without
    // this the in-memory user would stay populated after the token was cleared,
    // and the guards would keep waving the user through to a page whose every
    // request 401s.
    window.addEventListener(SESSION_EXPIRED_EVENT, () => this.clearSession());

    // Signing out in one tab should not leave the others authenticated. The
    // storage event only fires in *other* tabs, so this cannot recurse.
    window.addEventListener('storage', (event) => {
      if (event.key === TOKEN_KEY && !event.newValue) this.clearSession();
    });
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  public getToken(): string | null {
    return this.readStorage(TOKEN_KEY);
  }

  /**
   * Reads the persisted user without letting a bad value take down the app.
   *
   * This runs while the root injector is being built, so anything thrown here
   * aborts bootstrap and the user gets a blank page with no way back — and the
   * bad value survives the refresh, so the blank page is permanent. localStorage
   * is fully under the client's control: a half-written entry from a closed tab,
   * a value edited by hand, or a leftover from an older shape of User are all
   * ordinary. Treat unreadable storage as "signed out" and move on.
   */
  private readStoredUser(): User | null {
    const raw = this.readStorage(USER_KEY);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      // A stored object still has to look like a user. Without this check a
      // truthy-but-wrong value (an array, a string, `null` from an old bug)
      // becomes a "signed in" session whose every field is undefined.
      if (!parsed || typeof parsed !== 'object' || !parsed.id || !parsed.username) {
        throw new Error('stored user is missing required fields');
      }
      return parsed as User;
    } catch (error) {
      logWarn('Discarding unreadable stored session', error);
      this.removeStorage(USER_KEY);
      this.removeStorage(TOKEN_KEY);
      return null;
    }
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
    this.writeStorage(USER_KEY, JSON.stringify(user));
    this.writeStorage(TOKEN_KEY, response.token);
    this.currentUserSubject.next(user);
    this.justAuthenticatedSubject.next(user);
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
          this.writeStorage(USER_KEY, JSON.stringify(user));
          this.currentUserSubject.next(user);
        }
      }),
      map(response => response.user)
    );
  }

  logout(): void {
    // Fire-and-forget, and deliberately before the token is cleared: the
    // interceptor reads it synchronously as this subscribes, so the request
    // still carries the credential the server needs to close the session.
    this.http.post(`${this.apiUrl}/auth/logout`, {}).subscribe({ error: () => {} });
    this.clearSession();
  }

  /** Drops the local session. Safe to call repeatedly. */
  clearSession(): void {
    this.removeStorage(USER_KEY);
    this.removeStorage(TOKEN_KEY);
    if (this.currentUserSubject.value !== null) this.currentUserSubject.next(null);
  }

  getStats(): Observable<UserStats> {
    return this.http.get<any>(`${this.apiUrl}/auth/stats`).pipe(
      map(response => response.stats)
    );
  }

  isAdmin(): boolean {
    return this.isAuthenticated() && this.currentUserValue?.role === 'admin';
  }

  /**
   * True only when there is a user *and* a token that has not already expired.
   *
   * The expiry check is a UX guard, not a security one — the server verifies
   * the signature and is the only opinion that counts. What it buys is that an
   * expired session sends the user to the login page directly, instead of into
   * a dashboard that renders empty because every request behind it 401s.
   */
  isAuthenticated(): boolean {
    if (this.currentUserValue === null) return false;

    const token = this.getToken();
    if (!token) {
      this.clearSession();
      return false;
    }
    if (this.isTokenExpired(token)) {
      logWarn('Stored token has expired — clearing the local session');
      this.clearSession();
      return false;
    }
    return true;
  }

  /** Presence and expiry of the stored token, without clearing anything. */
  private hasUsableToken(): boolean {
    const token = this.getToken();
    return !!token && !this.isTokenExpired(token);
  }

  /**
   * Reads `exp` out of a JWT payload. Never trusts it for anything but expiry:
   * the payload is base64, not encrypted, so a client can put whatever it likes
   * in there. A token we cannot parse is treated as valid and left for the
   * server to reject — failing closed here would sign users out over a token
   * format this code simply does not recognise.
   */
  private isTokenExpired(token: string): boolean {
    try {
      const [, payload] = token.split('.');
      if (!payload) return false;
      // base64url -> base64 before decoding.
      const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      const exp = JSON.parse(json)?.exp;
      if (typeof exp !== 'number') return false;
      return exp * 1000 <= Date.now();
    } catch {
      return false;
    }
  }

  // --- storage helpers -------------------------------------------------------
  // Every localStorage call is wrapped: Safari's private mode throws on write
  // once its quota is reached, and an unguarded setItem there would turn a
  // successful login into a crash.

  private readStorage(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private writeStorage(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      logWarn(`Could not persist "${key}" — the session will not survive a reload`, error);
    }
  }

  private removeStorage(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* storage unavailable */
    }
  }
}
