#!/usr/bin/env bash
set -euo pipefail

REDIS_HOST="${REDIS_HOST:-redis}"
WORKSPACE_ROOT="${WORKSPACE_ROOT:-/data/workspaces}"
COMPILE_CMD="${COMPILE_CMD:-bash -lc 'echo "No COMPILE_CMD set"; exit 1'}"

echo "[worker] redis=$REDIS_HOST workspace=$WORKSPACE_ROOT"
echo "[worker] COMPILE_CMD=$COMPILE_CMD"

append_log () {
  local jobId="$1"
  local line="$2"
  redis-cli -h "$REDIS_HOST" RPUSH "job:$jobId:logs" "$line" >/dev/null
}

while true; do
  read -r _key payload < <(redis-cli -h "$REDIS_HOST" BRPOP queue:jobs 0 | tr "\n" " ")
  jobId="$(echo "$payload" | sed -n 's/.*"jobId":"\([^"]*\)".*/\1/p')"
  project="$(echo "$payload" | sed -n 's/.*"project":"\([^"]*\)".*/\1/p')"

  if [ -z "${jobId:-}" ]; then
    echo "[worker] bad payload: $payload"
    continue
  fi

  append_log "$jobId" "[worker] picked job for project=$project"
  append_log "$jobId" "[worker] running compile..."

  set +e
  (eval "$COMPILE_CMD") 2>&1 | while IFS= read -r line; do
    append_log "$jobId" "$line"
  done
  status=${PIPESTATUS[0]}
  set -e

  if [ "$status" -eq 0 ]; then
    append_log "$jobId" "[worker] ✅ compile ok"
  else
    append_log "$jobId" "[worker] ❌ compile failed (exit=$status)"
  fi
done
