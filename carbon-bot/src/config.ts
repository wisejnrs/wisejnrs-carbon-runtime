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
  corpusDir: process.env.CORPUS_DIR ?? path.join(rootDir, 'corpus'),
  yoloModelPath: process.env.YOLO_MODEL_PATH ?? path.join(rootDir, 'models', 'yolo26s.onnx'),

  // Google Gemini API key for /imagine image generation (optional)
  geminiApiKey: process.env.GEMINI_API_KEY,

  // Wise knowledge server MCP - remote corpus retrieval for /ask (optional)
  knowledgeMcpUrl: process.env.KNOWLEDGE_MCP_URL,
  knowledgeMcpKey: process.env.KNOWLEDGE_MCP_KEY,

  // Google Drive corpus source (optional; local corpusDir always works)
  googleDriveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
  googleClientEmail: process.env.GOOGLE_CLIENT_EMAIL,
  googlePrivateKey: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),

  // Health/status HTTP server
  healthPort: Number(process.env.HEALTH_PORT ?? 8300),
};
