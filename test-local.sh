#!/usr/bin/env bash
#
# Builds the app, starts the worker, runs the WebSocket tests against it, and
# stops it again. `wrangler dev` serves plain HTTP on localhost, so the tests
# talk ws:// — wss:// is only for a deployed worker.
#
# The port is overridable, so this does not fight a worker you already have up:
#   PORT=8799 ./test-local.sh
set -euo pipefail
set -ex

# Overridable, so a run of this does not collide with a worker you already have
# up: PORT=8799 ./test-local.sh
PORT=${PORT:-8787}
LOG=$(mktemp)

npm run build

# Its own process group, so stopping it takes the runtime down with it rather
# than leaving workerd holding the port.
setsid npx wrangler dev --port "$PORT" > "$LOG" 2>&1 &
WORKER=$!
# EXIT alone is not enough: a shell terminated by a signal it does not trap
# never runs it, and `setsid` has put the worker in its own process group, out
# of reach of the Ctrl+C that went to this one — so interrupting would leave a
# worker holding the port. On a signal the cleanup runs twice; kill and rm both
# do nothing the second time.
trap 'kill -- -$WORKER 2>/dev/null || true; rm -f "$LOG"' EXIT INT TERM

echo "waiting for the worker to come up..."
for _ in $(seq 1 60); do
  if curl -sf -o /dev/null "http://127.0.0.1:$PORT/"; then
    break
  fi
  sleep 0.5
done

if ! curl -sf -o /dev/null "http://127.0.0.1:$PORT/"; then
  echo "the worker never came up:"
  tail -20 "$LOG"
  exit 1
fi


WS_BASE="ws://127.0.0.1:$PORT" npm run test:ws
