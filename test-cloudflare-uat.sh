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

# What `cleanup` reads to decide whether the deployed worker is deleted, and
# so the answer to "did the tests pass?" while they have not yet been asked.
# It starts at "no": deleting the worker takes its logs with it and cannot be
# undone, whereas leaving one up costs the printed `wrangler delete` below.
# Between two unequal mistakes, this makes the recoverable one.
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

# Only a run that finished and passed lowers STATUS, so an interrupted run is
# left where it started — with the failures, which is where it belongs: it has
# not passed, and the worker it was testing is worth keeping.
#
# Setting it to 0 up here instead would have meant a Ctrl-C during the tests —
# the long part of the script, and the likeliest moment to interrupt — reading
# as a pass, and the worker being deleted with its logs.
if npm run test:ws; then
  STATUS=0
else
  # The suites' own exit code, not merely "something failed", so that what
  # this script exits with is what they said.
  STATUS=$?
fi
exit "${STATUS}"
