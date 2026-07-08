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
  // Free-text appended to dev/full-mode system prompts - use it to tell the
  // agent about mounted shares, conventions, anything environment-specific.
  extraContext: process.env.EXTRA_CONTEXT ?? '',
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

  // Proactive features (claude-code provider only)
  commitmentsEnabled: process.env.COMMITMENTS !== 'false',
  commitmentsModel: process.env.COMMITMENTS_MODEL ?? 'claude-haiku-4-5',
  maxCheckinsPerDay: Number(process.env.MAX_CHECKINS_PER_DAY ?? 6),
  memoryEnabled: process.env.MEMORY !== 'false',
  // Personal WhatsApp bridge (Baileys; unofficial protocol - link via QR)
  whatsappEnabled: process.env.WHATSAPP === 'true',
  whatsappChannel: (process.env.WHATSAPP_CHANNEL ?? 'whatsapp').toLowerCase().replace(/^#/, ''),
  whatsappDefaultCc: process.env.WHATSAPP_DEFAULT_CC ?? '61', // leading-0 numbers assume this country code
  dreamTime: process.env.DREAM_TIME ?? '03:30', // empty string disables
  briefingChannel: process.env.BRIEFING_CHANNEL ?? 'mrroboto',
  briefingTime: process.env.BRIEFING_TIME ?? '07:30', // empty string disables
  briefingLocation: process.env.BRIEFING_LOCATION ?? 'Brisbane',
};
