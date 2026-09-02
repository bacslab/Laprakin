import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

async function availablePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function createClient(base, device) {
  const cookies = new Map();
  let csrf = '';
  let latestSetCookies = [];

  function headers(extra = {}, includeCsrf = true) {
    return {
      'x-laprakin-device': device,
      ...(cookies.size ? { cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; ') } : {}),
      ...(includeCsrf && csrf ? { 'x-laprakin-csrf': csrf } : {}),
      ...extra,
    };
  }

  async function raw(endpoint, options = {}) {
    const { skipCsrf = false, ...fetchOptions } = options;
    const response = await fetch(`${base}/api${endpoint}`, {
      ...fetchOptions,
      headers: headers({
        ...(fetchOptions.body && !(fetchOptions.body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
        ...(fetchOptions.headers || {}),
      }, !skipCsrf),
    });
    const setCookies = response.headers.getSetCookie?.() || [response.headers.get('set-cookie')].filter(Boolean);
    if (setCookies.length) latestSetCookies = setCookies;
    for (const setCookie of setCookies) {
      const [nameValue] = setCookie.split(';');
      const separator = nameValue.indexOf('=');
      if (separator > 0) cookies.set(nameValue.slice(0, separator), nameValue.slice(separator + 1));
    }
    const contentType = response.headers.get('content-type') || '';
    const payload = response.status === 204
      ? null
      : contentType.includes('application/json')
        ? await response.json()
        : await response.text();
    if (payload?.csrfToken) csrf = payload.csrfToken;
    return { status: response.status, payload };
  }

  async function request(endpoint, options = {}, expectedStatus = 200) {
    const result = await raw(endpoint, options);
    assert.equal(
      result.status,
      expectedStatus,
      result.payload?.error?.message || `${options.method || 'GET'} ${endpoint}`,
    );
    return result.payload;
  }

  return {
    raw,
    request,
    sessionCookies: () => [...latestSetCookies],
    async registerAndVerify(email) {
      const registration = await request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password: 'KataSandi-Uji-2026' }),
      }, 201);
      await request('/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ token: registration.developmentVerificationToken }),
      });
      const session = await request('/auth/me');
      csrf = session.csrfToken;
      return session.user;
    },
  };
}

function publicError(result) {
  return {
    status: result.status,
    code: result.payload?.error?.code,
    message: result.payload?.error?.message,
  };
}

