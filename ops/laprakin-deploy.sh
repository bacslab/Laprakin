#!/usr/bin/env bash
# Deploy otomatis Laprakin, model tarik (pull).
#
# VM yang menarik perubahan, bukan GitHub yang mendorong. Alasannya: port 22
# dibatasi ke IP operator, sedangkan runner GitHub Actions ber-IP dinamis.
# Model tarik hanya butuh koneksi keluar, sehingga NSG tetap tertutup dan tidak
# ada private key SSH yang dititipkan sebagai secret di GitHub.
#
# Hanya branch `main` yang dipakai. CI wajib lulus sebelum perubahan didorong
# ke branch ini, dan VM menarik revisi yang sama dengan yang dilihat pengguna.
#
# Urutan tiap deploy: backup -> build image kandidat -> uji boot di container
# canary terisolasi -> baru promosikan. Bila canary gagal, produksi tidak
# tersentuh sama sekali dan operator menerima notifikasi.
[ -n "${BASH_VERSION:-}" ] || exec /bin/bash "$0" "$@"
set -uo pipefail

if [[ "${1:-}" == "install-self" ]]; then
  if (( EUID != 0 )); then
    echo "deploy: instalasi harus dijalankan sebagai root" >&2
    exit 1
  fi
  INSTALL_TARGET="${2:-/usr/local/bin/laprakin-deploy.sh}"
  if [[ -f "$INSTALL_TARGET" ]]; then
    cp -a "$INSTALL_TARGET" "${INSTALL_TARGET}.pre-disk-guard-20260730"
  fi
  install -o root -g root -m 750 "$0" "$INSTALL_TARGET"
  echo "deploy: guard disk terpasang di $INSTALL_TARGET"
  exit 0
fi

APP_DIR="${LAPRAKIN_APP_DIR:-/opt/laprakin}"
STATE_DIR="${LAPRAKIN_DEPLOY_STATE_DIR:-/var/lib/laprakin-deploy}"
REPO_DIR="$STATE_DIR/repo"
# Repository production saat ini publik, jadi checkout default memakai HTTPS
# read-only dan tidak bergantung pada deploy key GitHub yang bisa dinonaktifkan
# oleh kebijakan repository. Untuk repository privat, set LAPRAKIN_REPO_URL ke
# URL SSH dan deploy key yang sesuai.
REPO_URL="${LAPRAKIN_REPO_URL:-https://github.com/bacslab/Laprakin.git}"
BRANCH="${LAPRAKIN_DEPLOY_BRANCH:-main}"
SSH_KEY="${LAPRAKIN_DEPLOY_KEY:-$STATE_DIR/deploy-key}"
NOTIFY="${LAPRAKIN_NOTIFY_BIN:-/usr/local/bin/laprakin-notify.sh}"
CANARY_PORT="${LAPRAKIN_CANARY_PORT:-4555}"
LOCK_FILE="$STATE_DIR/deploy.lock"
DISK_CLEANUP_THRESHOLD_KB="${LAPRAKIN_DISK_CLEANUP_THRESHOLD_KB:-8388608}"
MIN_BUILD_SPACE_KB="${LAPRAKIN_MIN_BUILD_SPACE_KB:-6291456}"
BUILD_TIMEOUT_SECONDS="${LAPRAKIN_BUILD_TIMEOUT_SECONDS:-900}"

export GIT_SSH_COMMAND="ssh -i $SSH_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"

mkdir -p "$STATE_DIR"

# Satu deploy pada satu waktu. Timer berjalan tiap lima menit sedangkan build
# dapat memakan lebih lama dari itu pada VM 1 GB.
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "deploy: proses lain masih berjalan; dilewati"
  exit 0
fi

notify() {
  [[ -x "$NOTIFY" ]] && "$NOTIFY" "$@" >/dev/null 2>&1 || true
}

fail() {
  echo "deploy GAGAL: $1" >&2
  notify "Deploy gagal" "$1" "production" "${TARGET:-}" "${SUBJECT:-}"
  exit 1
}

