import { ActivityType, ChannelType, Client, type TextChannel } from 'discord.js';
import { liteQuery } from './ai/claudeCode.js';
import { ai } from './commands/index.js';
import { config } from './config.js';
import {
  deliveredToday,
  dueCommitments,
  kvGet,
  kvSet,
  settleCommitments,
  type Commitment,
} from './db/history.js';
import { channelsWithEvents, drainSystemEvents, untrustedBlock } from './events.js';
import { dream } from './memory.js';
import { getWeather } from './weather.js';

// Proactive loop (OpenClaw patterns): a 60s tick delivers due commitments and
// queued system events as natural check-ins, and a scheduler posts the daily
// briefing. Every proactive turn is sentinel-gated: the model answers with real
// content or HEARTBEAT_OK, and HEARTBEAT_OK is silently dropped.

const SENTINEL = 'HEARTBEAT_OK';
const TICK_MS = 60_000;
const MAX_CHECKINS_PER_DAY = config.maxCheckinsPerDay;

function shouldDeliver(text: string): string | null {
  const cleaned = text.replace(SENTINEL, '').trim();
  if (!cleaned || text.trim() === SENTINEL) return null;
  return cleaned;
}

function findTextChannel(client: Client, nameOrId: string): TextChannel | undefined {
  for (const [, channel] of client.channels.cache) {
    if (channel.type !== ChannelType.GuildText) continue;
    const text = channel as TextChannel;
    if (text.id === nameOrId || text.name === nameOrId.toLowerCase().replace(/^#/, '')) return text;
  }
  return undefined;
}

async function deliverCheckins(client: Client): Promise<void> {
  const due = dueCommitments(Date.now());
  const byChannel = new Map<string, Commitment[]>();
  for (const commitment of due) {
    const list = byChannel.get(commitment.channel_id) ?? [];
    list.push(commitment);
    byChannel.set(commitment.channel_id, list);
  }

  for (const [channelId, commitments] of byChannel) {
    const channel = client.channels.cache.get(channelId) as TextChannel | undefined;
    if (!channel || !('send' in channel)) {
      settleCommitments(commitments.map((c) => c.id), 'dropped');
      continue;
    }
    if (deliveredToday(channelId) >= MAX_CHECKINS_PER_DAY) continue; // try again tomorrow

    const metadata = commitments
      .map((c) => `- kind=${c.kind} key=${c.dedupe_key} suggested="${c.suggested_text}"`)
      .join('\n');
    const draft = await liteQuery(
      untrustedBlock('commitments', metadata) +
        '\n\nWrite ONE short, natural Discord check-in message covering what is genuinely ' +
        `worth asking about (combine related items). If nothing is worth sending, reply exactly ${SENTINEL}.`,
      'You are MrRoboto, a friendly personal Discord assistant. One short message, no preamble.',
    ).catch(() => SENTINEL);

    const content = shouldDeliver(draft);
    if (content) {
      await channel.send(content.slice(0, 2000)).catch(() => {});
      settleCommitments(commitments.map((c) => c.id), 'delivered');
      console.log(`[proactive] check-in delivered to #${channel.name} (${commitments.length} commitments)`);
    } else {
      settleCommitments(commitments.map((c) => c.id), 'dropped');
    }
  }
}

async function deliverEvents(client: Client): Promise<void> {
  for (const channelId of channelsWithEvents()) {
    const channel = client.channels.cache.get(channelId) as TextChannel | undefined;
    const events = drainSystemEvents(channelId);
    if (!channel || !('send' in channel) || !events.length) continue;
    const draft = await liteQuery(
      untrustedBlock('events', events.map((event) => `- ${event.text}`).join('\n')) +
        `\n\nIf these events warrant telling the user, write ONE short Discord message. Otherwise reply exactly ${SENTINEL}.`,
      'You are MrRoboto, a friendly personal Discord assistant. One short message, no preamble.',
    ).catch(() => SENTINEL);
    const content = shouldDeliver(draft);
    if (content) await channel.send(content.slice(0, 2000)).catch(() => {});
  }
}

async function postBriefing(client: Client): Promise<void> {
  const channel = findTextChannel(client, config.briefingChannel);
  if (!channel) return;
  console.log('[proactive] composing daily briefing');
  const weather = await getWeather(config.briefingLocation).catch(() => '');
  const upcoming = dueCommitments(Date.now() + 36 * 60 * 60 * 1000)
    .map((c) => `- ${c.kind}: ${c.suggested_text}`)
    .join('\n');
  const { text } = await ai.chat(
    [
      {
        role: 'user',
        content:
          'Compose my morning briefing as a single Discord message (max ~1800 chars). Include: ' +
          '(1) important/unread emails via the gmail tools - names + one-liners, skip bot noise; ' +
          "(2) today's calendar via the google-calendar tools; " +
          '(3) open follow-ups listed below, if any; (4) the weather line below. ' +
          'Friendly, scannable, emoji section headers.\n\n' +
          (upcoming ? untrustedBlock('follow-ups', upcoming) + '\n\n' : '') +
          (weather ? `Weather:\n${weather}` : ''),
      },
    ],
    'You are MrRoboto composing a morning briefing. Output only the briefing message.',
  );
  await channel.send(text.slice(0, 2000)).catch(() => {});
  console.log('[proactive] briefing posted to #' + channel.name);
}

function scheduledDaily(kvKey: string, time: string): boolean {
  if (!time) return false;
  const now = new Date();
  const [hour, minute] = time.split(':').map(Number);
  if (now.getHours() !== hour || now.getMinutes() < minute || now.getMinutes() >= minute + 5) {
    return false;
  }
  const today = now.toISOString().slice(0, 10);
  if (kvGet(kvKey) === today) return false;
  kvSet(kvKey, today);
  return true;
}

function briefingDueNow(): boolean {
  return Boolean(config.briefingChannel) && scheduledDaily('briefing:last', config.briefingTime);
}

export function startProactive(client: Client): void {
  if (config.provider !== 'claude-code') {
    console.log('[proactive] disabled (requires the claude-code provider)');
    return;
  }
  console.log(
    `[proactive] tick every ${TICK_MS / 1000}s; briefing ${config.briefingTime || 'off'} -> #${config.briefingChannel}; max ${MAX_CHECKINS_PER_DAY} check-ins/day/channel`,
  );
  let running = false;
  setInterval(() => {
    if (running) return;
    running = true;
    (async () => {
      try {
        if (briefingDueNow()) await postBriefing(client);
        if (config.memoryEnabled && scheduledDaily('dream:last', config.dreamTime)) {
          await dream().catch((error) => console.error('[memory] dream failed:', error));
        }
        await deliverCheckins(client);
        await deliverEvents(client);
      } catch (error) {
        console.error('[proactive] tick failed:', error);
      } finally {
        running = false;
      }
    })();
  }, TICK_MS);
}
