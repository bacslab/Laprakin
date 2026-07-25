import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

async function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

const root = path.resolve(import.meta.dirname, '..');
const sandbox = await mkdtemp(path.join(os.tmpdir(), 'laprakin-workflow-'));
const port = await availablePort();
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['server/src/index.js'], {
  cwd: root,
  env: {
    ...process.env,
    NODE_ENV: 'development',
    PORT: String(port),
    APP_URL: 'http://localhost:5173',
    API_URL: base,
    ALLOWED_ORIGINS: 'http://localhost:5173',
    GEMINI_API_KEY: '',
    LAPRAKIN_DATA_DIR: path.join(sandbox, 'data'),
    LAPRAKIN_UPLOAD_DIR: path.join(sandbox, 'uploads'),
    JOB_POLL_MS: '100',
    EMAIL_MODE: 'console',
    MANUAL_EMAIL_AUTH_ONLY: 'true',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let logs = '';
let testDb = null;
server.stdout.on('data', (chunk) => { logs += chunk; });
server.stderr.on('data', (chunk) => { logs += chunk; });

const cookies = new Map();
let csrf = '';
const device = `workflow-${Date.now()}`;

async function request(endpoint, options = {}, expectedStatus = 200) {
  const response = await fetch(`${base}/api${endpoint}`, {
    ...options,
    headers: {
      'x-laprakin-device': device,
      ...(cookies.size ? { cookie: [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join('; ') } : {}),
      ...(csrf ? { 'x-laprakin-csrf': csrf } : {}),
      ...(options.body && !(options.body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const setCookies = response.headers.getSetCookie?.() || [response.headers.get('set-cookie')].filter(Boolean);
  setCookies.forEach((setCookie) => {
    const [nameValue] = setCookie.split(';');
    const separator = nameValue.indexOf('=');
    if (separator > 0) cookies.set(nameValue.slice(0, separator), nameValue.slice(separator + 1));
  });
  const payload = await response.json();
  assert.equal(response.status, expectedStatus, payload?.error?.message || `${options.method || 'GET'} ${endpoint}`);
  return payload;
}

async function uploadChatFile(sessionId, { kind, name, type, content, finalize = true }) {
  const form = new FormData();
  form.append('kind', kind);
  form.append('finalize', String(finalize));
  form.append('files', new Blob([content], { type }), name);
  return request(`/chat/sessions/${sessionId}/attachments`, {
    method: 'POST',
    body: form,
  }, 201);
}

try {
  const started = Date.now();
  let serverReady = false;
  while (Date.now() - started < 30000) {
    try {
      const health = await fetch(`${base}/api/health`);
      if (health.ok) {
        serverReady = true;
        break;
      }
    } catch { /* server is still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  assert.equal(serverReady, true, `API gagal start:\n${logs}`);

  const email = `workflow-${Date.now()}@example.test`;
  const registration = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'KataSandi-Uji-2026' }),
  }, 201);
  const blockedSecondRegistration = await request('/auth/register', {
    method: 'POST',
    headers: {
      'x-laprakin-device': `changed-${device}`,
      'x-forwarded-for': '203.0.113.42',
    },
    body: JSON.stringify({ email: `second-${Date.now()}@example.test`, password: 'KataSandi-Uji-2026' }),
  }, 409);
  assert.equal(blockedSecondRegistration.error.code, 'DEVICE_REGISTRATION_LIMIT');

  const raceBootstrap = await fetch(`${base}/api/health`, {
    headers: {
      'x-laprakin-device': `race-${device}`,
      'x-laprakin-client-profile': `race-${device}`,
    },
  });
  const raceDeviceCookie = (raceBootstrap.headers.getSetCookie?.() || [raceBootstrap.headers.get('set-cookie')].filter(Boolean))
    .map((value) => value.split(';')[0])
    .find((value) => value.startsWith('laprakin_device='));
  assert.ok(raceDeviceCookie, 'Cookie perangkat server wajib diterbitkan.');
  const raceRequests = await Promise.all([
    `race-a-${Date.now()}@example.test`,
    `race-b-${Date.now()}@example.test`,
  ].map((raceEmail) => fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: {
      cookie: raceDeviceCookie,
      'content-type': 'application/json',
      'x-laprakin-device': `race-${device}`,
      'x-laprakin-client-profile': `race-${device}`,
    },
    body: JSON.stringify({ email: raceEmail, password: 'KataSandi-Uji-2026' }),
  })));
  assert.deepEqual(raceRequests.map((response) => response.status).sort(), [201, 409]);
  const raceRejection = await raceRequests.find((response) => response.status === 409).json();
  assert.equal(raceRejection.error.code, 'DEVICE_REGISTRATION_LIMIT');

  const meta = await request('/meta');
  assert.equal(meta.features.googleLoginEnabled, false);
  const rejectedLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'KataSandi-Uji-2026' }),
  }, 403);
  assert.equal(rejectedLogin.error.code, 'EMAIL_NOT_VERIFIED');
  const verification = await request('/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ token: registration.developmentVerificationToken }),
  });
  csrf = verification.csrfToken;
  const reusedVerification = await request('/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ token: registration.developmentVerificationToken }),
  }, 400);
  assert.equal(reusedVerification.error.code, 'INVALID_VERIFICATION_TOKEN');

  await request('/profile', {
    method: 'PUT',
    body: JSON.stringify({
      fullName: 'Asep Saputra',
      nickname: 'Asep',
      nim: '2300001',
      className: 'TI-2A',
      departmentKey: 'jkb',
      studyProgramKey: 'ti',
    }),
  });
  await request('/profile', {
    method: 'PUT',
    body: JSON.stringify({ fullName: 'Asep Saputra Updated' }),
  });
  const profile = await request('/auth/me');
  csrf = profile.csrfToken;
  assert.equal(profile.wallet.balances.total, 2);
  assert.equal(profile.user.nickname, 'Asep');
  const rejectedNickname = await request('/profile', {
    method: 'PUT',
    body: JSON.stringify({ nickname: 'NamaPanggilanTerlaluPanjang' }),
  }, 400);
  assert.equal(rejectedNickname.error.code, 'VALIDATION_ERROR');
  assert.equal(profile.user.fullName, 'Asep Saputra Updated');
  assert.equal(profile.user.nim, '2300001');
  assert.equal(profile.user.className, 'TI-2A');
  assert.equal(profile.user.studyProgramKey, 'ti');
  assert.equal(profile.user.onboardingDismissed, false);
  await request('/projects/pins', {
    method: 'POST',
    body: JSON.stringify({
      projectName: 'Jaringan Komputer',
      projectKey: 'jaringan komputer',
      pinned: true,
    }),
  });
  const pinnedProjects = await request('/projects/pins');
  assert.equal(pinnedProjects.pins.length, 1);
  assert.equal(pinnedProjects.pins[0].projectName, 'Jaringan Komputer');
  await request('/projects/pins', {
    method: 'POST',
    body: JSON.stringify({
      projectName: 'Jaringan Komputer',
      projectKey: 'jaringan komputer',
      pinned: false,
    }),
  });
  assert.equal((await request('/projects/pins')).pins.length, 0);
  const onboarding = await request('/profile/onboarding', {
    method: 'POST',
    body: JSON.stringify({ dismissed: true }),
  });
  assert.equal(onboarding.user.onboardingDismissed, true);

  const chat = await request('/chat/sessions', {
    method: 'POST',
    body: JSON.stringify({ title: 'Laprak baru', configuration: { allowExternalAi: true } }),
  }, 201);
  assert.equal(chat.messages.length, 0);
  const result = await request(`/chat/sessions/${chat.session.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content: 'Asep', aiMode: 'basic', allowExternalAi: true }),
  });
  assert.equal(result.session.title, 'Laprak baru');
  assert.equal(result.workflow.state, 'CLARIFICATION_REQUIRED');
  assert.equal(result.workflow.canCreateDocument, false);
  assert.equal(result.workflow.workPlan.ready, false);
  assert.equal(result.workflow.workPlan.steps?.length || 0, 0);
  assert.equal((await request('/wallet')).balances.total, 1);

  const blocked = await request(`/chat/sessions/${chat.session.id}/document`, { method: 'POST', body: '{}' }, 422);
  assert.equal(blocked.error.code, 'CHAT_CONTEXT_INCOMPLETE');
  assert.match(blocked.error.message, /konteks belum cukup/i);

  const briefChat = await request('/chat/sessions', {
    method: 'POST',
    body: JSON.stringify({ title: 'Laprak baru', configuration: { allowExternalAi: true } }),
  }, 201);
  const briefResult = await request(`/chat/sessions/${briefChat.session.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      content: 'Buatkan saya laprak untuk mata kuliah Jaringan Komputer, dengan materi Static Routing.',
      aiMode: 'basic',
      allowExternalAi: true,
    }),
  });
  assert.equal(briefResult.session.configuration.courseName, 'Jaringan Komputer');
  assert.equal(briefResult.session.configuration.moduleTitle, 'Static Routing');
  assert.equal(briefResult.session.document_id, null);
  assert.equal(briefResult.workflow.state, 'READY_TO_GENERATE');
  assert.equal(briefResult.workflow.canCreateDocument, true);
  assert.equal(briefResult.workflow.canGenerateDraft, true);
  assert.equal(briefResult.session.title, 'Laprak Jaringan Komputer - Static Routing');
  assert.equal(briefResult.workflow.workPlan.ready, true);
  assert.ok(briefResult.workflow.workPlan.steps.length >= 4 && briefResult.workflow.workPlan.steps.length <= 7);
  assert.equal(new Set(briefResult.workflow.workPlan.steps.map((step) => step.title.toLowerCase())).size, briefResult.workflow.workPlan.steps.length);
  assert.equal((await request('/wallet')).balances.total, 0);

  const exhaustedChat = await request('/chat/sessions', {
    method: 'POST',
    body: JSON.stringify({ title: 'Laprak baru', configuration: { allowExternalAi: true } }),
  }, 201);
  const exhaustedForm = new FormData();
  exhaustedForm.append('kind', 'module');
  exhaustedForm.append('finalize', 'false');
  exhaustedForm.append('files', new Blob(['Bahan tidak boleh tersimpan.'], { type: 'text/plain' }), 'ditolak.txt');
  const blockedUpload = await request(`/chat/sessions/${exhaustedChat.session.id}/attachments`, {
    method: 'POST',
    body: exhaustedForm,
  }, 402);
  assert.equal(blockedUpload.error.code, 'INSUFFICIENT_CREDIT');
  const blockedMessage = await request(`/chat/sessions/${exhaustedChat.session.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content: 'Mata kuliah Sistem Operasi', aiMode: 'basic', allowExternalAi: true }),
  }, 402);
  assert.equal(blockedMessage.error.code, 'INSUFFICIENT_CREDIT');
  const exhaustedRefresh = await request(`/chat/sessions/${exhaustedChat.session.id}`);
  assert.equal(exhaustedRefresh.messages.length, 0);
  assert.equal(exhaustedRefresh.attachments.length, 0);

  const creditDb = new DatabaseSync(path.join(sandbox, 'data', 'laprakin.sqlite'));
  creditDb.prepare(`
    INSERT INTO wallet_entries (
      id, user_id, bucket, amount, reason, reference_type, reference_id,
      available_at, expires_at, created_at
    ) VALUES (?, ?, 'admin', 20, 'Credit lanjutan untuk pengujian', 'test', ?, NULL, NULL, ?)
  `).run(randomUUID(), profile.user.id, profile.user.id, new Date().toISOString());
  creditDb.close();

  const workingDocument = await request(`/chat/sessions/${briefChat.session.id}/document`, { method: 'POST', body: '{}' }, 201);
  assert.equal(workingDocument.document.course_name, 'Jaringan Komputer');
  assert.equal(workingDocument.document.module_title, 'Static Routing');
  assert.equal((await request('/wallet')).balances.total, 20);

  const genericChat = await request('/chat/sessions', {
    method: 'POST',
    body: JSON.stringify({ title: 'Laprak baru', configuration: { allowExternalAi: true } }),
  }, 201);
  const genericResult = await request(`/chat/sessions/${genericChat.session.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content: 'Buatkan laprak', aiMode: 'basic', allowExternalAi: true }),
  });
  assert.equal(genericResult.workflow.state, 'CLARIFICATION_REQUIRED');
  assert.equal(genericResult.workflow.clarificationCount, 1);
  const clarificationRefresh = await request(`/chat/sessions/${genericChat.session.id}`);
  assert.equal(clarificationRefresh.workflow.state, 'CLARIFICATION_REQUIRED');
  assert.equal(clarificationRefresh.workflow.clarificationCount, 1);
  const clarifyKey = `clarify-${randomUUID()}`;
  const clarified = await request(`/chat/sessions/${genericChat.session.id}/actions`, {
    method: 'POST',
    body: JSON.stringify({
      idempotencyKey: clarifyKey,
      type: 'SUBMIT_CLARIFICATION',
      payload: {
        documentType: 'lab_report',
        courseName: 'Basis Data',
        practiceTopic: 'Trigger',
      },
    }),
  });
  assert.equal(clarified.workflow.state, 'READY_TO_GENERATE');
  assert.equal(clarified.workflow.clarificationCount, 1);
  assert.equal(clarified.autoGenerate, true);
  assert.equal(clarified.session.title, 'Laprak Basis Data - Trigger');
  assert.equal(clarified.messages.filter((message) => message.role === 'user').length, 1);
  assert.equal(clarified.workflow.workPlan.ready, true);
  assert.notDeepEqual(
    clarified.workflow.workPlan.steps.map((step) => step.title),
    briefResult.workflow.workPlan.steps.map((step) => step.title),
  );

  const completeFilesChat = await request('/chat/sessions', {
    method: 'POST',
    body: JSON.stringify({ title: 'Laprak baru', configuration: { allowExternalAi: true } }),
  }, 201);
  await uploadChatFile(completeFilesChat.session.id, {
    kind: 'module',
    name: 'Modul Routing.txt',
    type: 'text/plain',
    content: 'Instruksi praktikum static routing dan langkah konfigurasi router.',
    finalize: false,
  });
  await uploadChatFile(completeFilesChat.session.id, {
    kind: 'practice_evidence',
    name: 'hasil-routing.png',
    type: 'image/png',
    content: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
    finalize: false,
  });
  const completeFilesResult = await request(`/chat/sessions/${completeFilesChat.session.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      content: 'Buatkan laprak untuk mata kuliah Jaringan Komputer, dengan materi Static Routing.',
      aiMode: 'basic',
      allowExternalAi: true,
    }),
  });
  assert.equal(completeFilesResult.workflow.state, 'READY_TO_GENERATE');
  assert.equal(completeFilesResult.workflow.clarificationCount, 0);
  assert.equal(completeFilesResult.workflow.sourceStatus.module, 'UPLOADED');
  assert.equal(completeFilesResult.workflow.sourceStatus.practiceEvidence, 'UPLOADED');
  assert.equal(completeFilesResult.autoGenerate, true);

  const moduleOnlyChat = await request('/chat/sessions', {
    method: 'POST',
    body: JSON.stringify({ title: 'Laprak baru', configuration: { allowExternalAi: true } }),
  }, 201);
  const moduleOnly = await uploadChatFile(moduleOnlyChat.session.id, {
    kind: 'module',
    name: 'Modul Basis Data.txt',
    type: 'text/plain',
    content: 'Materi trigger basis data.',
  });
  assert.equal(moduleOnly.workflow.state, 'CLARIFICATION_REQUIRED');
  assert.equal(moduleOnly.workflow.clarificationCount, 1);
  assert.equal(moduleOnly.attachments[0].processing_status, 'ready');
  const recategorized = await request(`/chat/sessions/${moduleOnlyChat.session.id}/attachments/${moduleOnly.attachments[0].id}`, {
    method: 'PATCH',
    body: JSON.stringify({ kind: 'instruction' }),
  });
  assert.equal(recategorized.attachments[0].kind, 'instruction');
  assert.equal(recategorized.workflow.sourceStatus.instruction, 'UPLOADED');

  const screenshotOnlyChat = await request('/chat/sessions', {
    method: 'POST',
    body: JSON.stringify({ title: 'Laprak baru', configuration: { allowExternalAi: true } }),
  }, 201);
  const screenshotOnly = await uploadChatFile(screenshotOnlyChat.session.id, {
    kind: 'practice_evidence',
    name: 'hasil-praktik.png',
    type: 'image/png',
    content: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
  });
  assert.equal(screenshotOnly.workflow.state, 'CLARIFICATION_REQUIRED');
  assert.equal(screenshotOnly.workflow.sourceStatus.practiceEvidence, 'UPLOADED');
  const screenshotClarified = await request(`/chat/sessions/${screenshotOnlyChat.session.id}/actions`, {
    method: 'POST',
    body: JSON.stringify({
      idempotencyKey: `screenshot-clarify-${randomUUID()}`,
      type: 'SUBMIT_CLARIFICATION',
      payload: { courseName: 'Sistem Operasi', practiceTopic: 'Manajemen Proses' },
    }),
  });
  assert.equal(screenshotClarified.workflow.state, 'READY_TO_GENERATE');
  assert.equal(screenshotClarified.workflow.clarificationCount, 1);

  const testStateDb = new DatabaseSync(path.join(sandbox, 'data', 'laprakin.sqlite'));
  const actionCount = testStateDb.prepare(`
    SELECT COUNT(*) AS count FROM chat_session_actions
    WHERE session_id = ? AND idempotency_key = ?
  `).get(genericChat.session.id, clarifyKey);
  assert.equal(Number(actionCount.count), 1);
  const briefCreditDebits = testStateDb.prepare(`
    SELECT COUNT(*) AS count FROM wallet_entries
    WHERE user_id = ? AND reference_type = 'chat_session' AND reference_id = ? AND amount = -1
  `).get(profile.user.id, briefChat.session.id);
  assert.equal(Number(briefCreditDebits.count), 1);
  testStateDb.close();

  testDb = new DatabaseSync(path.join(sandbox, 'data', 'laprakin.sqlite'));
  const timestamp = new Date().toISOString();
  const reportSections = [
    {
      type: 'implementation',
      title: '1. Analisis Implementasi',
      content: 'Router A dikonfigurasi dengan rute menuju jaringan 192.168.20.0/24 melalui next-hop 10.10.10.2 sesuai topologi pada modul. Tabel routing kemudian diperiksa untuk memastikan jaringan tujuan dan gateway telah tercatat dengan benar. Alamat antarmuka pada kedua router dicocokkan kembali sebelum pengujian dilakukan. Pemeriksaan ini mencegah hasil ping keliru akibat salah subnet atau gateway.',
    },
    {
      type: 'implementation',
      title: '1.1 Konfigurasi Jalur Balik',
      content: 'Router B ditambahkan rute menuju jaringan 192.168.10.0/24 melalui next-hop 10.10.10.1 agar paket balasan dapat kembali ke host asal. Entri rute balik terlihat pada tabel routing setelah konfigurasi disimpan. Default gateway host tujuan diarahkan ke antarmuka Router B yang berada pada jaringan lokal. Koneksi antarmuka antarrouter berstatus aktif sebelum ping dijalankan.',
    },
    {
      type: 'output',
      title: '2. Analisis Output',
      content: 'Pengujian ping dari host jaringan 192.168.10.0/24 menuju host jaringan 192.168.20.0/24 menghasilkan balasan sesuai bukti praktikum. Paket diteruskan melalui Router A ke Router B menggunakan next-hop yang sudah ditetapkan. Tidak ada pesan timeout pada output yang didokumentasikan dalam laporan. Hasil tersebut menunjukkan rute maju dan rute balik tersedia pada kedua router.',
    },
  ];
  const insertSection = testDb.prepare(`
    INSERT INTO report_sections (
      id, document_id, position, section_type, title, content, source, review_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'test', 'reviewed', ?, ?)
  `);
  reportSections.forEach((section, index) => insertSection.run(
    randomUUID(),
    workingDocument.document.id,
    index + 1,
    section.type,
    section.title,
    section.content,
    timestamp,
    timestamp,
  ));
  testDb.prepare(`UPDATE documents SET status = 'generated', generated_at = ?, updated_at = ? WHERE id = ?`)
    .run(timestamp, timestamp, workingDocument.document.id);

  const attempt = await request(`/documents/${workingDocument.document.id}/quiz`, { method: 'POST', body: '{}' }, 201);
  assert.equal(attempt.questionCount, 5);
  assert.equal(attempt.questions.length, 5);
  assert.equal('correctIndex' in attempt.questions[0], false);
  assert.equal('sourceQuote' in attempt.questions[0], false);
  const blockedExport = await request(`/documents/${workingDocument.document.id}/export`, {
    method: 'POST',
    body: JSON.stringify({ confirmReviewed: true }),
  }, 403);
  assert.equal(blockedExport.error.code, 'QUIZ_PASS_REQUIRED');

  const quizRow = testDb.prepare('SELECT * FROM document_quizzes WHERE document_id = ?').get(workingDocument.document.id);
  const pool = JSON.parse(quizRow.questions_json);
  const poolById = new Map(pool.map((question) => [question.id, question]));
  const answers = attempt.questions.map((question) => ({
    questionId: question.id,
    selectedIndex: poolById.get(question.id).correctIndex,
  }));
  const quizResult = await request(`/documents/${workingDocument.document.id}/quiz/attempts/${attempt.attemptId}`, {
    method: 'POST',
    body: JSON.stringify({ answers }),
  });
  assert.equal(quizResult.score, 100);
  assert.equal(quizResult.passed, true);
  const generatedDocument = await request(`/documents/${workingDocument.document.id}`);
  assert.equal(generatedDocument.quizAccess.passed, true);
  testDb.close();
  testDb = null;

  console.log('Workflow API passed: brief dipahami sekali, identitas tersimpan, dokumen preview memiliki quiz berbasis isi, dan download terkunci sampai nilai lulus.');
} finally {
  testDb?.close();
  server.kill();
  await new Promise((resolve) => server.once('exit', resolve));
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
