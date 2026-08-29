# Naive simple version of local script
set -ex

npm run build 

npx wrangler dev &
sleep 10

export WS_BASE=ws://localhost:8787

npm run test:ws 