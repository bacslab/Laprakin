import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createLogger,
  reportException,
  serializeLog,
  statusSnapshot,
} from '../src/observability.js';

test('structured logs redact secrets and document content', () => {
  const record = serializeLog({
    token: 'secret',
    content: 'private report text',
    requestId: 'r1',
    status: 500,
  });

  assert.equal(record.token, '[REDACTED]');
  assert.equal(record.content, '[REDACTED]');
  assert.equal(record.requestId, 'r1');
  assert.equal(record.status, 500);
});

test('logger emits structured request fields through a child logger', () => {
  const chunks = [];
  const logger = createLogger({
    level: 'info',
    destination: { write: (chunk) => chunks.push(String(chunk)) },
  });

  logger.child({ requestId: 'r1', method: 'GET', route: '/api/status' }).info({
    status: 200,
    durationMs: 12,
    actorClass: 'anonymous',
  }, 'request completed');

  const record = JSON.parse(chunks.join('').trim());
  assert.equal(record.requestId, 'r1');
  assert.equal(record.status, 200);
  assert.equal(record.durationMs, 12);
  assert.equal(record.msg, 'request completed');
});

test('statusSnapshot reports liveness even when AI is not configured', () => {
  const snapshot = statusSnapshot({ aiConfigured: false, database: true });

  assert.equal(snapshot.status, 'ok');
  assert.equal(snapshot.checks.database, 'ok');
  assert.equal(snapshot.checks.ai, 'not_configured');
  assert.ok(snapshot.version);
});

test('reportException is DSN-gated and does not call Sentry without a DSN', () => {
  let captured = false;
  const result = reportException(new Error('secret token private report'), {
    token: 'secret',
    content: 'private report text',
  }, {
    sentry: { captureException: () => { captured = true; } },
    dsn: '',
  });

  assert.equal(result.reported, false);
  assert.equal(result.reason, 'SENTRY_NOT_CONFIGURED');
  assert.equal(captured, false);
});

test('reportException sends only redacted context when a DSN is configured', () => {
  let capturedError;
  let capturedContext;
  const sentry = {
    captureException: (error, context) => {
      capturedError = error;
      capturedContext = context;
    },
  };

  const result = reportException(new Error('secret token private report'), {
    token: 'secret',
    content: 'private report text',
    requestId: 'r2',
  }, { sentry, dsn: 'https://example.invalid/123' });

  assert.equal(result.reported, true);
  assert.equal(capturedError.message, 'Unhandled server exception');
  assert.equal(capturedContext.context.requestId, 'r2');
  assert.equal(capturedContext.context.token, '[REDACTED]');
  assert.equal(capturedContext.context.content, '[REDACTED]');
});
