import pino from 'pino';
import * as Sentry from '@sentry/node';
import { config } from './config.js';

export const REDACTED = '[REDACTED]';

const SENSITIVE_KEY = /(?:authorization|cookie|password|passwd|token|secret|api[_-]?key|content|document|prompt|body|raw|source|attachment|stack)/i;
const SAFE_ERROR_NAME = /^[A-Za-z][A-Za-z0-9_$.-]{0,80}$/;

function sanitize(value, key = '') {
  if (SENSITIVE_KEY.test(key)) return REDACTED;
  if (value instanceof Error) {
    return {
      name: SAFE_ERROR_NAME.test(value.name || '') ? value.name : 'Error',
      message: REDACTED,
      ...(typeof value.code === 'string' ? { code: value.code } : {}),
      ...(Number.isInteger(value.status) ? { status: value.status } : {}),
    };
  }
  if (Array.isArray(value)) return value.map((item) => sanitize(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [entryKey, sanitize(entryValue, entryKey)]));
  }
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'function' || typeof value === 'symbol') return String(value);
  return value;
}

export function serializeLog(fields = {}) {
  return sanitize(fields);
}

function wrapLogger(logger) {
  const emit = (level, fields, message) => {
    if (fields instanceof Error) {
      return logger[level](serializeLog({ error: fields }), message);
    }
    if (typeof fields === 'string' || fields === undefined) {
      return logger[level](fields ?? message);
    }
    return logger[level](serializeLog(fields), message);
  };

  return {
    info(fields, message) { return emit('info', fields, message); },
    warn(fields, message) { return emit('warn', fields, message); },
    error(fields, message) { return emit('error', fields, message); },
    child(fields) { return wrapLogger(logger.child(serializeLog(fields))); },
  };
}

export function createLogger({ level = 'info', destination = process.stdout } = {}) {
  const logger = pino({
    level,
    base: null,
    timestamp: pino.stdTimeFunctions.isoTime,
  }, destination);
  return wrapLogger(logger);
}

let initializedDsn = '';

function safeException(error) {
  const safe = new Error('Unhandled server exception');
  const name = String(error?.name || 'Error');
  safe.name = SAFE_ERROR_NAME.test(name) ? name : 'Error';
  return safe;
}

export function reportException(error, context = {}, options = {}) {
  const dsn = Object.prototype.hasOwnProperty.call(options, 'dsn')
    ? options.dsn
    : (config.sentryDsn || process.env.SENTRY_DSN || '');
  if (!dsn) return { reported: false, reason: 'SENTRY_NOT_CONFIGURED' };

  const sentry = options.sentry || Sentry;
  try {
    if (sentry.init && initializedDsn !== dsn) {
      sentry.init({ dsn, enabled: true, tracesSampleRate: 0 });
      initializedDsn = dsn;
    }
    const safeContext = serializeLog({
      ...context,
      errorCode: typeof error?.code === 'string' ? error.code : undefined,
      errorStatus: Number.isInteger(error?.status) ? error.status : undefined,
    });
    sentry.captureException(safeException(error), { context: safeContext });
    return { reported: true };
  } catch {
    return { reported: false, reason: 'SENTRY_REPORT_FAILED' };
  }
}

function dependencyState(value, configuredLabel = 'ok') {
  if (typeof value === 'object' && value !== null) return value.status || configuredLabel;
  return value ? configuredLabel : 'unavailable';
}

export function statusSnapshot({
  aiConfigured = false,
  aiReady = aiConfigured,
  database = true,
  worker = null,
  version = config.appVersion || process.env.npm_package_version || 'unknown',
} = {}) {
  const databaseState = dependencyState(database);
  const aiState = aiConfigured ? (aiReady ? 'ok' : 'unavailable') : 'not_configured';
  const checks = {
    database: databaseState,
    ai: aiState,
  };
  if (worker) checks.worker = dependencyState(worker);
  return {
    status: databaseState === 'ok' ? 'ok' : 'degraded',
    version,
    checks,
  };
}
