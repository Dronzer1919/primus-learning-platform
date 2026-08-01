import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { Topic, Subtopic, SubSubtopic, LanguageTab, DifficultyLevel, LanguagePlatform, UserNote } from '../models/content.model';
import { environment } from '../../environments/environment';
import { logWarn } from '../core/logger';

@Injectable({
  providedIn: 'root'
})
export class ContentService {
  private languageTabsSubject = new BehaviorSubject<LanguageTab[]>([]);
  private topicsSubject = new BehaviorSubject<Topic[]>([]);
  private userNotesSubject = new BehaviorSubject<UserNote[]>([]);

  public languageTabs$ = this.languageTabsSubject.asObservable();
  public topics$ = this.topicsSubject.asObservable();
  public userNotes$ = this.userNotesSubject.asObservable();

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {
    this.loadLanguageTabs();
    this.loadTopics();
  }

  // Load data from backend.
  //
  // Both loaders are called from the constructor and again after every write, so
  // they run often and from several components at once. Two rules keep that from
  // becoming a problem: a failure must leave the last good data in place rather
  // than emptying the UI, and a malformed response must not throw — an exception
  // raised inside a subscribe callback escapes to the global ErrorHandler, and
  // whatever the caller was doing is abandoned half-done.
  private loadLanguageTabs(): void {
    this.http.get<any>(`${this.apiUrl}/language-tabs/active`).pipe(
      catchError((error) => {
        logWarn('Could not load language tabs', error);
        return of(null);
      })
    ).subscribe((response) => {
      if (!response?.success || !Array.isArray(response.data)) {
        // Only fall back to the built-in tabs when there is nothing to show.
        // Overwriting real tabs with defaults on a transient failure would look
        // to the user like content had been deleted.
        if (!this.languageTabsSubject.value.length) this.initializeDefaultTabs();
        return;
      }
      this.languageTabsSubject.next(
        response.data.map((tab: any) => ({
          id: tab._id,
          name: tab.name,
          code: tab.code,
          order: tab.order,
          isActive: tab.isActive
        }))
      );
    });
  }

  private loadTopics(): void {
    this.http.get<any>(`${this.apiUrl}/topics`).pipe(
      catchError((error) => {
        logWarn('Could not load topics', error);
        return of(null);
      })
    ).subscribe((response) => {
      if (!response?.success || !Array.isArray(response.data)) return;
      this.topicsSubject.next(response.data.map((topic: any) => this.mapTopicFromBackend(topic)));
    });
  }

  // Defensive throughout: every field here comes off the wire. A topic saved
  // before subtopics existed, or a partial document, used to throw on
  // `backendTopic.subtopics.map` and take the whole list down with it.
  private mapTopicFromBackend(backendTopic: any): Topic {
    const source = backendTopic ?? {};
    const subtopics = Array.isArray(source.subtopics) ? source.subtopics : [];
    return {
      id: source._id,
      title: source.title,
      description: source.description,
      difficultyLevel: source.difficultyLevel,
      languagePlatform: source.languagePlatform,
      order: source.order,
      subtopics: subtopics.map((st: any) => ({
        id: st?._id,
        topicId: source._id,
        title: st?.title,
        order: st?.order,
        subSubtopics: Array.isArray(st?.subSubtopics) ? st.subSubtopics : [],
        content: Array.isArray(st?.content) ? st.content : []
      }))
    };
  }

  private initializeDefaultTabs(): void {
    const defaultTabs: LanguageTab[] = [
      { id: '1', name: 'HTML', code: 'html', order: 1, isActive: true },
      { id: '2', name: 'SCSS', code: 'scss', order: 2, isActive: true },
      { id: '3', name: 'JavaScript', code: 'javascript', order: 3, isActive: true },
      { id: '4', name: 'TypeScript', code: 'typescript', order: 4, isActive: true },
      { id: '5', name: 'CSS', code: 'css', order: 5, isActive: true },
      { id: '6', name: 'Angular', code: 'angular', order: 6, isActive: true },
      { id: '7', name: 'Node.js', code: 'nodejs', order: 7, isActive: true },
      { id: '8', name: 'RxJS', code: 'rxjs', order: 8, isActive: true }
    ];
    this.languageTabsSubject.next(defaultTabs);
  }

  // Language Tabs Management
  getLanguageTabs(): LanguageTab[] {
    return this.languageTabsSubject.value;
  }

  addLanguageTab(tab: Omit<LanguageTab, 'id'>): Observable<LanguageTab> {
    return this.http.post<any>(`${this.apiUrl}/language-tabs`, tab).pipe(
      tap(response => {
        if (response.success) {
          this.loadLanguageTabs();
        }
      }),
      map(response => response.data)
    );
  }

  updateLanguageTab(tab: LanguageTab): Observable<LanguageTab> {
    return this.http.put<any>(`${this.apiUrl}/language-tabs/${tab.id}`, tab).pipe(
      tap(response => {
        if (response.success) {
          this.loadLanguageTabs();
        }
      }),
      map(response => response.data)
    );
  }

  deleteLanguageTab(tabId: string): Observable<void> {
    return this.http.delete<any>(`${this.apiUrl}/language-tabs/${tabId}`).pipe(
      tap(response => {
        if (response.success) {
          this.loadLanguageTabs();
        }
      }),
      map(() => undefined)
    );
  }

