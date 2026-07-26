/**
 * Memastikan server benar-benar dapat di-import dan mulai mendengarkan.
 *
 * Ditambahkan setelah deploy 26 Juli 2026 gagal: sebuah rute memakai `const`
 * multer yang dideklarasikan ratusan baris di bawahnya. `node --check` lolos
 * karena sintaksnya sah, tetapi modul melempar ReferenceError saat dijalankan
 * dan container masuk crash-loop. Hanya menjalankan modulnya yang menangkap
 * kelas kesalahan ini.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'laprakin-boot-'));
const port = 4100 + Math.floor(Math.random() * 400);

const child = spawn(process.execPath, [path.join(root, 'server/src/index.js')], {
  env: {
    ...process.env,
    NODE_ENV: 'development',
    PORT: String(port),
    LAPRAKIN_DATA_DIR: dataDir,
    LAPRAKIN_UPLOAD_DIR: path.join(dataDir, 'uploads'),
    LAPRAKIN_PUBLIC_MEDIA_DIR: path.join(dataDir, 'public-media'),
    AI_REQUIRED: 'false',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
child.stdout.on('data', (chunk) => { output += chunk; });
child.stderr.on('data', (chunk) => { output += chunk; });

const cleanup = async () => {
  // Pipe dilepas lebih dulu: mematikan child saat stream masih terpasang
  // memicu assertion libuv pada Windows dan menutupi hasil pemeriksaan.
  child.stdout.removeAllListeners();
  child.stderr.removeAllListeners();
  child.stdout.destroy();
  child.stderr.destroy();
  if (child.exitCode === null) child.kill();
  await new Promise((resolve) => setTimeout(resolve, 150));
  try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch { /* dibersihkan OS */ }
};

const exited = new Promise((resolve) => child.once('exit', (code) => resolve(code ?? 1)));
const listening = (async () => {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health/ready`);
      if (response.status < 500) return 'ok';
    } catch { /* belum siap */ }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return 'timeout';
})();

const result = await Promise.race([exited.then((code) => `exit:${code}`), listening]);
await cleanup();

// process.exit() dihindari: keluar paksa saat handle child masih menutup memicu
// assertion libuv pada Windows dan menghasilkan exit code 127 meski pemeriksaan
// berhasil. Menyetel exitCode membiarkan event loop tuntas lebih dulu.
if (result === 'ok') {
  console.log('boot-check: server berhasil start dan menjawab /api/health/ready');
  process.exitCode = 0;
} else {
  console.error(`boot-check GAGAL (${result})`);
  console.error(output.trim().split('\n').slice(-25).join('\n'));
  process.exitCode = 1;
}
