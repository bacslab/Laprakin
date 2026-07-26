#!/usr/bin/env bash
# Watchdog operasional Laprakin.
#
# Azure Monitor hanya melihat metrik host (CPU, memori, ketersediaan VM). Empat
# kondisi berikut tidak terlihat dari luar dan justru yang paling sering gagal
# diam-diam, jadi diperiksa dari dalam VM.
#
# Notifikasi hanya dikirim saat status BERUBAH, supaya tidak membanjiri inbox.
set -uo pipefail

BACKUP_DIR="${LAPRAKIN_BACKUP_DIR:-/var/backups/laprakin}"
STATE_DIR="${LAPRAKIN_WATCHDOG_STATE_DIR:-/var/lib/laprakin-watchdog}"
NOTIFY="${LAPRAKIN_NOTIFY_BIN:-/usr/local/bin/laprakin-notify.sh}"
HEALTH_URL="${LAPRAKIN_HEALTH_URL:-http://127.0.0.1:4000/api/health/ready}"
DISK_THRESHOLD="${LAPRAKIN_DISK_THRESHOLD:-85}"
BACKUP_MAX_AGE_HOURS="${LAPRAKIN_BACKUP_MAX_AGE_HOURS:-36}"
CONTAINER="${LAPRAKIN_CONTAINER:-laprakin-laprakin-1}"

mkdir -p "$STATE_DIR"

# report <nama-cek> <ok|bad> <pesan>
report() {
  local check="$1" status="$2" message="$3"
  local state_file="$STATE_DIR/$check"
  local previous="ok"
  [[ -f "$state_file" ]] && previous="$(cat "$state_file")"

  if [[ "$status" == "$previous" ]]; then
    return 0
  fi

  printf '%s' "$status" > "$state_file"
  if [[ "$status" == "bad" ]]; then
    echo "watchdog: MASALAH [$check] $message" >&2
    "$NOTIFY" "MASALAH: $check" "$message" || echo "watchdog: notifikasi gagal dikirim" >&2
  else
    echo "watchdog: PULIH [$check] $message"
    "$NOTIFY" "PULIH: $check" "$message" || true
  fi
}

# 1. Ruang disk root.
disk_used="$(df --output=pcent / | tail -1 | tr -dc '0-9')"
if [[ -n "$disk_used" && "$disk_used" -ge "$DISK_THRESHOLD" ]]; then
  report disk bad "Disk root terpakai ${disk_used}% (ambang ${DISK_THRESHOLD}%)."
else
  report disk ok "Disk root terpakai ${disk_used}%."
fi

# 2. Kesegaran backup. Inilah kegagalan senyap yang terjadi 26 Juli 2026:
#    skrip backup kehilangan bit executable dan timer gagal tanpa sinyal apa pun.
newest_backup="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'laprakin-*.tar.gz.enc' -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1)"
if [[ -z "$newest_backup" ]]; then
  report backup bad "Tidak ada arsip backup sama sekali di $BACKUP_DIR."
else
  newest_epoch="${newest_backup%% *}"
  age_hours=$(( ( $(date +%s) - ${newest_epoch%.*} ) / 3600 ))
  if [[ "$age_hours" -ge "$BACKUP_MAX_AGE_HOURS" ]]; then
    report backup bad "Backup terbaru berumur ${age_hours} jam (ambang ${BACKUP_MAX_AGE_HOURS} jam): ${newest_backup#* }"
  else
    report backup ok "Backup terbaru berumur ${age_hours} jam."
  fi
fi

# 3. Container aplikasi berjalan.
if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$CONTAINER"; then
  report container ok "Container $CONTAINER berjalan."
else
  report container bad "Container $CONTAINER tidak berjalan."
fi

# 4. Endpoint kesehatan aplikasi. Menangkap kasus container hidup tetapi
#    database, worker, atau kredensial AI bermasalah.
health_body="$(curl -fsS --max-time 15 "$HEALTH_URL" 2>/dev/null)"
if [[ -n "$health_body" && "$health_body" == *'"ok":true'* ]]; then
  report health ok "Health check normal."
else
  report health bad "Health check gagal. Respons: ${health_body:-<kosong atau tidak dapat dihubungi>}"
fi
