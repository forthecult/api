#!/usr/bin/env bash
# Optional DNS checks for deliverability (run in CI with DOMAIN=forthecult.store).
set -euo pipefail
DOMAIN="${DOMAIN:-}"
if [[ -z "$DOMAIN" ]]; then
  echo "DOMAIN not set — skipping DNS checks."
  exit 0
fi

echo "Checking MX for $DOMAIN ..."
dig +short MX "$DOMAIN" | head -n 5 || true

echo "Checking TXT (SPF) for $DOMAIN ..."
dig +short TXT "$DOMAIN" | head -n 10 || true

echo "Checking DMARC for _dmarc.$DOMAIN ..."
dig +short TXT "_dmarc.$DOMAIN" | head -n 5 || true

echo "DNS probe complete (informational)."
