#!/usr/bin/env bash
set -euo pipefail

HOST="${OLLAMA_HOST:-127.0.0.1:11434}"

echo "[ollama-pull] waiting for ${HOST} ..."
for i in {1..60}; do
  if curl -fsS "http://${HOST}/" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

pull_if_set() {
  local tag="$1"
  if [ -n "$tag" ]; then
    echo "[ollama-pull] pulling ${tag}"
    /usr/local/bin/ollama pull "${tag}" || true
  fi
}

# Optional user-provided tags
pull_if_set "${OLLAMA_PULL_GPT_OSS:-}"
pull_if_set "${OLLAMA_PULL_GEMMA3:-}"
pull_if_set "${OLLAMA_PULL_QWEN3:-}"

# Sensible fallbacks (ignore failures if gated/unavailable)
echo "[ollama-pull] pulling common fallbacks..."
/usr/local/bin/ollama pull llama3:8b-instruct || true
/usr/local/bin/ollama pull gemma2:9b-instruct || true
/usr/local/bin/ollama pull qwen2.5:7b-instruct || true

echo "[ollama-pull] done"