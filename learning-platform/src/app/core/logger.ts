// Logging that behaves differently in production.
//
// Two jobs:
//   1. Keep a short in-memory ring of recent failures, so an error handler can
//      report *what led up to* a crash rather than just the crash itself.
//   2. Stop the app narrating itself to anyone who opens the console in
//      production. Scattered console.log calls leak endpoint shapes, ids and
//      response payloads; silencing them there is the cheapest reduction of
//      what an attacker learns for free.
//
// Deliberately not an Angular service: the HTTP interceptors and the bootstrap
// catch in main.ts both need this, and one of those runs before the injector
// exists.

import { environment } from '../../environments/environment';

export interface LogEntry {
  at: string;
  level: 'error' | 'warn' | 'info';
  message: string;
  context?: unknown;
}

const MAX_ENTRIES = 50;
const entries: LogEntry[] = [];

/** The console methods as they were at load time, kept so silencing is reversible. */
const nativeConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  debug: console.debug.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console)
};

function record(level: LogEntry['level'], message: string, context?: unknown): void {
  entries.push({ at: new Date().toISOString(), level, message, context });
  // Bounded: an error loop (a failing poll, a retry storm) must not grow this
  // array until the tab runs out of memory.
  if (entries.length > MAX_ENTRIES) entries.shift();
}

export function logError(message: string, context?: unknown): void {
  record('error', message, context);
  // Errors stay visible even in production — they are what a user will be asked
  // to screenshot, and they carry no payload beyond what already failed.
  nativeConsole.error(`[error] ${message}`, context ?? '');
}

export function logWarn(message: string, context?: unknown): void {
  record('warn', message, context);
  if (!environment.production) nativeConsole.warn(`[warn] ${message}`, context ?? '');
}

export function logInfo(message: string, context?: unknown): void {
  record('info', message, context);
  if (!environment.production) nativeConsole.info(`[info] ${message}`, context ?? '');
}

/** Recent entries, newest last. Useful when reporting a crash. */
export function recentLogs(): LogEntry[] {
  return [...entries];
}

/**
 * Replaces the chatty console methods with no-ops in production builds.
 *
 * warn/error survive: a silent app is undiagnosable, and neither of those is
 * used to dump data in this codebase. The playground's own console capture is
 * unaffected — it swaps console.* itself for the duration of a run and restores
 * whatever it found, which by then is these no-ops.
 */
export function silenceConsoleInProduction(): void {
  if (!environment.production) return;
  const noop = () => undefined;
  console.log = noop;
  console.info = noop;
  console.debug = noop;
  console.table = noop as typeof console.table;
  console.dir = noop as typeof console.dir;
}

/** Escape hatch for debugging a production build locally. */
export function restoreConsole(): void {
  console.log = nativeConsole.log;
  console.info = nativeConsole.info;
  console.debug = nativeConsole.debug;
  console.warn = nativeConsole.warn;
  console.error = nativeConsole.error;
}