cleanup_canary() {
  docker rm -f laprakin-canary >/dev/null 2>&1 || true
}
trap cleanup_canary EXIT

available_root_kb() {
  df -Pk / | awk 'NR == 2 { print $4 }'
}

cleanup_reclaimable_docker_data() {
  echo "deploy: ruang disk menipis; membersihkan cache Docker yang tidak digunakan"
  docker container prune -f --filter "until=24h" >/dev/null 2>&1 || true
  docker builder prune -af --filter "until=24h" >/dev/null 2>&1 || true
  docker image prune -f >/dev/null 2>&1 || true
}

ensure_build_space() {
  local available
  available="$(available_root_kb)"
  if (( available < DISK_CLEANUP_THRESHOLD_KB )); then
    cleanup_reclaimable_docker_data
    available="$(available_root_kb)"
  fi
  if (( available < MIN_BUILD_SPACE_KB )); then
    fail "ruang disk tidak cukup untuk backup dan build; tersedia $((available / 1024)) MB"
  fi
}

# ── Pastikan akses repository sudah dikonfigurasi ───────────────────────────
# Jika operator memilih URL SSH untuk repository privat, validasi deploy key
# lebih dulu dan lewati dengan tenang selama setup belum selesai.
if [[ "$REPO_URL" == git@github.com:* ]]; then
  if [[ ! -s "$SSH_KEY" ]]; then
    echo "deploy: deploy key belum ada di $SSH_KEY; dilewati"
    exit 0
  fi
  # Output ditangkap lebih dulu, bukan disalurkan langsung ke grep: `ssh -T` ke
  # GitHub selalu keluar dengan kode 1 karena tidak ada shell, dan dengan pipefail
  # aktif exit code itu menutupi hasil grep sehingga otentikasi yang berhasil pun
  # terbaca sebagai gagal.
  AUTH_OUTPUT="$(ssh -i "$SSH_KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new \
    -o BatchMode=yes -o ConnectTimeout=15 -T git@github.com 2>&1 || true)"
  if ! printf '%s' "$AUTH_OUTPUT" | grep -q 'successfully authenticated'; then
    echo "deploy: deploy key belum diotorisasi di GitHub; dilewati" >&2
    exit 0
  fi
fi

# Branch main selalu menjadi sumber deployment. Jika repository belum dapat
# diakses, timer menunggu pada percobaan berikutnya tanpa mengirim spam alert.
if ! git ls-remote --exit-code --heads "$REPO_URL" "$BRANCH" >/dev/null 2>&1; then
  echo "deploy: branch $BRANCH belum ada di remote; dilewati"
  exit 0
fi

# ── Ambil revisi terbaru ────────────────────────────────────────────────────
if [[ ! -d "$REPO_DIR/.git" ]]; then
  git clone --quiet --branch "$BRANCH" "$REPO_URL" "$REPO_DIR" || fail "clone repository gagal"
fi

git -C "$REPO_DIR" fetch --quiet origin "$BRANCH" || fail "fetch branch $BRANCH gagal"
TARGET="$(git -C "$REPO_DIR" rev-parse "origin/$BRANCH")"
CURRENT="$(cat "$STATE_DIR/deployed-revision" 2>/dev/null || echo '')"

if [[ "$TARGET" == "$CURRENT" ]]; then
  echo "deploy: sudah pada revisi ${TARGET:0:7}; tidak ada perubahan"
  exit 0
fi

SUBJECT="$(git -C "$REPO_DIR" log -1 --format=%s "$TARGET")"
FROM_LABEL="${CURRENT:0:7}"
[[ -z "$FROM_LABEL" ]] && FROM_LABEL="belum ada"
echo "deploy: $FROM_LABEL -> ${TARGET:0:7} ($SUBJECT)"

ensure_build_space

# ── Backup sebelum menyentuh apa pun ────────────────────────────────────────
systemctl start laprakin-backup.service >/dev/null 2>&1 || echo "deploy: backup pra-deploy gagal, dilanjutkan" >&2

