#!/usr/bin/env bash
set -euo pipefail

# Backup dir dan key file sengaja berada di luar APP_DIR: proses deploy merotasi
# /opt/laprakin ke /opt/laprakin-rollback-*, sehingga arsip dan kunci enkripsi di
# dalamnya akan terlantar dan skrip membuat kunci baru yang membuat arsip lama
# tidak dapat didekripsi.
APP_DIR="${LAPRAKIN_APP_DIR:-/opt/laprakin}"
BACKUP_DIR="${LAPRAKIN_BACKUP_DIR:-/var/backups/laprakin}"
KEY_FILE="${LAPRAKIN_BACKUP_KEY_FILE:-/var/backups/laprakin/.backup-key}"
RETENTION_DAYS="${LAPRAKIN_BACKUP_RETENTION_DAYS:-30}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE="$BACKUP_DIR/laprakin-$STAMP.tar.gz.enc"
STAGING="$(mktemp -d)"

cleanup() {
  rm -rf "$STAGING"
  cd "$APP_DIR"
  docker compose exec -T laprakin rm -f /app/server/data/.backup-temp.sqlite >/dev/null 2>&1 || true
}
trap cleanup EXIT

umask 077
mkdir -p "$BACKUP_DIR"
if [[ ! -s "$KEY_FILE" ]]; then
  openssl rand -base64 48 > "$KEY_FILE"
  chmod 600 "$KEY_FILE"
fi

cd "$APP_DIR"
docker compose exec -T laprakin rm -f /app/server/data/.backup-temp.sqlite
docker compose exec -T laprakin node --input-type=module <<'NODE'
import { db } from './server/src/db.js';
db.exec("VACUUM INTO '/app/server/data/.backup-temp.sqlite'");
db.close();
NODE

mkdir -p "$STAGING/data" "$STAGING/uploads" "$STAGING/public-media"
docker compose cp laprakin:/app/server/data/.backup-temp.sqlite "$STAGING/data/laprakin.sqlite" >/dev/null
docker compose cp laprakin:/app/server/uploads/. "$STAGING/uploads" >/dev/null
docker compose cp laprakin:/app/server/public-media/. "$STAGING/public-media" >/dev/null
printf 'created_at=%s\nretention_days=%s\n' "$STAMP" "$RETENTION_DAYS" > "$STAGING/manifest.txt"

tar -C "$STAGING" -czf - . \
  | openssl enc -aes-256-cbc -salt -pbkdf2 -pass "file:$KEY_FILE" -out "$ARCHIVE"
sha256sum "$ARCHIVE" > "$ARCHIVE.sha256"
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'laprakin-*.tar.gz.enc*' -mtime "+$RETENTION_DAYS" -delete

printf 'backup=%s\nbytes=%s\n' "$ARCHIVE" "$(stat -c %s "$ARCHIVE")"