  // Topics Management
  getTopics(): Topic[] {
    return this.topicsSubject.value;
  }

  getTopicsByDifficulty(difficulty: DifficultyLevel): Topic[] {
    return this.topicsSubject.value.filter(t => t.difficultyLevel === difficulty);
  }

  getTopicsByLanguage(language: LanguagePlatform): Topic[] {
    return this.topicsSubject.value.filter(t => t.languagePlatform === language);
  }

  getTopicById(topicId: string): Observable<Topic | null> {
    return this.http.get<any>(`${this.apiUrl}/topics/${topicId}`).pipe(
      map(response => response.success ? this.mapTopicFromBackend(response.data) : null)
    );
  }

  getSubtopicContent(topicId: string, subtopicId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/topics/${topicId}/subtopics/${subtopicId}`).pipe(
      map(response => response.success ? response.data : null)
    );
  }

  addTopic(topic: Omit<Topic, 'id'>): Observable<Topic> {
    return this.http.post<any>(`${this.apiUrl}/topics`, topic).pipe(
      tap(response => {
        if (response.success) {
          this.loadTopics();
        }
      }),
      map(response => this.mapTopicFromBackend(response.data))
    );
  }

  updateTopic(topic: Topic): Observable<Topic> {
    return this.http.put<any>(`${this.apiUrl}/topics/${topic.id}`, topic).pipe(
      tap(response => {
        if (response.success) {
          this.loadTopics();
        }
      }),
      map(response => this.mapTopicFromBackend(response.data))
    );
  }

  deleteTopic(topicId: string): Observable<void> {
    return this.http.delete<any>(`${this.apiUrl}/topics/${topicId}`).pipe(
      tap(response => {
        if (response.success) {
          this.loadTopics();
        }
      }),
      map(() => undefined)
    );
  }

  // Subtopics Management
  addSubtopic(topicId: string, subtopic: Omit<Subtopic, 'id' | 'topicId'>): Observable<Topic> {
    return this.http.post<any>(`${this.apiUrl}/topics/${topicId}/subtopics`, subtopic).pipe(
      tap(response => {
        if (response.success) {
          this.loadTopics();
        }
      }),
      map(response => this.mapTopicFromBackend(response.data))
    );
  }

  updateSubtopic(topicId: string, subtopic: Subtopic): Observable<Topic> {
    return this.http.put<any>(`${this.apiUrl}/topics/${topicId}/subtopics/${subtopic.id}`, subtopic).pipe(
      tap(response => {
        if (response.success) {
          this.loadTopics();
        }
      }),
      map(response => this.mapTopicFromBackend(response.data))
    );
  }

  deleteSubtopic(topicId: string, subtopicId: string): Observable<Topic> {
    return this.http.delete<any>(`${this.apiUrl}/topics/${topicId}/subtopics/${subtopicId}`).pipe(
      tap(response => {
        if (response.success) {
          this.loadTopics();
        }
      }),
      map(response => this.mapTopicFromBackend(response.data))
    );
  }

  // User Notes Management
  loadUserNotes(): Observable<UserNote[]> {
    return this.http.get<any>(`${this.apiUrl}/notes`).pipe(
      tap(response => {
        if (response?.success && Array.isArray(response.data)) {
          const notes = response.data.map((note: any) => ({
            id: note._id,
            userId: note.userId,
            content: note.content,
            createdAt: new Date(note.createdAt),
            updatedAt: new Date(note.updatedAt),
            isPinned: note.isPinned,
            style: note.style
          }));
          this.userNotesSubject.next(notes);
        }
      }),
      map(response => response.data)
    );
  }

  getUserNotes(userId: string): UserNote[] {
    return this.userNotesSubject.value.filter(note => note.userId === userId);
  }

  addUserNote(note: Omit<UserNote, 'id' | 'createdAt' | 'updatedAt'>): Observable<UserNote> {
    return this.http.post<any>(`${this.apiUrl}/notes`, note).pipe(
      tap(response => {
        if (response.success) {
          this.loadUserNotes().subscribe();
        }
      }),
      map(response => ({
        id: response.data._id,
        userId: response.data.userId,
        content: response.data.content,
        createdAt: new Date(response.data.createdAt),
        updatedAt: new Date(response.data.updatedAt),
        isPinned: response.data.isPinned,
        style: response.data.style
      }))
    );
  }

  updateUserNote(note: UserNote): Observable<UserNote> {
    return this.http.put<any>(`${this.apiUrl}/notes/${note.id}`, note).pipe(
      tap(response => {
        if (response.success) {
          this.loadUserNotes().subscribe();
        }
      }),
      map(response => ({
        id: response.data._id,
        userId: response.data.userId,
        content: response.data.content,
        createdAt: new Date(response.data.createdAt),
        updatedAt: new Date(response.data.updatedAt),
        isPinned: response.data.isPinned,
        style: response.data.style
      }))
    );
  }

  deleteUserNote(noteId: string): Observable<void> {
    return this.http.delete<any>(`${this.apiUrl}/notes/${noteId}`).pipe(
      tap(response => {
        if (response.success) {
          this.loadUserNotes().subscribe();
        }
      }),
      map(() => undefined)
    );
  }
}
