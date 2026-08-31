#!/usr/bin/env bash

# Runs all suites against the current prod deployment

set -exm

#npx wrangler login

readonly APP_NAME=chess-visualizer

export WS_BASE=wss://${APP_NAME}.ivan-a87.workers.dev

node worker/tests/waitFor.mjs 90

readonly LOG="cloudflare-test-$(date +%Y%m%d-%H%M%S).log"
npx wrangler tail ${APP_NAME} > "${LOG}" 2>&1 &
readonly TAIL=$!

for _ in $(seq 1 20); do
  [ -s "${LOG}" ] && break
  sleep 0.5
done

cleanup() {
  kill -- -"${TAIL}" 2>/dev/null || true
  set +x
  echo
  echo "the worker's own output: ${LOG}"
}
trap cleanup EXIT INT TERM

# run the tests:
STATUS=0
npm run test:ws || STATUS=$?
exit "${STATUS}"
