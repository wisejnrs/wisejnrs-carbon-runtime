import fs from 'node:fs/promises';
import path from 'node:path';
import { AttachmentBuilder } from 'discord.js';
import { config } from './config.js';
import type { AiProvider, ChatProgress } from './ai/index.js';
import { getHistory, pushHistory } from './ai/index.js';
import { askWithRag, type RagAnswer } from './rag/index.js';
import { scheduleExtraction } from './commitments.js';
import { drainSystemEvents, untrustedBlock } from './events.js';
import { activeRecall, recallBlock } from './memory.js';

// Discord's default upload cap is 10MB; stay under it, and at most 10 attachments.
const MAX_ATTACHMENT_BYTES = 9 * 1024 * 1024;
const MAX_ATTACHMENTS = 10;
// OpenClaw-informed cadence: ~1.5s edit throttle keeps the status live without
// hammering the Discord API.
const PROGRESS_INTERVAL_MS = 1500;

export interface ProgressDisplay {
  onNote: ChatProgress;
  finish(): void;
}

// Live activity feed rendered into the "Working" draft message:
//   ⚙️ **Working** · 24s
//   > 🛠️ Bash: run tests
//   > 🔌 gmail search_emails: "in:inbox"
export function createProgressDisplay(
  update: (text: string) => Promise<unknown>,
  title = 'Working',
): ProgressDisplay {
  const started = Date.now();
  const rows: string[] = [];
  let lastEdit = 0;
  let done = false;
  return {
    onNote(note) {
      if (done) return;
      if (rows[rows.length - 1] !== note) rows.push(note);
      if (Date.now() - lastEdit < PROGRESS_INTERVAL_MS) return;
      lastEdit = Date.now();
      const elapsed = Math.round((Date.now() - started) / 1000);
      const feed = rows.slice(-5).map((row) => `> ${row}`).join('\n');
      const step = rows.length > 5 ? ` · step ${rows.length}` : '';
      void update(`⚙️ **${title}** · ${elapsed}s${step}\n${feed}`.slice(0, 1900)).catch(() => {});
    },
    finish() {
      done = true;
    },
  };
}

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
  const display = createProgressDisplay(update);
  const onProgress: ChatProgress = display.onNote;

  pushHistory(channelId, { role: 'user', content: question });
  try {
    // Full-mode claude-code sessions carry the knowledge MCP tools and search
    // the corpus themselves when relevant; stuffing retrieved excerpts into
    // every question just pollutes unrelated answers with bogus "sources".
    const selfRetrieves = provider.name === 'claude-code' && config.claudeCodeMode === 'full';
    const events = drainSystemEvents(channelId);
    const eventContext = events.length
      ? '\n\n' + untrustedBlock('events', events.map((event) => `- ${event.text}`).join('\n'))
      : '';
    let result: RagAnswer;
    if (selfRetrieves) {
      onProgress('💭 checking memory');
      const memoryNote = await activeRecall(question);
      const chat = await provider.chat(
        getHistory(channelId),
        config.systemPrompt +
          '\n\nWhen a question relates to the user\'s document library, search it with the ' +
          'knowledge MCP tools and cite the source filenames in your answer.' +
          recallBlock(memoryNote) +
          eventContext,
        onProgress,
      );
      result = { answer: chat.text, sources: [], files: chat.files, workDir: chat.workDir };
    } else {
      result = await askWithRag(provider, getHistory(channelId), question, onProgress);
    }
    pushHistory(channelId, { role: 'assistant', content: result.answer });
    scheduleExtraction(channelId, question, result.answer);

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
    display.finish();
  }
}

export function replyFooter(reply: GroundedReply): string {
  const parts: string[] = [];
  if (reply.sources.length) parts.push(`Sources: ${reply.sources.join(', ')}`);
  if (reply.skipped.length) parts.push(`Not attached (too big): ${reply.skipped.join(', ')}`);
  return parts.length ? `\n-# ${parts.join(' · ')}`.slice(0, 500) : '';
}
