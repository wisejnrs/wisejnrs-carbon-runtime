import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { ChannelType, type Client, type TextChannel } from 'discord.js';
import { z } from 'zod';

// In-process MCP server letting MrRoboto's sessions read and post across the
// Discord server it lives in: list channels, read a channel's recent history,
// search across channels, and post. Set by startup once the client is ready.

let client: Client | undefined;
export function setDiscordClient(c: Client): void {
  client = c;
}

function textChannels(): TextChannel[] {
  if (!client) return [];
  return [...client.channels.cache.values()].filter(
    (c): c is TextChannel => c.type === ChannelType.GuildText,
  );
}

function findChannel(nameOrId: string): TextChannel | undefined {
  const key = nameOrId.toLowerCase().replace(/^#/, '');
  return textChannels().find((c) => c.id === nameOrId || c.name.toLowerCase() === key);
}

async function fetchRecent(channel: TextChannel, limit: number) {
  const messages = await channel.messages.fetch({ limit: Math.min(limit, 100) });
  return [...messages.values()]
    .reverse()
    .filter((m) => m.content || m.attachments.size)
    .map((m) => {
      const when = m.createdAt.toISOString().replace('T', ' ').slice(0, 16);
      const media = m.attachments.size ? ` [${m.attachments.size} attachment(s)]` : '';
      return `[${when}] ${m.author.username}: ${m.content}${media}`;
    });
}

export const discordMcpServer = createSdkMcpServer({
  name: 'discord',
  version: '1.0.0',
  tools: [
    tool(
      'discord_channels',
      'List the text channels in the Discord server, so you know what exists before reading or posting.',
      {},
      async () => {
        const rows = textChannels()
          .map((c) => `#${c.name}${c.topic ? ` — ${c.topic.slice(0, 60)}` : ''}`)
          .sort();
        return { content: [{ type: 'text', text: rows.join('\n') || '(no channels)' }] };
      },
    ),
    tool(
      'discord_read',
      "Read a Discord channel's recent messages (oldest→newest). Use to catch up on or summarise a channel.",
      {
        channel: z.string().describe('channel name (e.g. general) or id'),
        limit: z.number().optional().describe('how many recent messages, default 50, max 100'),
      },
      async (args) => {
        const channel = findChannel(args.channel);
        if (!channel) return { content: [{ type: 'text', text: `No channel "${args.channel}".` }], isError: true };
        const rows = await fetchRecent(channel, args.limit ?? 50);
        return { content: [{ type: 'text', text: `#${channel.name}\n${rows.join('\n') || '(empty)'}` }] };
      },
    ),
    tool(
      'discord_search',
      'Search recent messages across all readable channels for text.',
      {
        query: z.string().describe('text to find'),
        per_channel: z.number().optional().describe('recent messages scanned per channel, default 60'),
      },
      async (args) => {
        const needle = args.query.toLowerCase();
        const hits: string[] = [];
        for (const channel of textChannels()) {
          const rows = await fetchRecent(channel, args.per_channel ?? 60).catch(() => []);
          for (const row of rows) {
            if (row.toLowerCase().includes(needle)) hits.push(`#${channel.name} ${row}`);
            if (hits.length >= 40) break;
          }
          if (hits.length >= 40) break;
        }
        return { content: [{ type: 'text', text: hits.join('\n') || `no matches for "${args.query}"` }] };
      },
    ),
    tool(
      'discord_post',
      'Post a message to a Discord channel. Confirm channel + wording with the user first unless they gave exact text.',
      {
        channel: z.string().describe('channel name or id'),
        text: z.string().describe('message to send'),
      },
      async (args) => {
        const channel = findChannel(args.channel);
        if (!channel) return { content: [{ type: 'text', text: `No channel "${args.channel}".` }], isError: true };
        await channel.send(args.text.slice(0, 2000));
        return { content: [{ type: 'text', text: `posted to #${channel.name}` }] };
      },
    ),
  ],
});
