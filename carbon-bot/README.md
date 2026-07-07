# carbon-bot

Full TypeScript rewrite of the old `Carbon.Bot` .NET 8 / Discord.Net solution — every bot
feature working, including the ones that were stubbed or never wired up in the .NET version.
The AI layer supports **Claude or OpenAI**, switchable via config.

## Commands

| Command | Description |
|---|---|
| `/ping` | Health check with gateway latency |
| `/userinfo` | Your Discord tag and ID (ephemeral) |
| `/cat` | Random cat picture (cataas.com) |
| `/ask <message>` | RAG-grounded AI answer over the ingested corpus, with per-channel conversation history and source citations |
| `/corpus` | Re-ingest the knowledge corpus from `./corpus` and (optionally) a Google Drive folder — requires Manage Server |
| `/yolov <image>` | YOLOv8 object detection; replies with an annotated image and labels |

Also included:

- **Mention chat** (`ENABLE_MENTION_CHAT=true`) — @mention the bot to chat, RAG-grounded.
  Requires the privileged *Message Content* intent in the developer portal.
- **History audit DB** — every command is logged to SQLite (`data/carbon-bot.db`), the port
  of the old `History` entity.
- **Health server** — `GET /ping` and `GET /status` (JSON: uptime, guilds, corpus size,
  history count) on port 8300. This replaces the old web portal.

## Architecture

- **discord.js v14** on Node 22, TypeScript, ESM.
- **AI providers** (`src/ai/`): Anthropic (`claude-opus-4-8`, adaptive thinking) or OpenAI
  (`gpt-4o`), selected by `AI_PROVIDER`.
- **RAG** (`src/rag/`): local **bge-small-en-v1.5** embeddings via transformers.js (same
  model as the Wise corpus pipeline — no API key needed, downloads once to `data/hf-cache`),
  vectors in embedded **LanceDB** (`data/lancedb`). Ingests `.txt/.md/.html/.csv/.json/.pdf`
  from `./corpus`, plus Google Docs/PDFs/text from a Drive folder via service account.
- **YOLO** (`src/yolo/`): `models/yolov8s.onnx` (carried over from the .NET bot) on
  onnxruntime-node; letterboxed preprocessing with sharp, NMS, SVG-composited boxes.

## Setup

1. Create a bot at <https://discord.com/developers/applications>, grab the token, invite it
   with the `applications.commands` + `bot` scopes.
2. `cp .env.example .env` and fill in `DISCORD_TOKEN` plus an API key
   (`ANTHROPIC_API_KEY` or `OPENAI_API_KEY` + `AI_PROVIDER=openai`).
3. The YOLO model is not committed (43 MB, public repo). Copy it in:
   `cp /work/wisejnrs-projects/attic/Carbon-Bot/Source/Carbon.Bot.Core/Resources/YoLo/yolov8s.onnx models/`
4. Drop documents into `./corpus`, run `/corpus` in Discord to index them.
5. Set `DISCORD_GUILD_ID` while testing — guild commands register instantly.

## Run

```bash
# Local dev (hot reload)
npm install
npm run dev

# Smoke test (YOLO + RAG pipelines, no Discord needed)
npm run smoke

# Production build
npm run build && npm start

# Docker, from the repo root
docker compose --profile bot up -d --build carbon-bot
curl localhost:8300/status
```

Secrets live only in `carbon-bot/.env`, which is gitignored — this repo is public,
so never commit real tokens. `data/`, `corpus/` contents, and `models/*.onnx` are
gitignored too.
