#!/usr/bin/env bash
#
# Builds the app, starts the worker, runs the WebSocket tests against it, and
# stops it again. `wrangler dev` serves plain HTTP on localhost, so the tests
# talk ws:// — wss:// is only for a deployed worker.
#
# The port is overridable, so this does not fight a worker you already have up:
#   PORT=8799 ./test-local.sh
set -euo pipefail
set -x

# Overridable, so a run of this does not collide with a worker you already have
# up: PORT=8799 ./test-local.sh
PORT=${PORT:-8787}
# Named so it can be recognised among whatever else is in the temporary
# directory a week later. `mktemp` returns an absolute path, and the run says
# what it is at the end either way.
LOG=$(mktemp -t chess-visualizer-worker-XXXXXX.log)

npm run build

# Job control, so that a background job is put in a process group of its own
# whose leader is exactly the pid `$!` reports — which is what makes killing
# the group possible at all.
#
# `setsid` was the obvious way to do this and does not work here: it forks when
# the process is not already a group leader, so `$!` is the parent that exits
# at once, and the group actually created has a different number that the shell
# never sees. `kill -- -$!` then names a group nobody is in, and the real
# process — a `workerd` holding a port, a `wrangler tail` writing to a log —
# goes on running after the script that started it has finished.
set -m

# In its own group, so stopping it takes the runtime down with it: `wrangler
# dev` is a wrapper around a `workerd` two levels below it, and a signal sent
# to the wrapper alone does not reach the process that holds the port.
npx wrangler dev --port "$PORT" > "$LOG" 2>&1 &
WORKER=$!
# EXIT alone is not enough: a shell terminated by a signal it does not trap
# never runs it, and the worker is in a process group of its own, out of reach
# of the Ctrl+C that went to this one — so interrupting would leave a worker
# holding the port. On a signal the cleanup runs twice; the kill does nothing
# the second time.
#
# The worker's own output is kept whether the run passed or failed, and where
# it is said plainly at the end. A test that fails because the object threw
# leaves its evidence only there — and a run that passed is still worth
# reading, since the object says things about itself that no assertion asks
# about.
STATUS=1
cleanup() {
  kill -- -$WORKER 2>/dev/null || true
  # Tracing off for the last word, so that it is the last word rather than one
  # more line of `+ echo` among the rest.
  set +x
  echo
  echo "the worker's own output, including anything it threw:"
  echo "  $(readlink -f "$LOG")"
}
trap cleanup EXIT INT TERM

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


STATUS=0
WS_BASE="ws://127.0.0.1:$PORT" npm run test:ws || STATUS=$?
exit "$STATUS"
