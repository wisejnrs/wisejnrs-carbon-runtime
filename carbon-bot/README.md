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
- **Chat channels** (`CHAT_CHANNELS=mrroboto`) — channels (names or IDs) where the bot
  replies to *every* message, no mention needed. Same intent requirement.
- **History audit DB** — every command is logged to SQLite (`data/carbon-bot.db`), the port
  of the old `History` entity.
- **Health server** — `GET /ping` and `GET /status` (JSON: uptime, guilds, corpus size,
  history count) on port 8300. This replaces the old web portal.

## Architecture

- **discord.js v14** on Node 22, TypeScript, ESM.
- **AI providers** (`src/ai/`): Anthropic (`claude-opus-4-8`, adaptive thinking), OpenAI
  (`gpt-4o`), or `claude-code` — the Claude Agent SDK driving the machine's authenticated
  Claude Code CLI (subscription login, no API key). Selected by `AI_PROVIDER`.
  `CLAUDE_CODE_MODE` gates capability: `chat` (no tools, default), `readonly`
  (skills + Read/Grep/Glob), or `full` (skills + all tools auto-approved — anyone who
  can message the bot can drive them; trusted servers only).
- **RAG** (`src/rag/`): retrieval prefers the **remote knowledge server** when
  `KNOWLEDGE_MCP_URL`/`KNOWLEDGE_MCP_KEY` are set — an MCP `semantic_search` call against
  the already-indexed corpus. Fallback is the local store: **bge-small-en-v1.5**
  embeddings via transformers.js (no API key, downloads once to `data/hf-cache`) in
  embedded **LanceDB** (`data/lancedb`), fed by `/corpus` from `.txt/.md/.html/.csv/.json/.pdf`
  files in `./corpus` plus Google Docs/PDFs/text from a Drive folder via service account.
- **YOLO** (`src/yolo/`): `models/yolov8s.onnx` (carried over from the .NET bot) on
  onnxruntime-node; letterboxed preprocessing with sharp, NMS, SVG-composited boxes.

## Setup

1. Create a bot at <https://discord.com/developers/applications>, grab the token, invite it
   with the `applications.commands` + `bot` scopes.
2. `cp .env.example .env` and fill in `DISCORD_TOKEN` plus an API key
   (`ANTHROPIC_API_KEY` or `OPENAI_API_KEY` + `AI_PROVIDER=openai`).
3. The YOLO model is not committed (43 MB, public repo). Copy it in:
   export one with `docker run --rm -v $PWD/models:/export -w /export ultralytics/ultralytics:latest-cpu yolo export model=yolo26s.pt format=onnx`
4. Drop documents into `./corpus`, run `/corpus` in Discord to index them.
5. Set `DISCORD_GUILD_ID` while testing — guild commands register instantly.

## Google (Gmail + Calendar) MCP setup

The bot host registers two user-scope MCP servers (`claude mcp add ... -s user`):
`gmail` (`npx -y @gongrzhe/server-gmail-autoauth-mcp`) and `google-calendar`
(`npx -y @cocal/google-calendar-mcp`, env `GOOGLE_OAUTH_CREDENTIALS` pointing at the
OAuth client JSON). One-time OAuth, done in a browser logged into the target account:

1. console.cloud.google.com → project → enable **Gmail API** + **Google Calendar API**
   → OAuth consent screen (External/Testing, add the account as test user)
   → Credentials → **OAuth client ID → Desktop app** → download JSON.
2. Save it as `~/.gmail-mcp/gcp-oauth.keys.json` on the bot host.
3. Run the consent flows (each opens a browser / prints a URL):
   `npx -y @gongrzhe/server-gmail-autoauth-mcp auth`
   `GOOGLE_OAUTH_CREDENTIALS=~/.gmail-mcp/gcp-oauth.keys.json npx -y @cocal/google-calendar-mcp auth`
4. Restart the bot container. Token dirs `~/.gmail-mcp` and
   `~/.config/google-calendar-mcp` are already mounted by docker-compose.

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
