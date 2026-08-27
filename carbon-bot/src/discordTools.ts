import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { ChannelType, PermissionFlagsBits, type Client, type TextChannel } from 'discord.js';
import { z } from 'zod';
import { config } from './config.js';
import { brandEmbed } from './embeds.js';
import { getGoal, newGoal, stopGoal } from './labGoal.js';
import { createProject, projectsStartedToday, MAX_PROJECTS_PER_DAY } from './projectFactory.js';

export function getDiscordClient(): Client | undefined {
  return client;
}

// Create (or reuse) the private "#lab-<slug>" channel for a lab project and seed
// it with an embed. Shared by the start_project tool and the "Make a project"
// context-menu flow so both provision channels identically.
export async function provisionLabChannel(
  slug: string,
  opts: { name: string; why: string; summary?: string },
): Promise<{ channel?: TextChannel; note: string }> {
  if (!client) return { note: '' };
  const guild = config.guildId ? client.guilds.cache.get(config.guildId) : client.guilds.cache.first();
  if (!guild) return { note: '' };
  try {
    let category = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === 'mrroboto-lab',
    );
    if (!category) {
      category = await guild.channels.create({ name: 'mrroboto-lab', type: ChannelType.GuildCategory });
    }
    const overwrites = [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      ...config.ownerUserIds.map((id) => ({
        id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      })),
    ];
    const channel = await guild.channels.create({
      name: `lab-${slug}`,
      type: ChannelType.GuildText,
      parent: category.id,
      topic: (opts.summary ?? opts.name).slice(0, 100),
      permissionOverwrites: overwrites,
    });
    await channel.send({
      embeds: [
        brandEmbed({
          title: `🌱 ${opts.name}`,
          description: opts.why,
          fields: [{ name: 'Working dir', value: `\`mrroboto-lab/projects/${slug}\`` }],
          footer: 'Message me in this channel to build it out.',
        }),
      ],
    });
    return { channel, note: ` Channel **#lab-${slug}** is ready.` };
  } catch (e) {
    return { note: ` (couldn't open a channel: ${e instanceof Error ? e.message : String(e)})` };
  }
}

// In-process MCP server letting MrRoboto's sessions read and post across the
// Discord server it lives in: list channels, read a channel's recent history,
// search across channels, post, and invite users into a channel it owns. Set by
// startup once the client is ready.

let client: Client | undefined;
export function setDiscordClient(c: Client): void {
  client = c;
}

// Per-request context, set by the message handler before each session, so
// owner-gated tools know who is asking and which channel is "current".
export interface RequestContext {
  requesterId?: string;
  requesterName?: string;
  channelId?: string;
  channelName?: string;
  isOwner?: boolean;
}
let requestContext: RequestContext = {};
export function setDiscordRequestContext(ctx: RequestContext): void {
  requestContext = ctx;
}
export function getDiscordRequestContext(): RequestContext {
  return requestContext;
}

