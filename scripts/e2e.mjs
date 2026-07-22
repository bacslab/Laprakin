import assert from 'node:assert/strict';
import AdmZip from 'adm-zip';
import { reportSectionIssues } from '../server/src/report-quality.js';

const base = process.env.E2E_BASE_URL || 'http://localhost:4000';
const device = `e2e-${Date.now()}-${Math.random().toString(16).slice(2)}`;
let cookie = '';
let csrf = '';

function headers(extra = {}) {
  return { 'x-laprakin-device': device, ...(cookie ? { cookie } : {}), ...(csrf ? { 'x-laprakin-csrf': csrf } : {}), ...extra };
}

async function request(path, options = {}) {
  const response = await fetch(`${base}/api${path}`, { ...options, headers: headers(options.headers) });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const type = response.headers.get('content-type') || '';
  const payload = type.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = payload?.error?.message || payload || `${response.status}`;
    throw new Error(`${options.method || 'GET'} ${path}: ${message}`);
  }
  return payload;
}

async function waitForJob(id, timeoutMs = 120000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const job = await request(`/jobs/${id}`);
    if (['completed', 'failed', 'canceled'].includes(job.status)) return job;
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw new Error(`Job ${id} timeout`);
}

const health = await fetch(`${base}/api/health`);
assert.equal(health.ok, true, 'API health harus aktif sebelum e2e test.');

const email = `e2e-${Date.now()}@example.test`;
const password = 'KataSandi-Uji-2026';
const registered = await request('/auth/register', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
assert.ok(registered.developmentVerificationToken, 'E2E butuh NODE_ENV=development / EMAIL_MODE=console.');

const verified = await request('/auth/verify', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ token: registered.developmentVerificationToken }),
});
csrf = verified.csrfToken;
assert.equal(verified.user.emailVerified, true);

await request('/wallet/claim-welcome', { method: 'POST' });
await request('/profile', {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ fullName: 'User E2E', nim: '2400000000', className: 'TI-2A', departmentKey: 'jkb', studyProgramKey: 'ti' }),
});

const document = await request('/documents', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    title: 'Laporan E2E Routing',
    courseName: 'Manajemen Internetworking',
    moduleTitle: 'Routing Dasar',
    lecturerName: 'Dosen Uji',
    academicYear: '2025/2026',
    documentProfile: 'langkah',
    deadlineAt: new Date(Date.now() + 3 * 86400000).toISOString(),
    priority: 'high',
    recipe: { includeImplementation: true, includeOutput: true, allowExternalAi: true, instructions: 'Gunakan modul, parameter jaringan, dan bukti ping. Jelaskan setiap langkah konfigurasi serta hubungan command dengan output yang terlihat.' },
  }),
});

const initialDocument = await request(`/documents/${document.id}`);
assert.equal(initialDocument.priority, 'high', 'Prioritas laporan V5 harus tersimpan.');
assert.ok(initialDocument.deadline_at, 'Deadline laporan V5 harus tersimpan.');
assert.ok(initialDocument.tasks.length >= 5, 'Dokumen baru harus mendapat checklist dasar.');
const customTask = await request(`/documents/${document.id}/tasks`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ title: 'Cek ulang hasil ping' }),
});
const customTaskRow = customTask.tasks.find((task) => task.title === 'Cek ulang hasil ping');
assert.ok(customTaskRow, 'Checklist manual harus dibuat.');
const toggledTask = await request(`/documents/${document.id}/tasks/${customTaskRow.id}`, {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ status: 'done' }),
});
assert.ok(toggledTask.tasks.some((task) => task.id === customTaskRow.id && task.status === 'done'), 'Checklist harus dapat ditandai selesai.');
const savedNote = await request(`/documents/${document.id}/note`, {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ body: 'Cek kembali screenshot konektivitas.' }),
});
assert.equal(savedNote.body, 'Cek kembali screenshot konektivitas.');

const form = new FormData();
form.append('category', 'module');
form.append('sourceDeclaration', 'own');
form.append('files', new Blob(['Langkah 1: Atur interface.\nLangkah 2: Atur IP address.\nLangkah 3: Uji konektivitas dengan ping.'], { type: 'text/plain' }), 'modul-routing.txt');
const upload = await request(`/documents/${document.id}/files`, { method: 'POST', body: form });
assert.equal(upload.files.length, 1);

const evidenceForm = new FormData();
evidenceForm.append('category', 'evidence');
evidenceForm.append('sourceDeclaration', 'own');
evidenceForm.append('files', new Blob(['Konfigurasi interface GigabitEthernet0/0 menggunakan IP 192.168.78.1/27. Pengujian ping menuju 192.168.78.2 mengirim 4 paket dan menerima 4 balasan, dengan packet loss 0%.'], { type: 'text/plain' }), 'hasil-ping.txt');
const evidenceUpload = await request(`/documents/${document.id}/files`, { method: 'POST', body: evidenceForm });
assert.equal(evidenceUpload.files.length, 1);

const templateForm = new FormData();
templateForm.append('category', 'template');
templateForm.append('sourceDeclaration', 'template_allowed');
templateForm.append('files', new Blob(['Judul Laporan\nBAB I\nBAB II'], { type: 'text/plain' }), 'template-acuan.txt');
const templateUpload = await request(`/documents/${document.id}/files`, { method: 'POST', body: templateForm });
assert.equal(templateUpload.files.length, 1);

