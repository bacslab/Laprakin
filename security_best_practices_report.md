# Security Best Practices Report

## Executive Summary

Audit dilakukan pada frontend React, API Express, auth cookie/JWT, CSRF, SQLite access, upload, CMS admin, Docker, dan dependency production. Tidak ditemukan critical vulnerability yang terkonfirmasi. Dependency audit saat laporan dibuat menunjukkan **0 vulnerability**. Beberapa kontrol production tetap membutuhkan infrastruktur eksternal sebelum public launch.

## Fixed Findings

### SEC-001 — High — Dependency denial of service

- **Location:** `server/package.json`
- **Evidence:** `adm-zip` lama dan transitive `body-parser` terdeteksi rentan oleh `npm audit`.
- **Impact:** File ZIP/Office yang dibuat khusus dapat menghabiskan memory; malformed request dapat melemahkan body limit pada versi lama.
- **Fix:** Upgrade ke `adm-zip 0.6.0`, `express 4.22.2`, dan `body-parser 1.20.6`; audit ulang menghasilkan 0 vulnerability.

### SEC-002 — High — CMS upload content spoofing

- **Location:** `server/src/index.js`, route upload landing dan feature update.
- **Evidence:** Upload landing sebelumnya mempercayai MIME browser dan ekstensi.
- **Impact:** File non-media dapat disimpan sebagai media publik.
- **Fix:** Signature validation untuk PNG, JPEG, WEBP, PDF, MP4, WEBM, dan OGG; nama storage acak; `nosniff`; upload rate limit.

### SEC-003 — Medium — Error disclosure dan API fallback

- **Location:** `server/src/index.js`, error middleware dan tail routing.
- **Evidence:** Pesan error internal dapat dikirim pada status 500 dan API tak dikenal dapat jatuh ke respons non-JSON.
- **Impact:** Informasi internal membantu reconnaissance dan client menerima kontrak respons yang tidak konsisten.
- **Fix:** Pesan 500 generik, logging hanya untuk server error, dan JSON 404 khusus `/api`.

### SEC-004 — Medium — Baseline browser hardening

- **Location:** `server/src/index.js`, `securityHeaders`.
- **Fix:** CSP, `X-Frame-Options: DENY`, `nosniff`, referrer policy, permissions policy, COOP, CORP, explicit CORS allowlist, dan `x-powered-by` disabled.

### SEC-005 — Medium — CMS media durability

- **Location:** `Dockerfile`, `docker-compose.yml`.
- **Impact:** Gambar CMS dapat hilang saat container diganti.
- **Fix:** `server/public-media` dibuat sebagai persistent Docker volume dan dimasukkan ke checklist backup.

### SEC-006 — High — Backend secret exposure guard

- **Location:** `scripts/production-readiness.mjs`.
- **Impact:** API key, OAuth client secret, session secret, payment server key, atau SMTP password yang tidak sengaja ter-bundle dapat diambil dari browser.
- **Fix:** Gate production memindai seluruh output `client/dist` terhadap credential backend aktif tanpa mencetak nilai secret.

## Open Production Requirements

### SEC-101 — High — Admin belum memiliki MFA bawaan

- **Location:** `server/src/index.js`, `requireAdmin`; auth di `server/src/services.js`.
- **Impact:** Pengambilalihan satu akun admin memberi akses ke CMS dan fungsi operasional.
- **Required mitigation:** Lindungi `/admin` dengan identity-aware proxy/MFA sebelum public launch, gunakan akun admin khusus, password manager, dan batasi origin/IP bila memungkinkan.

### SEC-102 — High — File scan bukan antivirus

- **Location:** `server/src/services.js`, file extraction/scan; `docs/SECURITY.md`.
- **Impact:** File berbahaya yang formatnya valid masih dapat lolos pemeriksaan signature dan heuristik teks.
- **Required mitigation:** Tambahkan ClamAV atau malware scanning service, quarantine sebelum parsing, timeout/size limit, dan observability untuk parser failure.

### SEC-103 — Medium — Single-instance SQLite dan local filesystem

- **Location:** `server/src/db.js`, `docs/DEPLOYMENT.md`.
- **Impact:** Cocok untuk private beta, tetapi tidak menyediakan HA, distributed locking, atau object-storage durability.
- **Required mitigation:** Backup terenkripsi dan restore drill wajib; migrasikan ke managed PostgreSQL dan private object storage sebelum horizontal scaling.

### SEC-104 — Medium — Rate limiting masih per-process

- **Location:** `server/src/index.js`, Express rate limiters.
- **Impact:** Limit tidak terbagi antar instance dan dapat hilang saat restart.
- **Required mitigation:** Pakai Redis-backed rate limiter dan bot protection server-side saat aplikasi menjadi multi-instance/public.

## Verification Performed

- Production build React/Vite.
- Node syntax and database migration load.
- Smoke test API.
- Integration test CMS: role isolation, draft isolation, fake image rejection, valid image upload, publish delivery, receipt deduplication, archive.
- `npm audit --omit=dev`: 0 vulnerability.

## Scope Limitation

Audit source dan integration test tidak dapat menjamin tidak ada vulnerability sama sekali. External penetration test tetap diperlukan pada deployment nyata karena TLS proxy, DNS, cloud IAM, firewall, object storage, SMTP, Midtrans, dan secret management berada di luar source repository.