async function assertHidden(client, foreignEndpoint, missingEndpoint, options = {}) {
  const foreign = await client.raw(foreignEndpoint, options);
  const missing = await client.raw(missingEndpoint, options);
  assert.equal(foreign.status, 404, `${options.method || 'GET'} ${foreignEndpoint} harus tersembunyi`);
  assert.deepEqual(publicError(foreign), publicError(missing), `${foreignEndpoint} membocorkan keberadaan resource`);
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill();
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

test('authorization boundaries isolate two users, admin routes, and CSRF mutations', { timeout: 120_000 }, async () => {
  const root = path.resolve(import.meta.dirname, '../..');
  const sandbox = await mkdtemp(path.join(os.tmpdir(), 'laprakin-authorization-'));
  const port = await availablePort();
  const base = `http://127.0.0.1:${port}`;
  const unique = `${Date.now()}-${randomUUID()}`;
  const adminEmail = `admin-${unique}@example.test`;
  const child = spawn(process.execPath, ['server/src/index.js'], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(port),
      APP_URL: 'http://localhost:5173',
      API_URL: base,
      ALLOWED_ORIGINS: 'http://localhost:5173',
      ADMIN_EMAIL: adminEmail,
      NARAROUTER_API_KEY: '',
      AI_REQUIRED: 'false',
      LAPRAKIN_DATA_DIR: path.join(sandbox, 'data'),
      LAPRAKIN_UPLOAD_DIR: path.join(sandbox, 'uploads'),
      LAPRAKIN_PUBLIC_MEDIA_DIR: path.join(sandbox, 'public-media'),
      EMAIL_MODE: 'console',
      MANUAL_EMAIL_AUTH_ONLY: 'true',
      JWT_SECRET: 'authorization-test-jwt-secret-2026-unique',
      DEVICE_HMAC_SECRET: 'authorization-test-device-secret-2026-unique',
      TOKEN_HMAC_SECRET: 'authorization-test-token-secret-2026-unique',
      SESSION_DAYS: '30',
      ADMIN_SESSION_HOURS: '8',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let logs = '';
  let testDb = null;
  child.stdout.on('data', (chunk) => { logs = `${logs}${chunk}`.slice(-20_000); });
  child.stderr.on('data', (chunk) => { logs = `${logs}${chunk}`.slice(-20_000); });

  try {
    const startedAt = Date.now();
    let ready = false;
    while (Date.now() - startedAt < 30_000) {
      try {
        if ((await fetch(`${base}/api/health`)).ok) {
          ready = true;
          break;
        }
      } catch { /* Server is still starting. */ }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    assert.equal(ready, true, `API gagal start:\n${logs}`);

    const userAClient = createClient(base, `authorization-a-${unique}`);
    const userBClient = createClient(base, `authorization-b-${unique}`);
    const adminClient = createClient(base, `authorization-admin-${unique}`);
    const userA = await userAClient.registerAndVerify(`student-a-${unique}@example.test`);
    const userB = await userBClient.registerAndVerify(`student-b-${unique}@example.test`);
    const admin = await adminClient.registerAndVerify(adminEmail);
    assert.equal(userA.role, 'student');
    assert.equal(userB.role, 'student');
    assert.equal(admin.role, 'admin');
    assert.match(userAClient.sessionCookies().join('\n'), /Max-Age=2592000/i);
    assert.match(adminClient.sessionCookies().join('\n'), /Max-Age=28800/i);

    const documentPayload = {
      title: 'Dokumen privat User A',
      courseName: 'Keamanan Aplikasi',
      moduleTitle: 'Authorization Boundary',
      lecturerName: 'Dosen Penguji',
      academicYear: '2026/2027',
      documentProfile: 'langkah',
      priority: 'normal',
      recipe: { allowExternalAi: false },
    };
    const document = await userAClient.request('/documents', {
      method: 'POST',
      body: JSON.stringify(documentPayload),
    }, 201);
    const restorableDocument = await userAClient.request('/documents', {
      method: 'POST',
      body: JSON.stringify({ ...documentPayload, title: 'Dokumen untuk restore' }),
    }, 201);
    const conversation = await userAClient.request('/chat/sessions', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Chat privat User A',
        configuration: { courseName: 'Keamanan Aplikasi', moduleTitle: 'IDOR' },
      }),
    }, 201);
    const chatId = conversation.session.id;

    const uploadDirectory = path.join(sandbox, 'uploads', userA.id, document.id, 'source');
    await mkdir(uploadDirectory, { recursive: true });
    const filePath = path.join(uploadDirectory, 'private-a.txt');
    const attachmentPath = path.join(uploadDirectory, 'private-chat-a.txt');
    const exportPath = path.join(uploadDirectory, 'private-export-a.docx');
    await writeFile(filePath, 'private file owned by user A');
    await writeFile(attachmentPath, 'private chat attachment owned by user A');
    await writeFile(exportPath, 'private export owned by user A');

    testDb = new DatabaseSync(path.join(sandbox, 'data', 'laprakin.sqlite'));
    testDb.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    const timestamp = new Date().toISOString();
    const fileId = randomUUID();
    const attachmentId = randomUUID();
    const jobId = randomUUID();
    const versionId = randomUUID();
    const quizId = randomUUID();
    const attemptId = randomUUID();
    const exportId = randomUUID();
    testDb.prepare(`
      INSERT INTO document_files (
        id, document_id, owner_user_id, category, original_name, storage_name,
        storage_path, mime_type, size_bytes, source_declaration, is_extracted, created_at
      ) VALUES (?, ?, ?, 'evidence', 'private-a.txt', 'private-a.txt', ?, 'text/plain', 28, 'own', 0, ?)
    `).run(fileId, document.id, userA.id, filePath, timestamp);
    testDb.prepare(`
      INSERT INTO chat_attachments (
        id, session_id, owner_user_id, kind, original_name, storage_name,
        storage_path, mime_type, detected_mime, size_bytes, sha256, created_at
      ) VALUES (?, ?, ?, 'evidence', 'private-chat-a.txt', 'private-chat-a.txt', ?, 'text/plain', 'text/plain', 39, ?, ?)
    `).run(attachmentId, chatId, userA.id, attachmentPath, randomUUID().replaceAll('-', ''), timestamp);
    testDb.prepare(`
      INSERT INTO jobs (
        id, document_id, owner_user_id, job_type, status, progress, message, result_json, created_at, finished_at
      ) VALUES (?, ?, ?, 'scan', 'completed', 100, 'Selesai', '{}', ?, ?)
    `).run(jobId, document.id, userA.id, timestamp, timestamp);
    testDb.prepare(`
      INSERT INTO document_versions (id, document_id, owner_user_id, label, snapshot_json, created_at)
      VALUES (?, ?, ?, 'Versi privat A', '{"sections":[{"id":"private-section-a"}]}', ?)
    `).run(versionId, document.id, userA.id, timestamp);
    testDb.prepare(`
      INSERT INTO document_quizzes (
        id, document_id, owner_user_id, content_signature, questions_json,
        question_count, pass_score, created_at, updated_at
      ) VALUES (?, ?, ?, 'signature-a', ?, 1, 70, ?, ?)
    `).run(quizId, document.id, userA.id, JSON.stringify([{
      id: 'question-a',
      prompt: 'Siapa pemilik dokumen ini?',
      options: ['User A', 'User B', 'Admin', 'Publik'],
      correctIndex: 0,
      explanation: 'Dokumen dimiliki User A.',
    }]), timestamp, timestamp);
    testDb.prepare(`
      INSERT INTO quiz_attempts (
        id, quiz_id, document_id, owner_user_id, content_signature,
        question_ids_json, answers_json, passed, created_at
      ) VALUES (?, ?, ?, ?, 'signature-a', '["question-a"]', '[]', 0, ?)
    `).run(attemptId, quizId, document.id, userA.id, timestamp);
    testDb.prepare(`
      INSERT INTO exports (
        id, document_id, owner_user_id, storage_path, file_name, status, review_mode, created_at
      ) VALUES (?, ?, ?, ?, 'private-export-a.docx', 'ready', 'reviewed', ?)
    `).run(exportId, document.id, userA.id, exportPath, timestamp);
    testDb.prepare(`
      INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, metadata_json, created_at)
      VALUES (?, ?, 'document.viewed', 'document', ?, '{}', ?)
    `).run(randomUUID(), userA.id, document.id, timestamp);

    const ownDocument = await userAClient.request(`/documents/${document.id}`);
    assert.equal(ownDocument.id, document.id);
    assert.equal(await userAClient.request(`/files/${fileId}/download`), 'private file owned by user A');
    assert.equal((await userAClient.request(`/chat/sessions/${chatId}`)).session.id, chatId);
    assert.equal((await userAClient.request(`/jobs/${jobId}`)).id, jobId);
    assert.ok((await userAClient.request(`/documents/${document.id}/versions`)).versions.some((item) => item.id === versionId));
    assert.ok((await userAClient.request(`/documents/${document.id}/activity`)).activity.some((item) => item.target_id === document.id));

    const updatePayload = { ...documentPayload, title: 'Judul yang tidak boleh berubah' };
    const quizAnswers = { answers: [{ questionId: 'question-a', selectedIndex: 0 }] };
    const missingDocumentId = randomUUID();
    const missingResourceId = randomUUID();
    const outsiders = [userBClient, adminClient];
    for (const outsider of outsiders) {
      await assertHidden(outsider, `/documents/${document.id}`, `/documents/${missingDocumentId}`);
      await assertHidden(outsider, `/documents/${document.id}`, `/documents/${missingDocumentId}`, {
        method: 'PUT', body: JSON.stringify(updatePayload),
      });
      await assertHidden(outsider, `/documents/${document.id}`, `/documents/${missingDocumentId}`, { method: 'DELETE' });
      await assertHidden(outsider, `/documents/${document.id}/export`, `/documents/${missingDocumentId}/export`, {
        method: 'POST', body: JSON.stringify({ confirmReviewed: true }),
      });
      await assertHidden(outsider, `/files/${fileId}/download`, `/files/${missingResourceId}/download`);
      await assertHidden(outsider, `/chat/sessions/${chatId}`, `/chat/sessions/${missingResourceId}`);
      await assertHidden(outsider, `/chat/attachments/${attachmentId}/file`, `/chat/attachments/${missingResourceId}/file`);
      await assertHidden(outsider, `/jobs/${jobId}`, `/jobs/${missingResourceId}`);
      await assertHidden(outsider, `/documents/${document.id}/jobs`, `/documents/${missingDocumentId}/jobs`);
      await assertHidden(outsider, `/documents/${document.id}/quiz`, `/documents/${missingDocumentId}/quiz`, {
        method: 'POST', body: '{}',
      });
      await assertHidden(outsider, `/documents/${document.id}/quiz/attempts/${attemptId}`, `/documents/${missingDocumentId}/quiz/attempts/${attemptId}`, {
        method: 'POST', body: JSON.stringify(quizAnswers),
      });
      await assertHidden(outsider, `/documents/${document.id}/versions`, `/documents/${missingDocumentId}/versions`);
      await assertHidden(outsider, `/documents/${document.id}/versions/${versionId}/restore`, `/documents/${missingDocumentId}/versions/${versionId}/restore`, {
        method: 'POST', body: '{}',
      });
      await assertHidden(outsider, `/documents/${document.id}/activity`, `/documents/${missingDocumentId}/activity`);
      await assertHidden(outsider, `/exports/${exportId}/download`, `/exports/${missingResourceId}/download`);
    }

    const documentAfterAttacks = await userAClient.request(`/documents/${document.id}`);
    assert.equal(documentAfterAttacks.title, documentPayload.title);
    const missingCsrf = await userAClient.raw(`/documents/${document.id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...documentPayload, title: 'CSRF tidak boleh lolos' }),
      skipCsrf: true,
    });
    assert.deepEqual(publicError(missingCsrf), {
      status: 403,
      code: 'CSRF_INVALID',
      message: 'Sesi keamanan perlu diperbarui. Muat ulang halaman lalu coba lagi.',
    });
    const successfulUpdate = await userAClient.request(`/documents/${document.id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...documentPayload, title: 'Dokumen privat User A diperbarui' }),
    });
    assert.equal(successfulUpdate.title, 'Dokumen privat User A diperbarui');

    await userAClient.request(`/documents/${restorableDocument.id}`, { method: 'DELETE' }, 204);
    for (const outsider of outsiders) {
      await assertHidden(outsider, `/documents/${restorableDocument.id}/restore`, `/documents/${missingDocumentId}/restore`, {
        method: 'POST', body: '{}',
      });
    }
    assert.equal((await userAClient.request(`/documents/${restorableDocument.id}/restore`, { method: 'POST', body: '{}' })).id, restorableDocument.id);

    const studentAdminRead = await userAClient.raw('/admin/overview');
    assert.equal(studentAdminRead.status, 403);
    assert.equal(studentAdminRead.payload?.error?.code, 'ADMIN_CAPABILITY_REQUIRED');
    const studentAdminMutation = await userAClient.raw(`/admin/users/${userB.id}/plan`, {
      method: 'PUT',
      body: JSON.stringify({ planKey: 'free', durationDays: 30 }),
    });
    assert.equal(studentAdminMutation.status, 403);
    assert.equal(studentAdminMutation.payload?.error?.code, 'ADMIN_CAPABILITY_REQUIRED');
    await adminClient.request('/admin/overview');

    const serverSource = await readFile(path.join(root, 'server/src/index.js'), 'utf8');
    const adminRoutes = [...serverSource.matchAll(/app\.(?:get|post|put|patch|delete)\(\s*['"](\/api\/admin[^'"]*)['"]/g)];
    assert.ok(adminRoutes.length >= 20, 'Inventaris endpoint admin tidak ditemukan.');
    for (const route of adminRoutes) {
      const declarationEnd = serverSource.indexOf('\n', route.index);
      const declaration = serverSource.slice(route.index, declarationEnd === -1 ? undefined : declarationEnd);
      assert.match(declaration, /requireCapability|requirePrivilegedUser/, `${route[1]} wajib memakai capability server-side`);
    }

    const adminMutations = [...serverSource.matchAll(/app\.(?:post|put|patch|delete)\(\s*['"](\/api\/admin[^'"]*)['"]/g)];
    for (const route of adminMutations) {
      const nextRoute = serverSource.indexOf('\napp.', route.index + 1);
      const handler = serverSource.slice(route.index, nextRoute === -1 ? undefined : nextRoute);
      assert.match(handler, /requireCsrf/, `${route[1]} wajib memakai requireCsrf`);
      assert.match(handler, /\baudit\(/, `${route[1]} wajib mencatat perubahan pada audit log`);
    }

    const configSource = await readFile(path.join(root, 'server/src/config.js'), 'utf8');
    assert.match(configSource, /adminEmail:\s*\(process\.env\.ADMIN_EMAIL \|\| ''\)/);
    assert.doesNotMatch(configSource, /adminEmail:[^\n]+@[a-z0-9.-]+/i);

    await userAClient.request('/me', {
      method: 'DELETE',
      body: JSON.stringify({ confirmation: userA.email }),
    }, 204);
    assert.ok(testDb.prepare('SELECT deleted_at FROM document_files WHERE id = ?').get(fileId)?.deleted_at);
    assert.ok(testDb.prepare('SELECT deleted_at FROM chat_attachments WHERE id = ?').get(attachmentId)?.deleted_at);

    const expiredDeletion = '2000-01-01T00:00:00.000Z';
    testDb.prepare('UPDATE documents SET deleted_at = ? WHERE owner_user_id = ?').run(expiredDeletion, userA.id);
    testDb.prepare('UPDATE document_files SET deleted_at = ? WHERE owner_user_id = ?').run(expiredDeletion, userA.id);
    testDb.prepare('UPDATE chat_attachments SET deleted_at = ? WHERE owner_user_id = ?').run(expiredDeletion, userA.id);
    const cleanupResponse = await adminClient.raw('/admin/retention/run', { method: 'POST', body: '{}' });
    assert.equal(cleanupResponse.status, 200, `${JSON.stringify(cleanupResponse.payload)}\n${logs}`);
    const cleanup = cleanupResponse.payload;
    assert.ok(cleanup.purgedFiles >= 1);
    assert.ok(cleanup.purgedChatAttachments >= 1);
    await assert.rejects(access(filePath), { code: 'ENOENT' });
    await assert.rejects(access(attachmentPath), { code: 'ENOENT' });
    await assert.rejects(access(exportPath), { code: 'ENOENT' });

    const workflow = await readFile(path.join(root, '.github/workflows/test.yml'), 'utf8');
    const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
    assert.match(workflow, /- run: npm test/);
    assert.match(packageJson.scripts.test, /server\/test\/\*\.test\.mjs/);
  } finally {
    testDb?.close();
    await stopServer(child);
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        await rm(sandbox, { recursive: true, force: true });
        break;
      } catch (error) {
        if (error?.code !== 'EBUSY' || attempt === 5) throw error;
        await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
      }
    }
  }
});
