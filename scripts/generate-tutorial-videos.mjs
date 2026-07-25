import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const outputDir = path.resolve('client/public/tutorial');
const recordingDir = path.resolve('.tmp-tutorial-recordings');

const scenes = [
  {
    filename: 'alur-1.webm',
    label: 'Langkah 1',
    title: 'Ceritakan tugasmu',
    content: `
      <div class="welcome">mau <em>laprakin</em> apa hari ini, Hilmi?</div>
      <div class="composer"><span id="typed"></span><i class="cursor"></i><button>➤</button></div>
      <script>
        const text = 'Buatkan laprak konfigurasi jaringan VLAN untuk mata kuliah Administrasi Jaringan';
        let index = 0;
        setTimeout(() => {
          const timer = setInterval(() => {
            document.querySelector('#typed').textContent = text.slice(0, ++index);
            if (index >= text.length) {
              clearInterval(timer);
              document.querySelector('.composer button').classList.add('ready');
            }
          }, 34);
        }, 500);
      </script>
    `,
  },
  {
    filename: 'alur-2.webm',
    label: 'Langkah 2',
    title: 'Tambahkan bahan utama',
    content: `
      <div class="thread-line user">Laprak VLAN untuk mata kuliah Administrasi Jaringan</div>
      <div class="drop-zone"><b>Letakkan modul di sini</b><span>PDF, DOCX, atau instruksi dosen</span></div>
      <div class="floating-file"><strong>PDF</strong><span><b>Modul VLAN.pdf</b><small>2,4 MB</small></span></div>
      <div class="source-confirm"><span>✓</span><b>Modul VLAN.pdf berhasil ditambahkan</b></div>
    `,
  },
  {
    filename: 'alur-3.webm',
    label: 'Langkah 3',
    title: 'Lengkapi bukti praktik',
    content: `
      <div class="evidence-heading"><b>Bukti praktik</b><span>Tambahkan hasil yang benar-benar kamu miliki</span></div>
      <div class="evidence-grid">
        <div class="evidence-card one"><div class="terminal">Switch# show vlan<br><i>10&nbsp;&nbsp;LAB-A&nbsp;&nbsp;active</i></div><b>hasil-vlan.png</b></div>
        <div class="evidence-card two"><div class="network"><i></i><i></i><i></i><span></span></div><b>topologi.jpg</b></div>
        <div class="evidence-card three"><div class="table"><i></i><i></i><i></i><i></i></div><b>data-pengujian.xlsx</b></div>
      </div>
      <div class="evidence-ready">3 bukti siap dipakai</div>
    `,
  },
  {
    filename: 'alur-4.webm',
    label: 'Langkah 4',
    title: 'Review sampai siap diunduh',
    content: `
      <div class="draft">
        <div class="draft-head"><span><b>Draft Laprak VLAN</b><small>4 bagian selesai</small></span><i>Siap direview</i></div>
        <div class="draft-row"><span>1</span><b>Tujuan praktikum</b><i>✓</i></div>
        <div class="draft-row"><span>2</span><b>Langkah konfigurasi</b><i>✓</i></div>
        <div class="draft-row"><span>3</span><b>Hasil dan pembahasan</b><i>✓</i></div>
        <div class="draft-row"><span>4</span><b>Kesimpulan</b><i>✓</i></div>
      </div>
      <div class="review-actions"><button>Revisi bagian</button><button class="download">↓ Download DOCX</button></div>
    `,
  },
];

