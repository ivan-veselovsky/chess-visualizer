set -ex

#npx wrangler login 

npm run build 

#readonly APP_NAME=chess-ws-test
readonly APP_NAME=chess-visualizer-uat

npx wrangler deploy --name ${APP_NAME}

export WS_BASE=wss://${APP_NAME}.ivan-a87.workers.dev

# `wrangler deploy` returns when Cloudflare has accepted the upload, not when
# every edge is serving it — and on a redeploy the previous version answers
# throughout, so waiting for a 200 proves nothing. This waits until a Durable
# Object answers a question, which is what the suites actually need.
node worker/tests/waitFor.mjs 90

npm run test:ws 

#npx wrangler delete --force --name ${APP_NAME}