# ── Salin source ────────────────────────────────────────────────────────────
# git archive dipakai agar mode berkas mengikuti git: bit executable terjaga dan
# tidak menghasilkan direktori world-writable seperti ekstraksi arsip dari
# Windows. Berkas tak terlacak seperti server/.env tidak tersentuh.
git -C "$REPO_DIR" archive --format=tar "$TARGET" | tar -x -C "$APP_DIR" || fail "ekstraksi source gagal"

# ── Bangun image kandidat ───────────────────────────────────────────────────
cd "$APP_DIR" || fail "direktori aplikasi tidak ditemukan"
timeout --foreground "$BUILD_TIMEOUT_SECONDS" docker build -q -t laprakin-laprakin:candidate . >/dev/null 2>&1 || fail "build image kandidat tidak selesai"

# ── Uji boot di container terisolasi ────────────────────────────────────────
# Memeriksa sintaks saja tidak cukup: kesalahan inisialisasi seperti const yang
# dipakai sebelum dideklarasikan baru muncul saat modul dijalankan.
cleanup_canary
docker run -d --name laprakin-canary --memory 600m \
  -p "127.0.0.1:${CANARY_PORT}:4000" \
  --env-file "$APP_DIR/server/.env" \
  -e NODE_ENV=production -e PORT=4000 \
  -e LAPRAKIN_DATA_DIR=/tmp/canary/data \
  -e LAPRAKIN_UPLOAD_DIR=/tmp/canary/uploads \
  -e LAPRAKIN_PUBLIC_MEDIA_DIR=/tmp/canary/media \
  laprakin-laprakin:candidate >/dev/null 2>&1 || fail "canary tidak dapat dijalankan"

CANARY_OK=""
for _ in $(seq 1 40); do
  if curl -fsS -m 5 "http://127.0.0.1:${CANARY_PORT}/api/health/ready" 2>/dev/null | grep -q '"ok":true'; then
    CANARY_OK="yes"
    break
  fi
  state="$(docker inspect -f '{{.State.Status}}' laprakin-canary 2>/dev/null || echo gone)"
  if [[ "$state" != "running" ]]; then break; fi
  sleep 2
done

if [[ -z "$CANARY_OK" ]]; then
  LOGS="$(docker logs --tail 20 laprakin-canary 2>&1 | tail -20)"
  cleanup_canary
  fail "canary ${TARGET:0:7} tidak sehat; produksi tidak diubah.\n\n$LOGS"
fi
cleanup_canary

# ── Promosikan ──────────────────────────────────────────────────────────────
# Image lama disimpan sebagai :previous agar rollback cukup satu retag.
docker tag laprakin-laprakin:latest laprakin-laprakin:previous >/dev/null 2>&1 || true
docker tag laprakin-laprakin:candidate laprakin-laprakin:latest || fail "tagging image gagal"
docker compose up -d --no-build >/dev/null 2>&1 || fail "restart container gagal"

PROD_OK=""
for _ in $(seq 1 40); do
  if curl -fsS -m 5 http://127.0.0.1:4000/api/health/ready 2>/dev/null | grep -q '"ok":true'; then
    PROD_OK="yes"
    break
  fi
  sleep 2
done

if [[ -z "$PROD_OK" ]]; then
  # Canary lulus tetapi produksi tidak sehat: kembalikan segera, jangan tunggu.
  docker tag laprakin-laprakin:previous laprakin-laprakin:latest >/dev/null 2>&1
  docker compose up -d --no-build >/dev/null 2>&1
  fail "produksi tidak sehat setelah promosi ${TARGET:0:7}; sudah dikembalikan ke image sebelumnya"
fi

printf '%s' "$TARGET" > "$STATE_DIR/deployed-revision"
docker container prune -f >/dev/null 2>&1 || true
docker image prune -f >/dev/null 2>&1 || true
docker builder prune -af --filter "until=24h" >/dev/null 2>&1 || true

echo "deploy: berhasil pada ${TARGET:0:7}"
notify "Deploy berhasil" "$SUBJECT" "production" "$TARGET" "$SUBJECT"
