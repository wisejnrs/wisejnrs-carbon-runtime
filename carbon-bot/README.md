# carbon-bot

A self-hostable **Discord AI assistant** in TypeScript. It answers questions grounded in
your own document corpus (RAG), runs on **Claude, OpenAI, or your local Claude Code login**,
does vision (YOLO object detection) and image generation, and can optionally act as a
full agent — running coding sessions, home-automation tools, voice chat, scheduled
briefings and more. Everything beyond the core is **opt-in via environment variables**, so
a minimal install is just a token and one API key.

> Originally a full rewrite of an old `Carbon.Bot` .NET 8 / Discord.Net solution — every
> feature ported and then some. discord.js v14 · Node 22 · TypeScript · ESM.

---

## Contents
- [Features](#features)
- [Slash commands](#slash-commands)
- [Prerequisites](#prerequisites)
- [Quick start (Docker Compose)](#quick-start-docker-compose)
- [Local development](#local-development)
- [Discord application setup](#discord-application-setup)
- [Configuration](#configuration)
- [Optional integrations](#optional-integrations)
- [Health & monitoring](#health--monitoring)
- [Security](#security)
- [Troubleshooting](#troubleshooting)

---

## Features

**Core**
- **RAG Q&A** (`/ask`) over your own documents, with per-channel conversation history and
  source citations.
- **Pluggable AI**: Anthropic (`claude-opus-4-8`, adaptive thinking), OpenAI (`gpt-4o`), or
  `claude-code` (drives an authenticated local Claude Code CLI — subscription login, no API
  key). Switch with `AI_PROVIDER`.
- **Mention & channel chat**: @mention the bot, or nominate channels where it replies to
  every message (needs the privileged *Message Content* intent).
- **Vision**: `/yolov` runs YOLOv8 object detection and returns an annotated image.
- **Image generation**: `/imagine` (via the configured provider).
- **History audit DB**: every command logged to SQLite.
- **Health server**: `GET /ping` and `GET /status` for uptime/guilds/corpus/history.

**Optional / advanced** (all env-gated — off by default)
- **Knowledge server**: prefer a remote MCP corpus (`semantic_search`) over the local store.
- **Google Workspace**: Gmail + Calendar via MCP.
- **Voice**: speech-to-text + text-to-speech in voice channels (OpenAI, optional Hume TTS).
- **Channel-per-repo dev sessions**: a channel named after a repo becomes a persistent
  Claude Code coding agent working in that repo.
- **Proactive scheduling** via Inngest: morning briefing, scheduled scripts, check-ins.
- **Social posting** (`/post`): LinkedIn, Instagram.
- **WhatsApp bridge** (unofficial; use at your own risk).
- **Home-automation tools** (Home Assistant + others) exposed to the agent, owner-gated.

See [`SERVICE-TOGGLES.md`](../SERVICE-TOGGLES.md) and [`CONFIGURATION.md`](../CONFIGURATION.md)
for the full matrix, and [`.env.example`](.env.example) for every variable.

---

## Slash commands

| Command | What it does |
|---|---|
| `/ping` | Health check with gateway latency |
| `/userinfo` | Your Discord tag and ID (ephemeral) |
| `/ask <message>` | RAG-grounded AI answer over the corpus, with citations |
| `/corpus` | Re-ingest the corpus from `./corpus` (+ optional Drive) — *Manage Server* only |
| `/yolov <image>` | YOLOv8 object detection → annotated image + labels |
| `/imagine <prompt>` | Generate an image |
| `/docs <query>` | Search a Docmost wiki (autocomplete) |
| `/market` | Market snapshot (no API key; Yahoo Finance quotes) |
| `/weather <location>` | Current weather |
| `/cat` | Random cat picture |
| `/provider` | Show/switch the active AI provider |
| `/post` | Post to a configured social channel |
| `/talk`, `/leave` | Join / leave a voice channel (voice features) |
| `/lab` | Scaffold a new "lab" project (agent dev sessions) |

*(Exact set depends on which features you enable.)*

---

## Prerequisites

- A **Discord application + bot token** ([developer portal](https://discord.com/developers/applications)).
- **One AI credential**: an `ANTHROPIC_API_KEY`, an `OPENAI_API_KEY`, **or** an
  authenticated local `claude` CLI (for `AI_PROVIDER=claude-code`).
- **Either** Docker + Docker Compose (recommended) **or** Node.js ≥ 20 (22 recommended).

Nothing else is required for a basic install — RAG embeddings run locally (no API key) and
download once.

---

## Quick start (Docker Compose)

From the repository root:

```bash
# 1. Configure
cp carbon-bot/.env.example carbon-bot/.env
$EDITOR carbon-bot/.env            # set DISCORD_TOKEN + one AI key (see Configuration)

# 2. Build & run just the bot
docker compose --profile bot up -d --build carbon-bot

# 3. Verify
docker compose logs -f carbon-bot
curl localhost:8300/status
```

The compose service mounts `carbon-bot/.env`, a `corpus/` folder (drop documents here, then
run `/corpus` in Discord), and a named volume for data (vectors, SQLite, model cache).

---

## Local development

```bash
cd carbon-bot
npm install
cp .env.example .env               # fill in DISCORD_TOKEN + an AI key

npm run dev                        # hot-reload (tsx watch)
npm run smoke                      # test YOLO + RAG pipelines, no Discord needed
npm run build && npm start         # production build → node dist/index.js
npm run typecheck                  # tsc --noEmit
npm test                           # vitest
```

**YOLO model** is not committed (large binary, public repo). Provide one at the path in
`YOLO_MODEL_PATH` (default `./models/yolo26s.onnx`), e.g.:

```bash
docker run --rm -v $PWD/models:/export -w /export ultralytics/ultralytics:latest-cpu \
  yolo export model=yolo26s.pt format=onnx
```

---

## Discord application setup

1. [Developer portal](https://discord.com/developers/applications) → **New Application** →
   **Bot** → copy the **token** into `DISCORD_TOKEN`.
2. **Invite** the bot with the `bot` + `applications.commands` scopes (OAuth2 → URL
   Generator). Grant it permission to read/send messages in the channels you want.
3. For mention/channel chat, enable the **Message Content Intent** (Bot → Privileged Gateway
   Intents), then set `ENABLE_MENTION_CHAT=true` and/or `CHAT_CHANNELS=...`.
4. While testing, set `DISCORD_GUILD_ID` — guild commands register **instantly** (global
   commands can take up to an hour to propagate).

---

## Configuration

Copy `.env.example` → `.env`. The essentials:

| Variable | Required | Purpose |
|---|---|---|
| `DISCORD_TOKEN` | ✅ | Bot token |
| `DISCORD_GUILD_ID` | – | Register commands to one guild instantly (dev) |
| `AI_PROVIDER` | – | `anthropic` (default), `openai`, or `claude-code` |
| `ANTHROPIC_API_KEY` | ✳️ | Required if `AI_PROVIDER=anthropic` |
| `OPENAI_API_KEY` | ✳️ | Required if `AI_PROVIDER=openai` |
| `ENABLE_MENTION_CHAT` | – | Reply to @mentions (needs Message Content intent) |
| `CHAT_CHANNELS` | – | Channels where every message is answered |
| `KNOWLEDGE_MCP_URL` / `_KEY` | – | Use a remote MCP corpus for RAG |
| `HEALTH_PORT` | – | Health server port (default `8300`) |
| `DATA_DIR` / `CORPUS_DIR` | – | Storage locations |
| `OWNER_USER_IDS` | – | Discord IDs that bypass the destructive-command guard |
| `GIT_AUTHOR_NAME` / `_EMAIL` | – | Author used for agent-created git commits |

✳️ = one AI credential required. See [`.env.example`](.env.example) for the **full** list
(voice, social, WhatsApp, Microsoft 365, Inngest scheduling, home automation, tuning).

---

## Optional integrations

### Google (Gmail + Calendar) via MCP
The host registers two user-scope MCP servers: `gmail`
(`@gongrzhe/server-gmail-autoauth-mcp`) and `google-calendar` (`@cocal/google-calendar-mcp`).
One-time OAuth, in a browser logged into the target account:

1. [console.cloud.google.com](https://console.cloud.google.com) → enable **Gmail API** +
   **Google Calendar API** → OAuth consent screen (External/Testing; add the account as a
   test user) → Credentials → **OAuth client ID → Desktop app** → download JSON.
2. Save it as `~/.gmail-mcp/gcp-oauth.keys.json` on the host.
3. Run the consent flows:
   ```bash
   npx -y @gongrzhe/server-gmail-autoauth-mcp auth
   GOOGLE_OAUTH_CREDENTIALS=~/.gmail-mcp/gcp-oauth.keys.json npx -y @cocal/google-calendar-mcp auth
   ```
4. Restart the bot. The token dirs are mounted by docker-compose.

### RAG corpus
Retrieval prefers a **remote knowledge server** when `KNOWLEDGE_MCP_URL`/`_KEY` are set
(MCP `semantic_search`). Otherwise it uses the **local store**: `bge-small-en-v1.5`
embeddings via transformers.js (no API key; downloads once) in embedded **LanceDB**, fed by
`/corpus` from `.txt/.md/.html/.csv/.json/.pdf` files in `./corpus`, plus optional Google
Drive docs via a service account (`GOOGLE_DRIVE_FOLDER_ID` + `GOOGLE_CLIENT_EMAIL` +
`GOOGLE_PRIVATE_KEY`).

### Other
- **Voice** — `STT_MODEL`/`TTS_MODEL` (+ optional `HUME_*`). See `SETUP-social.md` / `.env.example`.
- **Social posting** — `LINKEDIN_*`, `INSTAGRAM_*`; see [`SETUP-social.md`](SETUP-social.md).
- **Proactive scheduling** — Inngest sidecar; `SCHEDULED_SCRIPTS`, `DAILY_BRIEF_*`.
- **Channel-per-repo dev** — set `REPO_ROOT`; a channel named after a repo dir becomes a
  persistent coding agent for it.
- **WhatsApp bridge** — `WHATSAPP=true` (unofficial protocol; account-ban risk is yours).

---

## Health & monitoring

The bot serves a small HTTP endpoint (default port `8300`):

```bash
curl localhost:8300/ping      # -> ok
curl localhost:8300/status    # JSON: uptime, guilds, corpus size, history count
```

---

## Security

- **All secrets live only in `carbon-bot/.env`**, which is **gitignored**. This repo is
  public — never commit real tokens. `data/`, `corpus/` contents, `models/*.onnx`, and any
  `*.keys.json` are gitignored too.
- The destructive-command guard blocks a set of dangerous shell commands for non-owners in
  agent/dev sessions; list trusted IDs in `OWNER_USER_IDS`.
- `CLAUDE_CODE_MODE=full` and the home-automation/dev tools auto-approve actions for anyone
  who can message the bot — **only enable on trusted servers**.

---

## Troubleshooting

- **Commands don't appear** — set `DISCORD_GUILD_ID` for instant registration; global
  commands can take up to an hour.
- **Bot won't chat on mention** — enable the **Message Content Intent** and set
  `ENABLE_MENTION_CHAT=true`.
- **`/yolov` errors** — provide a model at `YOLO_MODEL_PATH` (see Local development).
- **RAG returns nothing** — drop files in `./corpus` and run `/corpus` (needs *Manage Server*).

More docs: [`QUICK-START.md`](../QUICK-START.md) · [`CONFIGURATION.md`](../CONFIGURATION.md) ·
[`SERVICE-TOGGLES.md`](../SERVICE-TOGGLES.md) · [`DEPLOYMENT.md`](../DEPLOYMENT.md) ·
[`DATABASES.md`](../DATABASES.md) · [`CONTRIBUTING.md`](../CONTRIBUTING.md).

## License
See [`LICENSE`](../LICENSE).
