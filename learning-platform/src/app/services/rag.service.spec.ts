import { TestBed } from '@angular/core/testing';
import { RagService } from './rag.service';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';
import { RagStreamEvent } from '../models/rag.model';

/** Builds a real Response whose body streams the given lines as separate chunks,
 *  one per underlying enqueue() — this exercises the service's real ReadableStream
 *  reading/buffering logic rather than a hand-rolled fake. */
function streamResponse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    }
  });
  return new Response(body, { status });
}

function collect(service: RagService, question: string, scope?: string): Promise<RagStreamEvent[]> {
  return new Promise((resolve) => {
    const events: RagStreamEvent[] = [];
    service.ask(question, scope).subscribe({
      next: (e) => events.push(e),
      complete: () => resolve(events)
    });
  });
}

describe('RagService', () => {
  let service: RagService;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['getToken']);
    authService.getToken.and.returnValue(null);

    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: authService }]
    });
    service = TestBed.inject(RagService);
  });

  describe('request shape', () => {
    it('POSTs to /rag/ask with the question in the body', async () => {
      const fetchSpy = spyOn(window, 'fetch').and.resolveTo(streamResponse(['{"type":"done"}\n']));
      await collect(service, 'What is a closure?');
      const [url, init] = fetchSpy.calls.mostRecent().args;
      expect(url).toBe(`${environment.apiUrl}/rag/ask`);
      expect(init?.method).toBe('POST');
      expect(JSON.parse(init?.body as string)).toEqual({ question: 'What is a closure?' });
    });

    it('includes languagePlatform in the body when a scope is given', async () => {
      const fetchSpy = spyOn(window, 'fetch').and.resolveTo(streamResponse(['{"type":"done"}\n']));
      await collect(service, 'q', 'javascript');
      const [, init] = fetchSpy.calls.mostRecent().args;
      expect(JSON.parse(init?.body as string)).toEqual({ question: 'q', languagePlatform: 'javascript' });
    });

    it('attaches the bearer token when one is present', async () => {
      authService.getToken.and.returnValue('tok-123');
      const fetchSpy = spyOn(window, 'fetch').and.resolveTo(streamResponse(['{"type":"done"}\n']));
      await collect(service, 'q');
      const [, init] = fetchSpy.calls.mostRecent().args;
      expect((init?.headers as Record<string, string>)['Authorization']).toBe('Bearer tok-123');
    });

    it('omits the Authorization header when there is no token', async () => {
      const fetchSpy = spyOn(window, 'fetch').and.resolveTo(streamResponse(['{"type":"done"}\n']));
      await collect(service, 'q');
      const [, init] = fetchSpy.calls.mostRecent().args;
      expect((init?.headers as Record<string, string>)['Authorization']).toBeUndefined();
    });
  });

  describe('parsing the newline-delimited stream', () => {
    it('emits one event per JSON line, in order', async () => {
      spyOn(window, 'fetch').and.resolveTo(
        streamResponse(['{"type":"citations","citations":[]}\n', '{"type":"delta","text":"Hi"}\n', '{"type":"done"}\n'])
      );
      const events = await collect(service, 'q');
      expect(events.map((e) => e.type)).toEqual(['citations', 'delta', 'done']);
    });

    it('reassembles a JSON line split across multiple stream chunks', async () => {
      const line = '{"type":"delta","text":"reassembled"}\n';
      spyOn(window, 'fetch').and.resolveTo(streamResponse([line.slice(0, 10), line.slice(10)]));
      const events = await collect(service, 'q');
      expect(events).toEqual([{ type: 'delta', text: 'reassembled' } as any]);
    });

    it('ignores a malformed line without killing the rest of the stream', async () => {
      spyOn(window, 'fetch').and.resolveTo(
        streamResponse(['not valid json\n', '{"type":"delta","text":"ok"}\n'])
      );
      const events = await collect(service, 'q');
      expect(events).toEqual([{ type: 'delta', text: 'ok' } as any]);
    });

    it('emits a trailing line that has no final newline', async () => {
      spyOn(window, 'fetch').and.resolveTo(streamResponse(['{"type":"delta","text":"no newline"}']));
      const events = await collect(service, 'q');
      expect(events).toEqual([{ type: 'delta', text: 'no newline' } as any]);
    });

    it('skips blank lines', async () => {
      spyOn(window, 'fetch').and.resolveTo(streamResponse(['\n\n{"type":"done"}\n']));
      const events = await collect(service, 'q');
      expect(events).toEqual([{ type: 'done' } as any]);
    });

    it('always completes the Observable once the stream ends', async () => {
      spyOn(window, 'fetch').and.resolveTo(streamResponse(['{"type":"done"}\n']));
      let completed = false;
      await new Promise<void>((resolve) => {
        service.ask('q').subscribe({ complete: () => { completed = true; resolve(); } });
      });
      expect(completed).toBeTrue();
    });
  });

  describe('error handling', () => {
    it('emits an error event with the server\'s JSON message on a non-OK response', async () => {
      spyOn(window, 'fetch').and.resolveTo(new Response(JSON.stringify({ message: 'Rate limited' }), { status: 429 }));
      const events = await collect(service, 'q');
      expect(events).toEqual([{ type: 'error', message: 'Rate limited' }]);
    });

    it('falls back to a 503-specific message when the error body is not JSON', async () => {
      spyOn(window, 'fetch').and.resolveTo(new Response('not json', { status: 503 }));
      const events = await collect(service, 'q');
      expect(events).toEqual([{ type: 'error', message: 'The AI assistant is not available right now.' }]);
    });

    it('falls back to a generic status message for any other non-OK, non-JSON response', async () => {
      spyOn(window, 'fetch').and.resolveTo(new Response('nope', { status: 500 }));
      const events = await collect(service, 'q');
      expect(events).toEqual([{ type: 'error', message: 'Request failed (500).' }]);
    });

    it('emits a connection error when fetch itself rejects (network failure)', async () => {
      spyOn(window, 'fetch').and.rejectWith(new TypeError('Failed to fetch'));
      const events = await collect(service, 'q');
      expect(events).toEqual([{ type: 'error', message: 'Could not reach the server. Check your connection and try again.' }]);
    });

    it('emits no error event when fetch rejects with an AbortError (user unsubscribed, not a real failure)', async () => {
      // Realistically, an AbortError only ever happens because the caller unsubscribed
      // (which is what aborts the signal fetch() is watching) — coupling the rejection to
      // a real unsubscribe() here, rather than just making fetch reject with that name in
      // isolation, matches how the source can actually reach this branch. It's also why
      // the source deliberately skips subscriber.complete() on this path: RxJS has
      // already torn the subscriber down by the time it would run, so there's nothing
      // signalable to complete — asserting that no `next` ever fired is what's left to
      // check, not waiting on a complete() that legitimately never comes.
      spyOn(window, 'fetch').and.callFake(
        (_url: any, init: any) =>
          new Promise((_, reject) => {
            init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
          })
      );

      const events: RagStreamEvent[] = [];
      const sub = service.ask('q').subscribe({ next: (e) => events.push(e) });
      sub.unsubscribe();
      await Promise.resolve().then(() => Promise.resolve()); // flush the microtask the rejection resolves on

      expect(events).toEqual([]);
    });

    it('emits an interruption error when the stream itself breaks mid-read', async () => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"type":"delta","text":"partial"}\n'));
        },
        pull() {
          throw new Error('stream broke');
        }
      });
      spyOn(window, 'fetch').and.resolveTo(new Response(body, { status: 200 }));
      const events = await collect(service, 'q');
      expect(events.some((e) => e.type === 'error' && e.message.includes('interrupted'))).toBeTrue();
    });
  });

  describe('unsubscribe aborts the in-flight request', () => {
    it('aborts the fetch signal when the subscription is torn down before it resolves', async () => {
      let capturedSignal: AbortSignal | undefined;
      spyOn(window, 'fetch').and.callFake((_url: any, init: any) => {
        capturedSignal = init.signal;
        return new Promise(() => {}); // never resolves — simulates an in-flight request
      });

      const sub = service.ask('q').subscribe();
      expect(capturedSignal?.aborted).toBeFalse();
      sub.unsubscribe();
      expect(capturedSignal?.aborted).toBeTrue();
    });
  });
});