function documentFor(scene) {
  return `<!doctype html>
  <html lang="id">
  <head>
    <meta charset="utf-8">
    <style>
      *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#1b1c1a;color:#f7f7f2;font-family:Arial,sans-serif}
      body{display:grid;grid-template-columns:165px 1fr}
      .sidebar{padding:18px 14px;border-right:1px solid #393a36;background:#181916}
      .brand{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:800}.brand i{width:22px;height:22px;border-radius:50%;background:#f7f7f2}
      .new{height:34px;margin-top:24px;border-radius:6px;padding:9px;background:#b8ff26;color:#10110e;font-size:12px;font-weight:800}
      .nav{display:grid;gap:8px;margin-top:16px}.nav span{padding:8px;color:#aaa; font-size:11px}.nav span:first-child{border-radius:6px;background:#30312e;color:#fff}
      .main{display:grid;grid-template-rows:48px 1fr;background:#1d1e1b}
      .top{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #393a36;padding:0 22px;color:#a9aaa5;font-size:11px}.top b{color:#fff}
      .stage{position:relative;display:grid;place-items:center;padding:44px 64px}
      .step{position:absolute;top:18px;left:24px;display:flex;align-items:center;gap:10px}.step span{border:1px solid #474843;border-radius:999px;padding:6px 9px;color:#b8ff26;font-size:10px;font-weight:800}.step b{font-size:13px}
      .welcome{max-width:650px;margin-bottom:80px;text-align:center;font-size:32px;font-weight:700;line-height:1.2}.welcome em{color:#b8ff26;font-style:normal}
      .composer{position:absolute;left:13%;right:13%;bottom:66px;min-height:88px;display:flex;align-items:flex-start;border:1px solid #4b4c47;border-radius:9px;padding:18px;background:#292a27;color:#f4f4ed;font-size:15px;line-height:1.5}
      .composer button{position:absolute;right:12px;bottom:11px;width:34px;height:34px;border:0;border-radius:50%;background:#41423e;color:#8a8b85;font-size:16px}.composer button.ready{background:#b8ff26;color:#10110e;animation:pulse .7s infinite alternate}
      .cursor{width:2px;height:19px;margin-left:2px;background:#b8ff26;animation:blink .55s infinite}
      .thread-line{position:absolute;top:82px;right:60px;max-width:460px;border:1px solid #484944;border-radius:8px;padding:12px 14px;background:#292a27;font-size:13px}
      .drop-zone{width:520px;height:220px;display:grid;place-content:center;gap:8px;border:2px dashed #4a4b46;border-radius:10px;text-align:center;color:#a6a7a1}.drop-zone b{color:#fff;font-size:18px}.drop-zone span{font-size:12px}
      .floating-file{position:absolute;top:150px;left:90px;display:flex;align-items:center;gap:11px;border:1px solid #53544e;border-radius:8px;padding:11px 14px;background:#30312d;box-shadow:0 14px 34px #0008;animation:drop 2.7s ease-in-out forwards}.floating-file>strong{display:grid;place-items:center;width:42px;height:48px;border-radius:5px;background:#e85a4f;font-size:11px}.floating-file>span{display:grid;gap:4px}.floating-file b{font-size:12px}.floating-file small{color:#aaa;font-size:10px}
      .source-confirm{position:absolute;bottom:55px;display:flex;align-items:center;gap:8px;opacity:0;color:#dfe1da;font-size:12px;animation:confirm .5s 2.9s forwards}.source-confirm span{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:#b8ff26;color:#151612;font-weight:900}
      .evidence-heading{position:absolute;top:72px;left:82px;display:grid;gap:5px}.evidence-heading b{font-size:20px}.evidence-heading span{color:#aaa;font-size:12px}
      .evidence-grid{width:100%;display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.evidence-card{transform:translateY(28px);opacity:0;border:1px solid #444540;border-radius:8px;padding:10px;background:#292a27}.evidence-card.one{animation:rise .5s .6s forwards}.evidence-card.two{animation:rise .5s 1.1s forwards}.evidence-card.three{animation:rise .5s 1.6s forwards}.evidence-card>b{display:block;margin-top:9px;font-size:11px}
      .terminal,.network,.table{height:116px;border-radius:5px;background:#111;color:#eee;padding:16px;font:11px monospace}.terminal i{color:#b8ff26;font-style:normal}
      .network{position:relative;background:#20252a}.network i{position:absolute;top:46px;width:28px;height:22px;border:2px solid #8bc8ff;border-radius:4px}.network i:nth-child(1){left:18px}.network i:nth-child(2){left:78px}.network i:nth-child(3){right:18px}.network span{position:absolute;left:44px;right:44px;top:57px;height:2px;background:#8bc8ff}
      .table{display:grid;grid-template-columns:1fr 1fr;gap:5px;background:#edf3eb}.table i{border-radius:2px;background:#9cba98}.table i:nth-child(2),.table i:nth-child(3){background:#cadcc7}
      .evidence-ready{position:absolute;bottom:54px;border-radius:999px;padding:8px 12px;background:#b8ff26;color:#151612;font-size:11px;font-weight:800;opacity:0;animation:confirm .5s 2.2s forwards}
      .draft{width:620px;border:1px solid #454640;border-radius:8px;background:#282925}.draft-head{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #454640;padding:15px}.draft-head>span{display:grid;gap:4px}.draft-head b{font-size:15px}.draft-head small{color:#aaa;font-size:10px}.draft-head>i{border-radius:999px;padding:6px 9px;background:#343a2f;color:#b8ff26;font-size:10px;font-style:normal}
      .draft-row{display:grid;grid-template-columns:28px 1fr 24px;align-items:center;gap:8px;border-bottom:1px solid #3c3d38;padding:11px 15px}.draft-row:last-child{border:0}.draft-row span{display:grid;place-items:center;width:23px;height:23px;border:1px solid #4e4f49;border-radius:50%;font-size:10px}.draft-row b{font-size:12px}.draft-row i{color:#b8ff26;font-style:normal;opacity:0;animation:check .25s forwards}.draft-row:nth-child(2) i{animation-delay:.6s}.draft-row:nth-child(3) i{animation-delay:1s}.draft-row:nth-child(4) i{animation-delay:1.4s}.draft-row:nth-child(5) i{animation-delay:1.8s}
      .review-actions{position:absolute;bottom:42px;display:flex;gap:9px}.review-actions button{height:36px;border:1px solid #4b4c46;border-radius:7px;padding:0 13px;background:transparent;color:#eee;font-weight:700}.review-actions .download{border-color:#b8ff26;background:#b8ff26;color:#12130f;transform:scale(.96);animation:pulse .75s 2.1s infinite alternate}
      @keyframes blink{50%{opacity:0}}@keyframes pulse{to{transform:scale(1.04)}}@keyframes rise{to{transform:translateY(0);opacity:1}}@keyframes confirm{to{opacity:1}}@keyframes check{to{opacity:1}}
      @keyframes drop{0%{transform:translate(0,0) rotate(-2deg)}70%{transform:translate(285px,120px) rotate(1deg);opacity:1}100%{transform:translate(285px,120px) scale(.88);opacity:0}}
    </style>
  </head>
  <body>
    <aside class="sidebar"><div class="brand"><i></i>Laprakin</div><div class="new">＋ Chat baru</div><div class="nav"><span>Chats</span><span>Projects</span><span>Dokumen</span></div></aside>
    <main class="main"><header class="top"><b>Chat Laprakin</b><span>Konfigurasi&nbsp;&nbsp;&nbsp; ◯</span></header><section class="stage"><div class="step"><span>${scene.label}</span><b>${scene.title}</b></div>${scene.content}</section></main>
  </body>
  </html>`;
}

await fs.mkdir(outputDir, { recursive: true });
await fs.rm(recordingDir, { recursive: true, force: true });
await fs.mkdir(recordingDir, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const scene of scenes) {
    const context = await browser.newContext({
      viewport: { width: 960, height: 540 },
      recordVideo: { dir: recordingDir, size: { width: 960, height: 540 } },
    });
    const page = await context.newPage();
    await page.setContent(documentFor(scene), { waitUntil: 'load' });
    await page.waitForTimeout(4600);
    const video = page.video();
    await page.close();
    await context.close();
    const recordedPath = await video.path();
    await fs.copyFile(recordedPath, path.join(outputDir, scene.filename));
  }
} finally {
  await browser.close();
  await fs.rm(recordingDir, { recursive: true, force: true });
}

console.log(`Generated ${scenes.length} tutorial videos in ${outputDir}`);
