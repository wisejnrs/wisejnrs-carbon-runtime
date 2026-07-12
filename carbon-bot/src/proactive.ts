import { ChannelType, Client, type TextChannel } from 'discord.js';
import { liteQuery } from './ai/claudeCode.js';
import { ai } from './commands/index.js';
import { config } from './config.js';
import {
  deliveredToday,
  dueCommitments,
  settleCommitments,
  type Commitment,
} from './db/history.js';
import { channelsWithEvents, drainSystemEvents, untrustedBlock } from './events.js';
import { getWeather } from './weather.js';

// Proactive actions (OpenClaw patterns): due commitments and queued system
// events are delivered as natural check-ins, and a daily briefing is posted.
// Scheduling lives in Inngest (see inngest.ts) - a minute tick drives
// check-ins/events, and crons drive the briefing and nightly dream. Every
// proactive turn is sentinel-gated: the model answers with real content or
// HEARTBEAT_OK, and HEARTBEAT_OK is silently dropped.

const SENTINEL = 'HEARTBEAT_OK';
const MAX_CHECKINS_PER_DAY = config.maxCheckinsPerDay;

// The Discord client the Inngest functions act through. Set once the gateway
// is ready; functions skip (and Inngest records the skip) until then.
let activeClient: Client | null = null;

export function proactiveClient(): Client | null {
  return activeClient;
}

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

export async function deliverCheckins(client: Client): Promise<number> {
  const due = dueCommitments(Date.now());
  const byChannel = new Map<string, Commitment[]>();
  for (const commitment of due) {
    const list = byChannel.get(commitment.channel_id) ?? [];
    list.push(commitment);
    byChannel.set(commitment.channel_id, list);
  }

  let delivered = 0;
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
      delivered += commitments.length;
      console.log(`[proactive] check-in delivered to #${channel.name} (${commitments.length} commitments)`);
    } else {
      settleCommitments(commitments.map((c) => c.id), 'dropped');
    }
  }
  return delivered;
}

export async function deliverEvents(client: Client): Promise<number> {
  let delivered = 0;
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
    if (content) {
      await channel.send(content.slice(0, 2000)).catch(() => {});
      delivered += 1;
    }
  }
  return delivered;
}

export async function postBriefing(client: Client): Promise<boolean> {
  const channel = findTextChannel(client, config.briefingChannel);
  if (!channel) return false;
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
  return true;
}

export function startProactive(client: Client): void {
  if (config.provider !== 'claude-code') {
    console.log('[proactive] disabled (requires the claude-code provider)');
    return;
  }
  activeClient = client;
  console.log(
    `[proactive] scheduling via Inngest; briefing ${config.briefingTime || 'off'} -> #${config.briefingChannel}; ` +
      `dream ${config.dreamTime || 'off'}; max ${MAX_CHECKINS_PER_DAY} check-ins/day/channel`,
  );
}
