import fs from 'node:fs/promises';
import path from 'node:path';
import { AttachmentBuilder } from 'discord.js';
import { config } from './config.js';
import type { AiProvider, ChatProgress } from './ai/index.js';
import { getHistory, pushHistory } from './ai/index.js';
import { askWithRag, type RagAnswer } from './rag/index.js';

// Discord's default upload cap is 10MB; stay under it, and at most 10 attachments.
const MAX_ATTACHMENT_BYTES = 9 * 1024 * 1024;
const MAX_ATTACHMENTS = 10;
// OpenClaw-informed cadence: ~1.5s edit throttle keeps the status live without
// hammering the Discord API.
const PROGRESS_INTERVAL_MS = 1500;

export interface GroundedReply {
  answer: string;
  sources: string[];
  attachments: AttachmentBuilder[];
  skipped: string[]; // produced files too large / too many to attach
  cleanup: () => Promise<void>;
}

/**
 * Shared /ask + channel-chat pipeline: history, RAG retrieval, provider call,
 * output-file collection. `update` receives throttled "Working..." status text
 * for the caller to display; it stops firing once the answer is ready.
 */
export async function runGroundedChat(
  provider: AiProvider,
  channelId: string,
  question: string,
  update: (status: string) => Promise<unknown>,
): Promise<GroundedReply> {
  let done = false;
  let lastUpdate = Date.now();
  const onProgress: ChatProgress = (note) => {
    if (done || Date.now() - lastUpdate < PROGRESS_INTERVAL_MS) return;
    lastUpdate = Date.now();
    void update(`⚙️ Working — ${note}`.slice(0, 1900)).catch(() => {});
  };

  pushHistory(channelId, { role: 'user', content: question });
  try {
    // Full-mode claude-code sessions carry the knowledge MCP tools and search
    // the corpus themselves when relevant; stuffing retrieved excerpts into
    // every question just pollutes unrelated answers with bogus "sources".
    const selfRetrieves = provider.name === 'claude-code' && config.claudeCodeMode === 'full';
    let result: RagAnswer;
    if (selfRetrieves) {
      const chat = await provider.chat(
        getHistory(channelId),
        config.systemPrompt +
          '\n\nWhen a question relates to the user\'s document library, search it with the ' +
          'knowledge MCP tools and cite the source filenames in your answer.',
        onProgress,
      );
      result = { answer: chat.text, sources: [], files: chat.files, workDir: chat.workDir };
    } else {
      result = await askWithRag(provider, getHistory(channelId), question, onProgress);
    }
    pushHistory(channelId, { role: 'assistant', content: result.answer });

    const attachments: AttachmentBuilder[] = [];
    const skipped: string[] = [];
    for (const file of result.files) {
      const stat = await fs.stat(file).catch(() => null);
      if (!stat) continue;
      if (attachments.length >= MAX_ATTACHMENTS || stat.size > MAX_ATTACHMENT_BYTES) {
        skipped.push(`${path.basename(file)} (${(stat.size / 1024 / 1024).toFixed(1)}MB)`);
      } else {
        attachments.push(new AttachmentBuilder(file, { name: path.basename(file) }));
      }
    }

    return {
      answer: result.answer,
      sources: result.sources,
      attachments,
      skipped,
      cleanup: async () => {
        if (result.workDir) await fs.rm(result.workDir, { recursive: true, force: true });
      },
    };
  } finally {
    done = true;
  }
}

export function replyFooter(reply: GroundedReply): string {
  const parts: string[] = [];
  if (reply.sources.length) parts.push(`Sources: ${reply.sources.join(', ')}`);
  if (reply.skipped.length) parts.push(`Not attached (too big): ${reply.skipped.join(', ')}`);
  return parts.length ? `\n-# ${parts.join(' · ')}`.slice(0, 500) : '';
}
