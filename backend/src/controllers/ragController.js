const ragService = require('../services/ragService');
const ragIndexService = require('../services/ragIndexService');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

const LANGUAGE_PLATFORMS = ['html', 'scss', 'css', 'typescript', 'javascript', 'angular', 'nodejs', 'rxjs'];

// Ask a question, streamed back as newline-delimited JSON.
//
// Not classic SSE: no `text/event-stream`, no EventSource. EventSource can
// only issue GET requests and cannot send the Authorization header this route
// needs, so the frontend instead consumes this with fetch() + a ReadableStream
// reader, splitting on '\n'.
exports.ask = asyncHandler(async (req, res) => {
  const question = typeof req.body.question === 'string' ? req.body.question.trim() : '';
  if (!question) throw new AppError('question is required', 400);
  if (question.length > ragService.MAX_QUESTION_LENGTH) {
    throw new AppError(`question must be ${ragService.MAX_QUESTION_LENGTH} characters or fewer`, 400);
  }

  const languagePlatform = LANGUAGE_PLATFORMS.includes(req.body.languagePlatform)
    ? req.body.languagePlatform
    : undefined;

  // Checked before any header is written, so a missing key still produces a
  // normal JSON 503 via errorHandler instead of a truncated stream.
  if (!ragService.isConfigured()) {
    throw new AppError('The RAG assistant is not configured on this server', 503);
  }

  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  // nginx buffers proxied responses by default, which would hold the whole
  // answer until it's complete and defeat the point of streaming it.
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const writeEvent = (event) => res.write(`${JSON.stringify(event)}\n`);

  try {
    for await (const event of ragService.streamAnswer(question, { languagePlatform })) {
      writeEvent(event);
    }
    writeEvent({ type: 'done' });
  } catch (err) {
    // Headers are already sent at this point, so this has to be an in-band
    // event rather than an HTTP error status — see the frontend's rag.service.ts.
    console.error('[ragController.ask] generation failed:', err.message);
    writeEvent({ type: 'error', message: 'The assistant hit an error generating a response. Please try again.' });
  } finally {
    res.end();
  }
});

// Admin-triggered full rebuild of the search index — useful after a bulk
// content import that bypassed topicController's per-write reindex hooks.
exports.reindex = asyncHandler(async (req, res) => {
  const result = await ragIndexService.reindexAll();
  res.json({ success: true, message: 'RAG index rebuilt', data: result });
});
