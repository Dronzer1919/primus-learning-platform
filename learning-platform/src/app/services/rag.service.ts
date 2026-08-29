import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { RagStreamEvent } from '../models/rag.model';

/**
 * Streams answers from POST /api/rag/ask.
 *
 * Deliberately not HttpClient: the backend streams newline-delimited JSON as
 * the answer is generated, and HttpClient's streaming support is awkward to
 * combine with bearer-token auth. A plain fetch() + ReadableStream reader,
 * wrapped in an Observable so components get the usual subscribe/unsubscribe
 * lifecycle (unsubscribing aborts the in-flight request).
 */
@Injectable({
  providedIn: 'root'
})
export class RagService {
  private apiUrl = environment.apiUrl;

  constructor(private authService: AuthService) {}

  ask(question: string, languagePlatform?: string): Observable<RagStreamEvent> {
    return new Observable<RagStreamEvent>((subscriber) => {
      const controller = new AbortController();

      this.streamAsk(question, languagePlatform, controller.signal, subscriber);

      return () => controller.abort();
    });
  }

  private async streamAsk(
    question: string,
    languagePlatform: string | undefined,
    signal: AbortSignal,
    subscriber: { next: (e: RagStreamEvent) => void; complete: () => void }
  ): Promise<void> {
    const token = this.authService.getToken();

    let response: Response;
    try {
      response = await fetch(`${this.apiUrl}/rag/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          question,
          ...(languagePlatform ? { languagePlatform } : {})
        }),
        signal
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') return; // unsubscribed — not a user-facing error
      subscriber.next({ type: 'error', message: 'Could not reach the server. Check your connection and try again.' });
      subscriber.complete();
      return;
    }

    if (!response.ok || !response.body) {
      subscriber.next({ type: 'error', message: await this.readErrorMessage(response) });
      subscriber.complete();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // The last split fragment may be a partial line still being streamed in.
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          this.emitLine(line, subscriber);
        }
      }
      if (buffer.trim()) this.emitLine(buffer, subscriber);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        subscriber.next({ type: 'error', message: 'The connection was interrupted. Please try again.' });
      }
    } finally {
      subscriber.complete();
    }
  }

  private emitLine(line: string, subscriber: { next: (e: RagStreamEvent) => void }): void {
    try {
      subscriber.next(JSON.parse(line) as RagStreamEvent);
    } catch {
      // A malformed line shouldn't kill an otherwise-good stream.
    }
  }

  private async readErrorMessage(response: Response): Promise<string> {
    try {
      const body = await response.json();
      if (body && typeof body.message === 'string') return body.message;
    } catch {
      // Non-JSON error body — fall through to the generic message.
    }
    return response.status === 503
      ? 'The AI assistant is not available right now.'
      : `Request failed (${response.status}).`;
  }
}