const parameterCreated = await request(`/documents/${document.id}/parameters`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ label: 'IP router', value: '192.168.78.1/27', category: 'network', isRequired: true, includeInDraft: true }),
});
assert.equal(parameterCreated.parameter.value, '192.168.78.1/27');

const analysis = await request(`/documents/${document.id}/analyze`, { method: 'POST' });
const analysisDone = await waitForJob(analysis.jobId);
assert.equal(analysisDone.status, 'completed', analysisDone.error_message || analysisDone.message);

const generated = await request(`/documents/${document.id}/generate`, { method: 'POST' });
const generateDone = await waitForJob(generated.jobId);
assert.equal(generateDone.status, 'completed', generateDone.error_message || generateDone.message);
assert.ok(generateDone.timeline.length >= 3, 'Timeline generate harus menjelaskan beberapa tahap kerja AI.');

const documentAfterGenerate = await request(`/documents/${document.id}`);
assert.equal(documentAfterGenerate.parameters.length, 1, 'Parameter registry harus tersimpan di dokumen.');
assert.ok(documentAfterGenerate.sections.some((section) => section.content.includes('192.168.78.1/27')), 'Parameter wajib harus muncul di draft.');
assert.deepEqual(reportSectionIssues(documentAfterGenerate.sections), [], 'Draft harus lolos quality gate anti AI slop.');
assert.ok(documentAfterGenerate.templateInspections.length >= 1, 'Template harus diperiksa saat analisis.');

const scan = await request(`/documents/${document.id}/scan`, { method: 'POST' }).catch(() => null);
if (scan?.jobId) {
  const scanDone = await waitForJob(scan.jobId);
  assert.equal(scanDone.status, 'completed', scanDone.error_message || scanDone.message);
}

const exported = await request(`/documents/${document.id}/export`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ confirmReviewed: true }),
});
const exportDone = await waitForJob(exported.jobId);
assert.equal(exportDone.status, 'completed', exportDone.error_message || exportDone.message);
const exportId = exportDone.result?.exportId || exportDone.result?.id;
assert.ok(exportId, 'Export harus menghasilkan ID export.');

const download = await fetch(`${base}/api/exports/${exportId}/download`, { headers: headers() });
assert.equal(download.ok, true, 'DOCX hasil export harus dapat diunduh.');
const docx = new Uint8Array(await download.arrayBuffer());
assert.ok(docx.length > 1000, 'DOCX hasil export terlalu kecil.');
assert.equal(String.fromCharCode(...docx.slice(0, 2)), 'PK', 'DOCX harus berformat ZIP/Office Open XML.');
const archive = new AdmZip(Buffer.from(docx));
const documentXml = archive.readAsText('word/document.xml');
const stylesXml = archive.readAsText('word/styles.xml');
const footerXml = archive.getEntries().filter((entry) => /^word\/footer\d+\.xml$/.test(entry.entryName)).map((entry) => entry.getData().toString('utf8')).join('\n');
assert.match(stylesXml, /Times New Roman/, 'Font dokumen harus mengikuti profil laprak.');
assert.match(stylesXml, /w:color w:val="000000"/, 'Style dokumen harus memakai teks hitam.');
assert.match(documentXml, /w:pgMar[^>]+w:top="1417"[^>]+w:right="1417"[^>]+w:bottom="1417"[^>]+w:left="1417"/, 'Margin DOCX harus 2,5 cm.');
assert.doesNotMatch(documentXml, /w:color w:val="(?:2F5496|4472C4|0563C1|0000FF)"/i, 'Konten DOCX tidak boleh memakai warna biru.');
assert.doesNotMatch(footerXml, /Laprakin draft/i, 'Footer tidak boleh memakai branding draft generik.');

await request(`/documents/${document.id}`, { method: 'DELETE' });
const trash = await request('/documents/trash');
assert.ok(trash.documents.some((item) => item.id === document.id), 'Dokumen terhapus harus masuk tempat sampah.');
const restored = await request(`/documents/${document.id}/restore`, { method: 'POST' });
assert.equal(restored.id, document.id, 'Dokumen harus bisa dipulihkan dalam masa retensi.');

const resetRequested = await request('/auth/request-password-reset', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email }),
});
assert.ok(resetRequested.developmentResetToken, 'Reset token development harus tersedia.');
const reset = await request('/auth/reset-password', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ token: resetRequested.developmentResetToken, password: 'KataSandi-Baru-2026' }),
});
csrf = reset.csrfToken;
assert.equal(reset.user.email, email);

const changed = await request('/auth/password', {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ currentPassword: 'KataSandi-Baru-2026', newPassword: 'KataSandi-Akhir-2026' }),
});
csrf = changed.csrfToken;
assert.equal(changed.user.email, email);

await request('/auth/logout-all', { method: 'POST' });
csrf = '';
const relogin = await request('/auth/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password: 'KataSandi-Akhir-2026' }),
});
csrf = relogin.csrfToken;
assert.equal(relogin.user.email, email);

console.log('E2E passed: auth · profile · source/evidence · timeline · quality gate · DOCX black style · restore · password security');
