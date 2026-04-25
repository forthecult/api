#!/usr/bin/env bash
set -euo pipefail

if [ -z "${BASE_URL:-}" ]; then
  echo "BASE_URL is required"
  exit 2
fi

failures=0

check_status_lt_500() {
  local name="$1"
  local method="$2"
  local path="$3"
  local body="${4:-}"
  local code
  if [ "$method" = "POST" ]; then
    code="$(curl -sS -o /tmp/runtime-guard-body.txt -w "%{http_code}" \
      -X POST "${BASE_URL}${path}" \
      -H "Content-Type: application/json" \
      --data "${body}")"
  else
    code="$(curl -sS -o /tmp/runtime-guard-body.txt -w "%{http_code}" \
      "${BASE_URL}${path}")"
  fi
  if [ "${code}" -ge 500 ]; then
    echo "FAIL ${name}: HTTP ${code}"
    failures=$((failures + 1))
  else
    echo "PASS ${name}: HTTP ${code}"
  fi
}

check_status_eq_200() {
  local name="$1"
  local path="$2"
  local code
  code="$(curl -sS -o /tmp/runtime-guard-body.txt -w "%{http_code}" "${BASE_URL}${path}")"
  if [ "${code}" -ne 200 ]; then
    echo "FAIL ${name}: expected 200 got ${code}"
    failures=$((failures + 1))
  else
    echo "PASS ${name}: HTTP ${code}"
  fi
}

echo "Running production runtime guard against ${BASE_URL}"

check_status_eq_200 "health" "/api/health"

# Better Auth may expose either endpoint depending on config/version; only fail if both fail.
session_code="$(curl -sS -o /tmp/runtime-guard-body.txt -w "%{http_code}" "${BASE_URL}/api/auth/session")"
get_session_code="$(curl -sS -o /tmp/runtime-guard-body.txt -w "%{http_code}" "${BASE_URL}/api/auth/get-session")"
if [ "${session_code}" -ge 500 ] && [ "${get_session_code}" -ge 500 ]; then
  echo "FAIL auth-session: both endpoints returned 5xx (${session_code}, ${get_session_code})"
  failures=$((failures + 1))
else
  echo "PASS auth-session: (${session_code}, ${get_session_code})"
fi

check_status_lt_500 "products" "GET" "/api/products?forStorefront=1&limit=1&sort=newest"
check_status_lt_500 "coupon-automatic" "POST" "/api/checkout/coupons/automatic" '{"invalid":true}'
check_status_lt_500 "stripe-payment-intent" "POST" "/api/payments/stripe/create-payment-intent" '{"invalid":true}'
check_status_lt_500 "stripe-checkout-session" "POST" "/api/payments/stripe/create-checkout-session" '{"invalid":true}'
check_status_lt_500 "esim-purchase" "POST" "/api/esim/purchase" '{"invalid":true}'

if [ "${failures}" -gt 0 ]; then
  echo "Runtime guard failed with ${failures} failing probe(s)"
  exit 1
fi

echo "Runtime guard passed"
