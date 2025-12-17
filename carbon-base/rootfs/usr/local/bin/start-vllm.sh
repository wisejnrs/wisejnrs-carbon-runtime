#!/usr/bin/env bash
set -euo pipefail

# Defaults (can be overridden via docker -e …)
export HF_HOME="${HF_HOME:-/home/carbon/.cache/huggingface}"
export HUGGING_FACE_HUB_TOKEN="${HUGGING_FACE_HUB_TOKEN:-}"
PORT="${VLLM_PORT:-8001}"
MODEL="${VLLM_MODEL:-Qwen/Qwen2.5-7B-Instruct}"
TP="${VLLM_TP:-1}"
EXTRA="${VLLM_EXTRA:-}"

# Ensure cache dir exists and is owned by carbon (best-effort)
install -d -m 0755 "$HF_HOME"
chown -R carbon:carbon "$HF_HOME" || true

exec python3 -m vllm.entrypoints.openai.api_server \
  --host 0.0.0.0 \
  --port "$PORT" \
  --model "$MODEL" \
  --tensor-parallel-size "$TP" \
  ${EXTRA}