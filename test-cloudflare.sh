#!/usr/bin/env bash
#
# Builds the app, deploys it under a name of its own, runs the WebSocket tests
# against the real thing, and takes it down again.
#
# What this catches that the local run cannot is timing. On a loopback, two
# messages sent one after the other arrive together; over a real network they
# do not, and a test that waited for the first and asserted on the second
# passes locally and fails here. That is the point of running it.
set -ex

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

#npx wrangler login

npm run build

readonly APP_NAME=chess-visualizer-test

npx wrangler deploy --name ${APP_NAME}

export WS_BASE=wss://${APP_NAME}.ivan-a87.workers.dev

# `wrangler deploy` returns when Cloudflare has accepted the upload, not when
# every edge is serving it — and on a redeploy the previous version answers
# throughout, so waiting for a 200 proves nothing. This waits until a Durable
# Object answers a question, which is what the suites actually need.
node worker/tests/waitFor.mjs 90

# What the Worker itself says, kept on this machine.
#
# `wrangler tail` is a live stream: it shows what happens while somebody is
# attached and keeps nothing. So it is attached here, before the tests start,
# and its output goes to a file — which is what makes a failure readable
# afterwards instead of scrolled past. The deployed Worker also keeps its own
# logs at Cloudflare, per the observability setting in wrangler.jsonc; this is
# the copy that needs no dashboard.
readonly LOG="cloudflare-test-$(date +%Y%m%d-%H%M%S).log"
npx wrangler tail ${APP_NAME} > "${LOG}" 2>&1 &
readonly TAIL=$!

# Give it a moment to attach, or the first exchange goes unrecorded. Bounded:
# if it never connects the tests still run, they simply run unwatched.
for _ in $(seq 1 20); do
  [ -s "${LOG}" ] && break
  sleep 0.5
done

STATUS=1
cleanup() {
  # The whole group: `npx` is a wrapper around a wrapper, and killing the pid
  # the shell reports leaves the real process attached to Cloudflare, still
  # writing to the log, after this script is gone.
  kill -- -"${TAIL}" 2>/dev/null || true
  set +x
  echo
  echo "the worker's own output: ${LOG}"
  if [ "${STATUS}" = 0 ]; then
    npx wrangler delete --force --name ${APP_NAME}
  else
    # Left up on purpose: a worker that has just failed is the one worth
    # looking at, and deleting it takes its logs with it.
    echo "${APP_NAME} was left deployed, so it can still be looked at:"
    echo "  npx wrangler tail ${APP_NAME}"
    echo "and deleted when you are done:"
    echo "  npx wrangler delete --force --name ${APP_NAME}"
  fi
}
trap cleanup EXIT INT TERM

STATUS=0
npm run test:ws || STATUS=$?
exit "${STATUS}"
