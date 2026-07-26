#!/usr/bin/env bash
# Pengirim notifikasi operasional Laprakin.
#
# Dipakai oleh laprakin-watchdog.sh dan OnFailure unit backup. Kredensial dibaca
# saat runtime dari server/.env yang sama dengan aplikasi; nilainya tidak pernah
# ditulis ke log atau stdout.
#
# Pemakaian: laprakin-notify.sh "<subjek>" "<isi pesan>"
set -euo pipefail

ENV_FILE="${LAPRAKIN_ENV_FILE:-/opt/laprakin/server/.env}"
SUBJECT="${1:?subjek wajib diisi}"
BODY="${2:?isi pesan wajib diisi}"

if [[ ! -r "$ENV_FILE" ]]; then
  echo "notify: $ENV_FILE tidak terbaca; notifikasi dilewati" >&2
  exit 1
fi

env_value() {
  sed -n "s/^$1=//p" "$ENV_FILE" | head -1 | sed 's/^"//; s/"$//' | tr -d '\r'
}

API_KEY="$(env_value SMTP_PASS)"
MAIL_FROM="$(env_value MAIL_FROM)"

# OPS_ALERT_EMAIL sengaja dipisahkan dari ADMIN_EMAIL. ADMIN_EMAIL menentukan
# akun mana yang dipromosikan menjadi admin aplikasi, jadi mengubahnya demi
# notifikasi akan sekaligus mengubah hak akses. Variabel ini hanya dibaca oleh
# skrip ops dan diabaikan aplikasi.
ADMIN_EMAIL="$(env_value OPS_ALERT_EMAIL)"
[[ -z "$ADMIN_EMAIL" ]] && ADMIN_EMAIL="$(env_value ADMIN_EMAIL)"

if [[ -z "$API_KEY" || -z "$MAIL_FROM" || -z "$ADMIN_EMAIL" ]]; then
  echo "notify: SMTP_PASS/MAIL_FROM/OPS_ALERT_EMAIL belum lengkap di $ENV_FILE" >&2
  exit 1
fi

if [[ "$ADMIN_EMAIL" == *@example.test || "$ADMIN_EMAIL" == *@example.com ]]; then
  echo "notify: alamat tujuan masih placeholder ($ADMIN_EMAIL); set OPS_ALERT_EMAIL" >&2
  exit 1
fi

payload="$(HOSTNAME_VALUE="$(hostname)" SUBJECT="$SUBJECT" BODY="$BODY" \
  MAIL_FROM="$MAIL_FROM" ADMIN_EMAIL="$ADMIN_EMAIL" python3 - <<'PY'
import json, os
print(json.dumps({
    "from": os.environ["MAIL_FROM"],
    "to": [os.environ["ADMIN_EMAIL"]],
    "subject": f"[Laprakin ops] {os.environ['SUBJECT']}",
    "text": f"{os.environ['BODY']}\n\nHost: {os.environ['HOSTNAME_VALUE']}\n",
}))
PY
)"

status="$(curl -sS -o /tmp/laprakin-notify-response -w '%{http_code}' \
  -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "$payload")"

if [[ "$status" != "200" ]]; then
  echo "notify: pengiriman gagal (HTTP $status)" >&2
  exit 1
fi

echo "notify: terkirim ke $ADMIN_EMAIL"
