#!/usr/bin/env bash
# Pengirim notifikasi operasional Laprakin.
#
# Dipakai oleh laprakin-watchdog.sh dan OnFailure unit backup. Kredensial dibaca
# saat runtime dari server/.env yang sama dengan aplikasi; nilainya tidak pernah
# ditulis ke log atau stdout.
#
# Pemakaian: laprakin-notify.sh "<subjek>" "<isi pesan>" [environment] [revision] [ringkasan]
set -euo pipefail

ENV_FILE="${LAPRAKIN_ENV_FILE:-/opt/laprakin/server/.env}"
EMAIL_RENDERER="${LAPRAKIN_EMAIL_RENDERER:-/opt/laprakin/ops/laprakin-email-renderer.mjs}"
SUBJECT="${1:?subjek wajib diisi}"
BODY="${2:?isi pesan wajib diisi}"
DEPLOY_ENVIRONMENT="${3:-production}"
DEPLOY_REVISION="${4:-}"
DEPLOY_SUMMARY="${5:-}"

if [[ ! -r "$ENV_FILE" ]]; then
  echo "notify: $ENV_FILE tidak terbaca; notifikasi dilewati" >&2
  exit 1
fi

env_value() {
  sed -n "s/^$1=//p" "$ENV_FILE" | head -1 | sed 's/^"//; s/"$//' | tr -d '\r'
}

API_KEY="$(env_value SMTP_PASS)"
MAIL_FROM="$(env_value MAIL_FROM)"
DEPLOYMENT_URL="$(env_value APP_URL)"
DEPLOY_LOGS_URL="$(env_value OPS_LOGS_URL)"

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

render_react_email() {
  if command -v node >/dev/null 2>&1; then
    node "$EMAIL_RENDERER"
    return
  fi
  if command -v docker >/dev/null 2>&1 \
    && docker image inspect laprakin-laprakin:latest >/dev/null 2>&1; then
    docker run --rm --network none --read-only --cap-drop ALL \
      --security-opt no-new-privileges --memory 192m --pids-limit 64 \
      --env HOSTNAME_VALUE --env SUBJECT --env BODY --env MAIL_FROM --env ADMIN_EMAIL \
      --env DEPLOY_ENVIRONMENT --env DEPLOY_REVISION --env DEPLOY_SUMMARY \
      --env DEPLOYMENT_URL --env DEPLOY_LOGS_URL --env OCCURRED_AT \
      --volume "$EMAIL_RENDERER:/tmp/laprakin-email-renderer.mjs:ro" \
      --entrypoint node laprakin-laprakin:latest /tmp/laprakin-email-renderer.mjs
    return
  fi
  return 1
}

if [[ -r "$EMAIL_RENDERER" ]] && payload="$(HOSTNAME_VALUE="$(hostname)" SUBJECT="$SUBJECT" BODY="$BODY" \
    MAIL_FROM="$MAIL_FROM" ADMIN_EMAIL="$ADMIN_EMAIL" \
    DEPLOY_ENVIRONMENT="$DEPLOY_ENVIRONMENT" DEPLOY_REVISION="$DEPLOY_REVISION" \
    DEPLOY_SUMMARY="$DEPLOY_SUMMARY" DEPLOYMENT_URL="$DEPLOYMENT_URL" \
    DEPLOY_LOGS_URL="$DEPLOY_LOGS_URL" OCCURRED_AT="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
    render_react_email)"; then
  :
else
  echo "notify: renderer React Email tidak tersedia; memakai fallback kompatibilitas" >&2
  payload="$(HOSTNAME_VALUE="$(hostname)" SUBJECT="$SUBJECT" BODY="$BODY" \
    MAIL_FROM="$MAIL_FROM" ADMIN_EMAIL="$ADMIN_EMAIL" DEPLOY_ENVIRONMENT="$DEPLOY_ENVIRONMENT" \
    python3 - <<'PY'
import html, json, os, re

subject = os.environ["SUBJECT"].strip()
environment = os.environ["DEPLOY_ENVIRONMENT"].strip() or "production"
if subject.lower() == "deploy berhasil":
    email_subject = f"Deploy berhasil \u00b7 {environment}"
    status = "DEPLOY BERHASIL"
    color = "#16A34A"
elif subject.lower() == "deploy gagal":
    email_subject = f"Deploy gagal \u00b7 {environment}"
    status = "DEPLOY GAGAL"
    color = "#DC2626"
else:
    email_subject = f"[Laprakin ops] {subject}"
    status = "PERLU DITINJAU"
    color = "#D97706"

body = os.environ["BODY"].replace("\\n", "\n").strip()
body = re.sub(r"(?i)\\b(api[_-]?key|authorization|bearer|password|secret|smtp[_-]?pass|token)\\b\\s*[:=]\\s*\\S+", r"\\1=[disembunyikan]", body)
sender = os.environ["MAIL_FROM"].strip()
if "<" not in sender:
    sender = f"Laprakin <{sender}>"
escaped_body = "<br>".join(html.escape(line) for line in body.splitlines())
host = html.escape(os.environ["HOSTNAME_VALUE"])
html_body = f"""<!doctype html><html lang="id"><body style="margin:0;padding:24px 12px;background:#F5F7FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#111827"><main style="box-sizing:border-box;width:100%;max-width:600px;margin:0 auto;padding:32px;background:#fff;border:1px solid #E5E7EB;border-radius:12px"><div style="font-size:18px;font-weight:700;margin-bottom:28px">Laprakin</div><div style="font-size:11px;font-weight:700;color:#6B7280;margin-bottom:12px"><span style="display:inline-block;width:8px;height:8px;margin-right:8px;border-radius:999px;background:{color}"></span>{status}</div><h1 style="font-size:23px;line-height:30px;margin:0 0 18px">{html.escape(subject)}</h1><p style="font-size:14px;line-height:21px;margin:0 0 18px">{escaped_body}</p><p style="font-size:13px;line-height:20px;color:#6B7280;margin:0">Host: <span style="font-family:Consolas,monospace;color:#111827">{host}</span></p><hr style="border:0;border-top:1px solid #E5E7EB;margin:28px 0 20px"><p style="font-size:12px;line-height:18px;color:#6B7280;margin:0">Email otomatis dari Laprakin. Tidak perlu membalas email ini.</p></main></body></html>"""
print(json.dumps({
    "from": sender,
    "to": [os.environ["ADMIN_EMAIL"]],
    "subject": email_subject,
    "text": f"{subject}\n\n{body}\n\nHost: {os.environ['HOSTNAME_VALUE']}",
    "html": html_body,
}))
PY
)"
fi

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
