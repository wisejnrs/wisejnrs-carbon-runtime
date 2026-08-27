import 'dotenv/config';
import path from 'node:path';

export type ProviderName = 'anthropic' | 'openai' | 'claude-code';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const provider = (process.env.AI_PROVIDER ?? 'anthropic').toLowerCase();
if (provider !== 'anthropic' && provider !== 'openai' && provider !== 'claude-code') {
  throw new Error(
    `AI_PROVIDER must be "anthropic", "openai" or "claude-code", got "${provider}"`,
  );
}

const rootDir = process.cwd();

export const config = {
  discordToken: required('DISCORD_TOKEN'),
  // Register commands to a single guild for instant availability during dev;
  // leave unset to register globally (can take up to an hour to propagate).
  guildId: process.env.DISCORD_GUILD_ID,
  provider: provider as ProviderName,
  anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-8',
  openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4o',
  // "default" inherits whatever model the local Claude Code login uses.
  claudeCodeModel: process.env.CLAUDE_CODE_MODEL ?? 'default',
  // chat: no tools (pure conversation). readonly: skills + read-only tools.
  // full: skills + all tools, auto-approved - anyone in the server can drive them.
  claudeCodeMode: (['chat', 'readonly', 'full'].includes(process.env.CLAUDE_CODE_MODE ?? 'chat')
    ? (process.env.CLAUDE_CODE_MODE ?? 'chat')
    : 'chat') as 'chat' | 'readonly' | 'full',
  systemPrompt:
    process.env.SYSTEM_PROMPT ??
    'You are Carbon, a helpful Discord bot. Keep answers concise - Discord messages are limited to 2000 characters.',
  // Max conversation turns remembered per channel.
  historyLimit: Number(process.env.HISTORY_LIMIT ?? 20),

  // Requires the privileged "Message Content" intent in the Discord developer portal.
  enableMentionChat: process.env.ENABLE_MENTION_CHAT === 'true',
  // Channels (names or IDs, comma-separated) where the bot replies to every message.
  chatChannels: (process.env.CHAT_CHANNELS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase().replace(/^#/, ''))
    .filter(Boolean),

  // Paths
  dataDir: process.env.DATA_DIR ?? path.join(rootDir, 'data'),
  // Channel-per-repo development: channels named after directories under this
  // root become persistent Claude Code dev sessions in that repo.
  repoRoot: process.env.REPO_ROOT ?? '/work/wisejnrs-projects',
  // Optional multi-repo "suite" support: channel names that root a dev session
  // at a shared parent dir (a suite of sibling repos) instead of one repo. All
  // names/paths come from env so no specific org is baked into this public repo.
  suiteChannels: (process.env.SUITE_ROOT_CHANNELS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  suiteSubdir: process.env.SUITE_SUBDIR ?? '',
  suiteName: process.env.SUITE_NAME ?? 'the suite',
  suiteBrain: process.env.SUITE_BRAIN_DIR ?? '',
  // Free-text appended to dev/full-mode system prompts - use it to tell the
  // agent about mounted shares, conventions, anything environment-specific.
  extraContext: process.env.EXTRA_CONTEXT ?? '',
  // Per-channel persona/context, injected when @-mentioned in a shared channel so
  // the bot understands who's in the room. JSON map of channel-name -> guidance,
  // kept in env (CHANNEL_CONTEXTS) so real names/roles stay OUT of the public source.
  channelContexts: ((): Record<string, string> => {
    try {
      const parsed = JSON.parse(process.env.CHANNEL_CONTEXTS ?? '{}');
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
    } catch {
      return {};
    }
  })(),
  corpusDir: process.env.CORPUS_DIR ?? path.join(rootDir, 'corpus'),
  yoloModelPath: process.env.YOLO_MODEL_PATH ?? path.join(rootDir, 'models', 'yolo26s.onnx'),

  // Google Gemini API key for /imagine image generation (optional)
  geminiApiKey: process.env.GEMINI_API_KEY,

  // Knowledge server MCP - remote corpus retrieval for /ask (optional)
  knowledgeMcpUrl: process.env.KNOWLEDGE_MCP_URL,
  knowledgeMcpKey: process.env.KNOWLEDGE_MCP_KEY,
  // Docmost wiki base URL - /docs results link here when set
  docmostUrl: process.env.DOCMOST_URL?.replace(/\/$/, ''),

  // Google Drive corpus source (optional; local corpusDir always works)
  googleDriveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
  googleClientEmail: process.env.GOOGLE_CLIENT_EMAIL,
  googlePrivateKey: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),

  // Health/status HTTP server
  healthPort: Number(process.env.HEALTH_PORT ?? 8300),

  // Voice messages (needs OPENAI_API_KEY for Whisper STT + TTS)
  voiceReplies: process.env.VOICE_REPLIES !== 'false',
  sttModel: process.env.STT_MODEL ?? 'whisper-1',
  ttsModel: process.env.TTS_MODEL ?? 'tts-1',
  ttsVoice: process.env.TTS_VOICE ?? 'onyx',
  // Hume Octave TTS (primary; OpenAI tts-1 is the fallback). humeVoiceName = a saved Hume voice.
  humeApiKey: process.env.HUME_API_KEY,
  humeVoiceName: process.env.HUME_VOICE_NAME ?? 'MrRoboto',
  // 'CUSTOM_VOICE' for your saved/cloned voices, 'HUME_AI' for Hume's stock library.
  humeVoiceProvider: (process.env.HUME_VOICE_PROVIDER === 'HUME_AI' ? 'HUME_AI' : 'CUSTOM_VOICE') as
    | 'CUSTOM_VOICE'
    | 'HUME_AI',
  // Live voice-channel chat: after the "Hey MrRoboto" wake word, follow-ups are
  // accepted without the wake word for this long (ms) so it stays conversational.
  voiceConvWindowMs: Number(process.env.VOICE_CONV_WINDOW_MS ?? 20000),
  // If set to a user ID, the bot auto-joins whatever voice channel that user
  // enters (and leaves when they do) - no /talk needed. Gated to one person.
  voiceAutoJoinUserId: process.env.VOICE_AUTOJOIN_USER_ID ?? '',
  // Owner Discord user IDs (comma-separated), set via OWNER_USER_IDS. Owners
  // bypass the dev-session command guard (see commandGuard.ts); everyone else is
  // blocked from a small set of destructive commands. Unset = no owners.
  ownerUserIds: (process.env.OWNER_USER_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),

  // Proactive features (claude-code provider only)
  commitmentsEnabled: process.env.COMMITMENTS !== 'false',
  commitmentsModel: process.env.COMMITMENTS_MODEL ?? 'claude-haiku-4-5',
  maxCheckinsPerDay: Number(process.env.MAX_CHECKINS_PER_DAY ?? 6),
  memoryEnabled: process.env.MEMORY !== 'false',
  // Pool tools (WisePool / Zodiac eXO via the wisejnrs-aqualink bridge). Needs
  // /work/wisejnrs-projects mounted + uv in the image (both true in the bot).
  poolEnabled: process.env.POOL !== 'false',

  // House stats: append a snapshot of every topic to a CSV on a cron; queryable.
  statsEnabled: process.env.STATS !== 'false',
  statsCron: process.env.STATS_CRON ?? '*/15 * * * *',
  statsFile: process.env.STATS_FILE ?? '/work/wisejnrs-projects/house/data/house-stats.csv',

  // Home-network watchdog: TCP-probe key always-on devices, alert on up/down change.
  // Targets: "name|host|port;..." (Fronius excluded — it sleeps in low light).
  netWatchEnabled: process.env.NET_WATCH !== 'false',
  netWatchChannelId: process.env.NET_WATCH_CHANNEL_ID ?? '1535451741217103995', // #project-house
  netWatchCron: process.env.NET_WATCH_CRON ?? '*/10 * * * *',
  netWatchTargets:
    process.env.NET_WATCH_TARGETS ??
    'NAS|192.168.0.5|5000;Router|192.168.0.17|80;Nextcloud|192.168.0.160|443;Muffy|192.168.0.180|8080;Camera|192.168.0.27|80',

  // Bin night-before reminder (BCC bin day via house/tools/bin.py; BIN_ZONE/BIN_DAY env).
  binReminderEnabled: process.env.BIN_REMINDER !== 'false',
  binReminderChannelId: process.env.BIN_REMINDER_CHANNEL_ID ?? '1535451741217103995', // #project-house
  binReminderTime: process.env.BIN_REMINDER_TIME ?? '18:30', // evening before

  // Daily House Brief digest to #project-house (weather+sun+solar+pool+robovac+holidays).
  houseBriefEnabled: process.env.HOUSE_BRIEF !== 'false',
  houseBriefChannelId: process.env.HOUSE_BRIEF_CHANNEL_ID ?? '1535451741217103995', // #project-house
  houseBriefTime: process.env.HOUSE_BRIEF_TIME ?? '07:00', // Brisbane (process TZ)

  // Pool-alarm watch: poll the eXO and alert #project-house on alarm change.
  poolWatchEnabled: process.env.POOL_WATCH !== 'false',
  poolWatchChannelId: process.env.POOL_WATCH_CHANNEL_ID ?? '1535451741217103995', // #project-house
  poolWatchCron: process.env.POOL_WATCH_CRON ?? '*/10 * * * *', // every 10 min

  // Sky report (weather + sun times + moon phase; Fronius solar merges in).
  skyEnabled: process.env.SKY !== 'false',
  skyLocation: process.env.SKY_LOCATION ?? process.env.BRIEFING_LOCATION ?? 'Brisbane',
  // Fronius solar inverter (local Solar API, no auth on LAN). produce-only setup:
  // PV power now + energy day/year/lifetime.
  solarEnabled: process.env.SOLAR !== 'false',
  froniusUrl: process.env.FRONIUS_URL ?? 'http://192.168.0.168',

  // Meross garage door — persistent service (holds MQTT, reuses saved cloud token).
  garageEnabled: process.env.GARAGE !== 'false',
  garagePort: Number(process.env.GARAGE_PORT ?? 8101),
  garageServer: process.env.GARAGE_SERVER ?? '/work/wisejnrs-projects/house/tools/garage_server.py',
  // "Left open" watch → alert #project-house if open too long / after dark.
  garageWatchEnabled: process.env.GARAGE_WATCH !== 'false',
  garageWatchChannelId: process.env.GARAGE_WATCH_CHANNEL_ID ?? '1535451741217103995',
  garageWatchCron: process.env.GARAGE_WATCH_CRON ?? '*/10 * * * *',
  garageOpenAlertMin: Number(process.env.GARAGE_OPEN_ALERT_MIN ?? 20),
  garageDarkHour: Number(process.env.GARAGE_DARK_HOUR ?? 20), // 8pm Brisbane

  // Deebot "Cinderella" robovac — persistent service (holds MQTT, reuses saved
  // ~7-day creds). Needs the DEEBOT_* env the service reads.
  robovacEnabled: process.env.ROBOVAC !== 'false',
  robovacPort: Number(process.env.ROBOVAC_PORT ?? 8100),
  robovacServer: process.env.ROBOVAC_SERVER ?? '/work/wisejnrs-projects/house/tools/robovac_server.py',

  // Reolink detection loop: cameras FTP a snapshot on AI/motion detection into a
  // NAS drop folder (mounted at REOLINK_DROP_DIR); once a minute we caption new
  // ones with Claude vision and post them to REOLINK_CHANNEL_ID (#project-house).
  // Off by default until the drop folder + cameras are set up (REOLINK=true).
  reolinkEnabled: process.env.REOLINK === 'true',
  reolinkDropDir: process.env.REOLINK_DROP_DIR ?? '/data/NAS-Reolink',
  reolinkChannelId: process.env.REOLINK_CHANNEL_ID ?? '1535451741217103995', // #project-house
  reolinkVisionModel: process.env.REOLINK_VISION_MODEL ?? 'claude-haiku-4-5',
  reolinkMaxPerTick: Number(process.env.REOLINK_MAX_PER_TICK ?? 8),
  // Debounce: one alert per camera, then suppress that camera for this many
  // seconds (collapses a motion event's burst of frames into a single post).
  reolinkCooldownSec: Number(process.env.REOLINK_COOLDOWN_SEC ?? 90),
  // Only alert when YOLO finds a real (security-class) object — kills false
  // triggers from auto white-balance / exposure / lighting shifts. Set false to
  // post every camera-triggered snapshot regardless.
  reolinkRequireDetection: process.env.REOLINK_REQUIRE_DETECTION !== 'false',
  // Extra source: Surveillance Station's own motion snapshots (@Snapshot/@PushServ),
  // so cameras already in SS (the D-Links) also alert to #project-house. Files are
  // flat, named ss_push_<ts>_<camId>_<ts>_1.jpg; map camId -> friendly name.
  reolinkSsDir: process.env.REOLINK_SS_DIR ?? '',
  reolinkSsCameraMap: (() => {
    try {
      return JSON.parse(process.env.REOLINK_SS_CAMERA_MAP ?? '{"2":"DCS-5010L-001","3":"DCS-5010L-002"}') as Record<string, string>;
    } catch {
      return {} as Record<string, string>;
    }
  })(),
  // YOLO object detection: draw labelled boxes ("point out") + list objects.
  reolinkYolo: process.env.REOLINK_YOLO !== 'false',
  reolinkYoloScript: process.env.REOLINK_YOLO_SCRIPT ?? '/work/wisejnrs-projects/house/tools/detect.py',
  reolinkYoloConf: process.env.REOLINK_YOLO_CONF ?? '0.2',
  // yolov8x (largest) is the only model that reliably finds people on the low-res
  // 640x480 D-Link; heavier on CPU but fine for occasional/debounced detections.
  // The higher-res Reolinks will detect cleanly at any model size.
  reolinkYoloWeights: process.env.REOLINK_YOLO_WEIGHTS ?? 'yolov8x.pt',
  // Claude one-line natural description alongside YOLO (set false for YOLO-only).
  reolinkCaption: process.env.REOLINK_CAPTION !== 'false',
  // Persistent GPU detector service (model loaded once, served over localhost) —
  // near-instant detections vs ~3s/frame for the one-shot CLI (kept as fallback).
  reolinkDetectService: process.env.REOLINK_DETECT_SERVICE !== 'false',
  reolinkDetectPort: Number(process.env.REOLINK_DETECT_PORT ?? 8099),
  reolinkDetectServer: process.env.REOLINK_DETECT_SERVER ?? '/work/wisejnrs-projects/house/tools/detect_server.py',

  // Personal WhatsApp bridge (Baileys; unofficial protocol - link via QR)
  whatsappEnabled: process.env.WHATSAPP === 'true',
  whatsappChannel: (process.env.WHATSAPP_CHANNEL ?? 'whatsapp').toLowerCase().replace(/^#/, ''),
  whatsappDefaultCc: process.env.WHATSAPP_DEFAULT_CC ?? '61', // leading-0 numbers assume this country code
  dreamTime: process.env.DREAM_TIME ?? '03:30', // empty string disables
  briefingChannel: process.env.BRIEFING_CHANNEL ?? 'mrroboto',
  briefingTime: process.env.BRIEFING_TIME ?? '07:30', // empty string disables
  briefingLocation: process.env.BRIEFING_LOCATION ?? 'Brisbane',
  // Standalone Node scripts run on a cron via Inngest. SCHEDULED_SCRIPTS holds
  // "id|cron|/abs/path.mjs" entries separated by ";" (cron may carry a TZ=
  // prefix); DAILY_BRIEF_SCRIPT/DAILY_BRIEF_CRON is legacy shorthand for the
  // daily-brief entry. Each id also gets an on-demand mrroboto/<id>.run event.
  scheduledScripts: [
    ...(process.env.DAILY_BRIEF_SCRIPT
      ? [
          {
            id: 'daily-brief',
            cron: process.env.DAILY_BRIEF_CRON ?? '45 20 * * *',
            script: process.env.DAILY_BRIEF_SCRIPT,
          },
        ]
      : []),
    ...(process.env.SCHEDULED_SCRIPTS ?? '')
      .split(';')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [id, cron, script] = entry.split('|').map((part) => part.trim());
        if (!id || !cron || !script) {
          throw new Error(`SCHEDULED_SCRIPTS entry must be "id|cron|/path.mjs", got "${entry}"`);
        }
        return { id, cron, script };
      }),
  ],
  // Microsoft 365 work calendar/email via an Azure AD app (client-credentials flow)
  azureClientId: process.env.AZURE_AD_CLIENT_ID,
  azureClientSecret: process.env.AZURE_AD_CLIENT_SECRET,
  azureTenantId: process.env.AZURE_AD_TENANT_ID,
  workEmail: process.env.WORK_EMAIL ?? '',
  graphEnabled: Boolean(
    process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET && process.env.AZURE_AD_TENANT_ID,
  ),
};
