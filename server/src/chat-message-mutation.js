import {
  beginMutation,
  completeMutation,
  failMutation,
  getMutationSnapshot,
  MutationRequestError,
} from './mutation-requests.js';

const OPERATION = 'chat.message';

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function awaitCanonicalMutation({ ownerUserId, requestId, timeoutMs, store }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const mutation = getMutationSnapshot({ ownerUserId, operation: OPERATION, requestId, store });
    if (!mutation) throw new MutationRequestError('Mutasi tidak ditemukan.', 'MUTATION_NOT_FOUND', 404);
    if (mutation.state === 'completed') return { statusCode: mutation.statusCode, response: mutation.response };
    if (mutation.state === 'retryable_failed') {
      throw new MutationRequestError('Mutasi dapat dicoba ulang dengan request ID yang sama.', mutation.errorCode || 'MUTATION_RETRYABLE', 409);
    }
    if (mutation.state === 'terminal_failed' || mutation.state === 'canceled') {
      throw new MutationRequestError('Mutasi tidak dapat dilanjutkan.', mutation.errorCode || 'MUTATION_TERMINAL', mutation.state === 'canceled' ? 410 : 422);
    }
    await sleep(25);
  }
  throw new MutationRequestError('Mutasi masih diproses.', 'MUTATION_IN_PROGRESS', 409);
}

export async function runCanonicalChatMutation({
  ownerUserId,
  requestId,
  input,
  execute,
  waitTimeoutMs = 30000,
  store,
}) {
  const acquisition = beginMutation({
    ownerUserId,
    operation: OPERATION,
    requestId,
    input,
    resourceType: 'chat_session',
    resourceId: input?.sessionId || '',
    store,
  });
  if (acquisition.disposition === 'replay') {
    return { statusCode: acquisition.mutation.statusCode, response: acquisition.mutation.response };
  }
  if (acquisition.disposition === 'in_progress') {
    return awaitCanonicalMutation({ ownerUserId, requestId, timeoutMs: waitTimeoutMs, store });
  }
  try {
    const result = await execute();
    completeMutation({
      ownerUserId,
      operation: OPERATION,
      requestId,
      statusCode: result.statusCode,
      response: result.response,
      resourceType: 'chat_session',
      resourceId: result.resourceId || input?.sessionId || '',
      configurationRevision: result.configurationRevision || '',
      providerId: result.providerId || '',
      modelId: result.modelId || '',
      promptTemplateRevision: result.promptTemplateRevision || '',
      store,
    });
    return { statusCode: result.statusCode, response: result.response };
  } catch (error) {
    failMutation({
      ownerUserId,
      operation: OPERATION,
      requestId,
      retryable: error?.retryable === true || Number(error?.status || 0) >= 500,
      canceled: error?.name === 'AbortError' && error?.reason !== 'timeout',
      errorCode: error?.code || error?.name || 'CHAT_MUTATION_FAILED',
      store,
    });
    throw error;
  }
}

export { OPERATION as CHAT_MESSAGE_OPERATION };