// Resolve a user reference (<@id> mention, raw id, or exact username) to a user id.
function resolveUserId(ref: string): string | undefined {
  const idMatch = ref.match(/(\d{15,})/);
  if (idMatch) return idMatch[1];
  if (!client) return undefined;
  const key = ref.trim().replace(/^@/, '').toLowerCase();
  for (const guild of client.guilds.cache.values()) {
    const m = guild.members.cache.find(
      (mem) =>
        mem.user.username.toLowerCase() === key ||
        (mem.nickname ?? '').toLowerCase() === key ||
        (mem.user.globalName ?? '').toLowerCase() === key,
    );
    if (m) return m.id;
  }
  return undefined;
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
    tool(
      'discord_invite',
      'Invite (grant access to) a user into a private Discord channel — use for "invite Paul to this channel" / "add them here". ' +
        'Only works when the person who asked OWNS or manages that channel; otherwise it is refused. ' +
        'Defaults to the current channel when no channel is given.',
      {
        user: z.string().describe('who to add: their @mention, user id, or exact username/nickname'),
        channel: z.string().optional().describe('channel name or id; omit for the current channel'),
      },
      async (args) => {
        const err = (t: string) => ({ content: [{ type: 'text' as const, text: t }], isError: true });
        if (!client) return err('Discord client not ready.');

        // Resolve the target channel — explicit arg, else the current channel.
        const channel = args.channel
          ? findChannel(args.channel)
          : requestContext.channelId
            ? textChannels().find((c) => c.id === requestContext.channelId)
            : undefined;
        if (!channel) return err(`Which channel? Couldn't resolve "${args.channel ?? '(current)'}".`);

        // Gate: the requester must own/manage this channel. Bot-owners (Mike) always
        // pass; otherwise require Manage Channels permission on this specific channel.
        let allowed = Boolean(requestContext.isOwner);
        if (!allowed && requestContext.requesterId) {
          const member = await channel.guild.members.fetch(requestContext.requesterId).catch(() => null);
          allowed = member ? channel.permissionsFor(member).has(PermissionFlagsBits.ManageChannels) : false;
        }
        if (!allowed) {
          return err(`Only the owner of #${channel.name} can invite people to it — and this request isn't from them.`);
        }

        // Resolve the user to add.
        const userId = resolveUserId(args.user);
        if (!userId) {
          return err(`Couldn't find "${args.user}". Ask them to be @mentioned, or give their user id.`);
        }

        // Grant access via a permission overwrite (view + post + read history).
        try {
          await channel.permissionOverwrites.edit(userId, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
          });
        } catch (e) {
          return err(
            `Couldn't add them — I may lack the Manage Channels/Roles permission on #${channel.name}. (${
              e instanceof Error ? e.message : String(e)
            })`,
          );
        }
        return { content: [{ type: 'text', text: `✅ Invited <@${userId}> into #${channel.name}.` }] };
      },
    ),
    tool(
      'start_project',
      'Start a NEW project of your own when you genuinely spot something worth building — a tool, ' +
        'script, bot, or small app that would actually help. This is your initiative: use it when a ' +
        'real need comes up (in conversation or on your own), not for trivial one-off answers. It ' +
        'scaffolds a folder in your lab, opens a private #lab-… channel to build it in, commits and ' +
        'pushes to your private lab, and announces it. Each one is visible to Mike, so be deliberate.',
      {
        name: z.string().describe('short, human project name (e.g. "PR digest bot")'),
        why: z.string().describe('the real need — what problem this solves or why it is worth building'),
        summary: z.string().optional().describe('one line on what it will actually do'),
      },
      async (args) => {
        const err = (t: string) => ({ content: [{ type: 'text' as const, text: t }], isError: true });
        if (!client) return err('Discord client not ready.');

        // Gate: Mike (owner) can direct it; unprompted turns (no requester) are
        // MrRoboto acting on his own. A non-owner in a social channel cannot make him spawn projects.
        if (requestContext.requesterId && !requestContext.isOwner) {
          return err("Only Mike can have me start new projects — I can't spin one up for this request.");
        }
        if (projectsStartedToday() >= MAX_PROJECTS_PER_DAY) {
          return err("I've already started several projects today — I'll hold off so the lab doesn't sprawl. Ask again tomorrow, or we can build inside an existing one.");
        }

        // Scaffold + commit (+ best-effort push) in the lab.
        let res;
        try {
          res = createProject(args.name, args.why, args.summary);
        } catch (e) {
          return err(`Couldn't scaffold the project: ${e instanceof Error ? e.message : String(e)}`);
        }

        // Open a private channel to build it in (shared helper posts a seed embed).
        const { note: channelNote } = await provisionLabChannel(res.slug, {
          name: args.name,
          why: args.why,
          summary: args.summary,
        });

        return {
          content: [
            {
              type: 'text',
              text:
                `✅ Started **${args.name}** in the lab → \`projects/${res.slug}\`.` +
                channelNote +
                (res.pushed ? '' : ' (committed locally; push is pending.)'),
            },
          ],
        };
      },
    ),
    tool(
      'set_goal',
      'Set an AUTONOMOUS build goal for the current lab project (only in a #lab-… channel). ' +
        'MrRoboto then keeps working toward it on his own - one bounded turn at a time, no human reply needed - ' +
        'until a quality gate passes (done), he is blocked, or the budget runs out, posting progress here each turn. ' +
        'Use when asked to "build this out autonomously / on your own / overnight".',
      {
        goal: z.string().describe('what to build or achieve, concretely'),
        gate: z.string().optional().describe('shell command that must exit 0 to count as done, e.g. "npm test" or "npm run build"'),
        max_turns: z.number().optional().describe('max autonomous turns (default 12, hard cap 40)'),
        max_minutes: z.number().optional().describe('max wall-clock minutes (default 40, hard cap 120)'),
      },
      async (args) => {
        const err = (t: string) => ({ content: [{ type: 'text' as const, text: t }], isError: true });
        if (requestContext.requesterId && !requestContext.isOwner) return err('Only Mike can set autonomous build goals.');
        const name = requestContext.channelName || '';
        if (!name.startsWith('lab-') || !requestContext.channelId) {
          return err('set_goal only works inside a #lab-… project channel. Start one first with start_project.');
        }
        const slug = name.slice('lab-'.length);
        const existing = getGoal(slug);
        if (existing && existing.status === 'active') {
          return err(`There's already an active goal on **${slug}** (turn ${existing.iterations}/${existing.maxIterations}). Stop it first with stop_goal.`);
        }
        const g = newGoal(slug, requestContext.channelId, args.goal, { gate: args.gate, maxIterations: args.max_turns, maxMinutes: args.max_minutes });
        return {
          content: [{
            type: 'text',
            text:
              `🎯 Autonomous goal set for **${slug}** — I'll build toward it on my own (up to ${g.maxIterations} turns / ${g.maxMinutes} min` +
              `${g.gate ? `, gate \`${g.gate}\`` : ''}) and post progress here. First turn starts within a minute. Stop me anytime with stop_goal.`,
          }],
        };
      },
    ),
    tool(
      'stop_goal',
      'Stop / pause the autonomous build goal on the current lab project (#lab-… channel).',
      {},
      async () => {
        const err = (t: string) => ({ content: [{ type: 'text' as const, text: t }], isError: true });
        const name = requestContext.channelName || '';
        if (!name.startsWith('lab-')) return err('stop_goal only works in a #lab-… channel.');
        const slug = name.slice('lab-'.length);
        const g = stopGoal(slug, 'paused');
        return { content: [{ type: 'text', text: g ? `⏸️ Paused the autonomous goal on **${slug}** at turn ${g.iterations}.` : `No active goal on **${slug}** to stop.` }] };
      },
    ),
    tool(
      'discord_embed',
      'Post a rich embed card (title, description, and up to 25 fields) to a channel. ' +
        'Use this instead of plain text when the content has clear parts — a status, a summary, a ' +
        'project brief, a checklist, a comparison. Looks far better than a wall of text.',
      {
        channel: z.string().describe('channel name or id'),
        title: z.string().optional(),
        description: z.string().optional().describe('main body (markdown ok)'),
        fields: z
          .array(z.object({ name: z.string(), value: z.string(), inline: z.boolean().optional() }))
          .optional()
          .describe('labelled sections; set inline:true to sit side-by-side'),
        footer: z.string().optional(),
      },
      async (args) => {
        const channel = findChannel(args.channel);
        if (!channel) return { content: [{ type: 'text', text: `No channel "${args.channel}".` }], isError: true };
        await channel.send({
          embeds: [brandEmbed({ title: args.title, description: args.description, fields: args.fields, footer: args.footer })],
        });
        return { content: [{ type: 'text', text: `posted an embed to #${channel.name}` }] };
      },
    ),
    tool(
      'discord_poll',
      'Create a native Discord poll people vote on with a click. Use when a decision genuinely needs input.',
      {
        channel: z.string().describe('channel name or id'),
        question: z.string(),
        options: z.array(z.string()).min(2).max(10).describe('2–10 answer choices'),
        duration_hours: z.number().optional().describe('how long voting stays open (default 24, max 768)'),
        multiselect: z.boolean().optional().describe('allow picking more than one'),
      },
      async (args) => {
        const channel = findChannel(args.channel);
        if (!channel) return { content: [{ type: 'text', text: `No channel "${args.channel}".` }], isError: true };
        await channel.send({
          poll: {
            question: { text: args.question.slice(0, 300) },
            answers: args.options.slice(0, 10).map((o) => ({ text: o.slice(0, 55) })),
            duration: Math.min(Math.max(Math.round(args.duration_hours ?? 24), 1), 768),
            allowMultiselect: args.multiselect ?? false,
          },
        });
        return { content: [{ type: 'text', text: `posted a poll to #${channel.name}` }] };
      },
    ),
    tool(
      'discord_thread',
      'Open a thread in a channel to keep a focused task or side-discussion tidy. Optionally seed it with a first message.',
      {
        channel: z.string().describe('channel name or id'),
        name: z.string().describe('thread title'),
        message: z.string().optional().describe('optional first message to post in the thread'),
      },
      async (args) => {
        const channel = findChannel(args.channel);
        if (!channel) return { content: [{ type: 'text', text: `No channel "${args.channel}".` }], isError: true };
        const thread = await channel.threads.create({ name: args.name.slice(0, 100), autoArchiveDuration: 1440 });
        if (args.message) await thread.send(args.message.slice(0, 2000));
        return { content: [{ type: 'text', text: `opened thread "${thread.name}" in #${channel.name}` }] };
      },
    ),
    tool(
      'discord_pin',
      'Pin a message in a channel — e.g. an important status, a decision, or a key link. Give the message id, or omit to pin the most recent message.',
      {
        channel: z.string().describe('channel name or id'),
        message_id: z.string().optional().describe('id of the message to pin; omit to pin the latest'),
      },
      async (args) => {
        const channel = findChannel(args.channel);
        if (!channel) return { content: [{ type: 'text', text: `No channel "${args.channel}".` }], isError: true };
        const msg = args.message_id
          ? await channel.messages.fetch(args.message_id).catch(() => null)
          : (await channel.messages.fetch({ limit: 1 })).first();
        if (!msg) return { content: [{ type: 'text', text: 'Could not find that message.' }], isError: true };
        await msg.pin();
        return { content: [{ type: 'text', text: `pinned a message in #${channel.name}` }] };
      },
    ),
  ],
});
