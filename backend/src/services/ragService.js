// Retrieval-augmented generation over the platform's own Topic library.
//
// Retrieval: MongoDB's built-in $text index on RagChunk (see ragIndexService.js
// for how chunks are built). No vector DB, no embeddings API — the corpus is
// small and admin-authored, so keyword search is enough and adds zero infra.
// Generation: Google's Gemini API (free tier — no payment method required),
// grounded strictly in the retrieved chunks via the system instruction below,
// streamed back to the caller token-by-token.
const { GoogleGenAI, FinishReason } = require('@google/genai');
const RagChunk = require('../models/RagChunk');

const MODEL = 'gemini-3.6-flash';
const MAX_CHUNKS = 6;
const MAX_QUESTION_LENGTH = 500;

let client = null;

/** Lazily constructed so a missing key never crashes the module at require-time. */
function getClient() {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

function isConfigured() {
  return !!process.env.GEMINI_API_KEY;
}

async function retrieveChunks(question, { languagePlatform } = {}) {
  const filter = { $text: { $search: question } };
  if (languagePlatform) filter.languagePlatform = languagePlatform;

  return RagChunk.find(filter, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } })
    .limit(MAX_CHUNKS)
    .lean();
}

function chunkHeading(chunk) {
  return [chunk.topicTitle, chunk.subtopicTitle, chunk.subSubtopicTitle].filter(Boolean).join(' > ');
}

function formatContext(chunks) {
  if (!chunks.length) {
    return '(No matching content was found in the topic library for this question.)';
  }
  return chunks
    .map((chunk, i) => `[${i + 1}] ${chunkHeading(chunk)}\n${chunk.text}`)
    .join('\n\n---\n\n');
}

/** What the frontend needs to render "sources" links back into the content viewer. */
function citationsFor(chunks) {
  return chunks.map((chunk) => ({
    topicId: String(chunk.topic),
    subtopicId: String(chunk.subtopicId),
    title: chunkHeading(chunk),
    languagePlatform: chunk.languagePlatform
  }));
}

const SYSTEM_INSTRUCTION = `You are "Ask AI", the study assistant embedded in Primus Codex, a platform that teaches HTML, CSS, JavaScript, TypeScript, Angular, Node.js and RxJS.

Answer the learner's question using ONLY the <context> chunks provided in the user's message — each is a real excerpt from the platform's own topic library, numbered [1], [2], etc.

Rules:
- If the context does not contain enough information to answer, say so plainly and suggest what topic or search term to try instead. Never invent facts, APIs, or behavior not shown in the context.
- When you rely on a chunk, reference it inline like "(see [2])" so the learner can tell which excerpt backed which claim.
- Prefer short, practical, example-driven answers over long essays — the audience is learning to code.
- Format code with fenced code blocks and the correct language tag.`;

// finishReasons that mean "the model declined/was blocked", as opposed to a
// normal stop (STOP) or hitting the length cap (MAX_TOKENS, handled as a
// normal — if truncated — answer).
const REFUSAL_FINISH_REASONS = new Set([
  FinishReason.SAFETY,
  FinishReason.RECITATION,
  FinishReason.BLOCKLIST,
  FinishReason.PROHIBITED_CONTENT,
  FinishReason.SPII
]);

// The free tier's shared capacity occasionally returns a transient error
// mid-request ("high demand") — worth one retry rather than failing outright.
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 600;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Async generator yielding, in order:
 *   { type: 'citations', citations: [...] }  — once, before generation starts
 *   { type: 'delta', text }                  — zero or more, as Gemini writes
 *   { type: 'refusal' }                      — instead of further deltas, if blocked
 * Throws if the API key is missing, or generation fails before any text was
 * produced (the controller turns that into a single in-band error event).
 */
async function* streamAnswer(question, { languagePlatform } = {}) {
  const ai = getClient();
  if (!ai) {
    throw Object.assign(new Error('RAG assistant is not configured on this server'), { status: 503 });
  }

  const chunks = await retrieveChunks(question, { languagePlatform });
  yield { type: 'citations', citations: citationsFor(chunks) };

  const contents = `<context>\n${formatContext(chunks)}\n</context>\n\nQuestion: ${question}`;
  const config = { systemInstruction: SYSTEM_INSTRUCTION, maxOutputTokens: 2048 };

  let sawAnyOutput = false;
  let finishReason;
  let thrown = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    thrown = null;
    try {
      const stream = await ai.models.generateContentStream({ model: MODEL, contents, config });

      for await (const chunk of stream) {
        // Blocked before any candidate was produced (e.g. the whole prompt
        // tripped a safety filter) — promptFeedback is only ever set here.
        if (chunk.promptFeedback?.blockReason) {
          yield { type: 'refusal' };
          return;
        }
        if (chunk.text) {
          sawAnyOutput = true;
          yield { type: 'delta', text: chunk.text };
        }
        finishReason = chunk.candidates?.[0]?.finishReason ?? finishReason;
      }
      break; // finished cleanly — no retry needed
    } catch (err) {
      thrown = err;
      // Once real text has already reached the client, retrying would re-ask
      // the whole question from scratch and duplicate everything shown so
      // far — better to salvage the partial answer than retry mid-stream.
      if (sawAnyOutput) break;
      const retryable = RETRYABLE_STATUSES.has(err.status);
      if (!retryable || attempt === MAX_ATTEMPTS) break;
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }

  if (thrown) {
    if (sawAnyOutput) {
      yield { type: 'delta', text: '\n\n_(Response was interrupted — ask again if you\'d like the rest.)_' };
      return;
    }
    throw thrown;
  }

  if (finishReason && REFUSAL_FINISH_REASONS.has(finishReason) && !sawAnyOutput) {
    yield { type: 'refusal' };
  }
}

module.exports = { isConfigured, streamAnswer, retrieveChunks, MAX_QUESTION_LENGTH };
