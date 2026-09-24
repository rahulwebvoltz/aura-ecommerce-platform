import type { Env } from './env.js';

export const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

type LogFields = Record<string, unknown>;

export interface Logger {
  trace(fields: LogFields, message?: string): void;
  debug(fields: LogFields, message?: string): void;
  info(fields: LogFields, message?: string): void;
  warn(fields: LogFields, message?: string): void;
  error(fields: LogFields, message?: string): void;
  fatal(fields: LogFields, message?: string): void;
  child(bindings: LogFields): Logger;
}

const REDACTED_KEYS = new Set([
  'authorization',
  'cookie',
  'password',
  'passwordHash',
  'refreshToken',
  'token',
  'accessToken',
]);

/** Serialises errors and removes secrets before a record is written. */
function sanitizeFields(fields: LogFields): LogFields {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      REDACTED_KEYS.has(key) ? '[redacted]' : sanitize(value),
    ]),
  );
}

function sanitize(value: unknown, depth = 0): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (depth > 4 || value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitize(entry, depth + 1));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      REDACTED_KEYS.has(key) ? '[redacted]' : sanitize(entry, depth + 1),
    ]),
  );
}

export type LogSink = (line: string, level: LogLevel) => void;

const defaultSink: LogSink = (line, level) => {
  if (level === 'error' || level === 'fatal') {
    process.stderr.write(`${line}\n`);
  } else {
    process.stdout.write(`${line}\n`);
  }
};

/** Minimal structured JSON logger: one line per record, secrets redacted. */
export function createLogger(
  env: Pick<Env, 'LOG_LEVEL' | 'NODE_ENV'>,
  sink: LogSink = defaultSink,
  bindings: LogFields = {},
): Logger {
  const minimum =
    env.NODE_ENV === 'test' || env.LOG_LEVEL === 'silent'
      ? LOG_LEVELS.length
      : LOG_LEVELS.indexOf(env.LOG_LEVEL);

  const write = (level: LogLevel) => (fields: LogFields, message?: string) => {
    if (LOG_LEVELS.indexOf(level) < minimum) {
      return;
    }

    const record = {
      level,
      time: new Date().toISOString(),
      ...(message === undefined ? {} : { msg: message }),
      ...sanitizeFields({ ...bindings, ...fields }),
    };
    sink(JSON.stringify(record), level);
  };

  return {
    trace: write('trace'),
    debug: write('debug'),
    info: write('info'),
    warn: write('warn'),
    error: write('error'),
    fatal: write('fatal'),
    child: (extra) => createLogger(env, sink, { ...bindings, ...extra }),
  };
}
