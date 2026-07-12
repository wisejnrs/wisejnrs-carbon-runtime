import path from 'node:path';
import nodePath from 'node:path';
import fs from 'node:fs/promises';
import { AttachmentBuilder, Client, Events, GatewayIntentBits, MessageFlags, Partials } from 'discord.js';
import { config } from './config.js';
import { ai, commands } from './commands/index.js';
import { createProgressDisplay, runGroundedChat, replyFooter } from './chat.js';
import { getHistory } from './ai/index.js';
import { devChannelsAvailable, devChat, repoForChannel, resetDevSession } from './dev.js';
import { startHealthServer } from './health.js';
import { startProactive } from './proactive.js';
import { sendVoiceReply, speechify, transcribeAudio, voiceAvailable } from './voice.js';
import { startVoiceSession, voiceSessionActive } from './voicechannel.js';
import { startWhatsApp } from './whatsapp.js';
import { setDiscordClient } from './discordTools.js';
import { logHistory } from './db/history.js';

// Transcribe every audio attachment on a message (voice notes AND uploaded
// voicemail files), so someone can dump several recordings at once. Returns
// the combined transcript, or null when there's no audio.
async function voiceToText(message: import('discord.js').Message): Promise<string | null> {
  const clips = [...message.attachments.values()].filter((a) => a.contentType?.startsWith('audio/'));
  if (!clips.length || !voiceAvailable()) return null;
  const parts: string[] = [];
  for (const clip of clips) {
    try {
      const buffer = Buffer.from(await (await fetch(clip.url)).arrayBuffer());
      const transcript = await transcribeAudio(buffer, clip.name ?? 'voice.ogg');
      if (transcript) parts.push(clips.length > 1 ? `[${clip.name ?? 'clip'}] ${transcript}` : transcript);
      console.log(`[voice] transcribed ${Math.round(buffer.length / 1024)}KB -> "${transcript.slice(0, 60)}"`);
    } catch (error) {
      console.warn('[voice] transcription failed for', clip.name, error);
    }
  }
  return parts.length ? parts.join('\n\n') : null;
}

// Save attached images into <repo>/design-inbox/ so a dev session can Read them
// as visual input (wireframes, sketches, diagrams, screenshots).
async function saveImages(
  message: import('discord.js').Message,
  repoPath: string,
): Promise<string[]> {
  const images = [...message.attachments.values()].filter((a) => a.contentType?.startsWith('image/'));
  if (!images.length) return [];
  const dir = nodePath.join(repoPath, 'design-inbox');
  await fs.mkdir(dir, { recursive: true });
  const saved: string[] = [];
  for (const image of images) {
    const safe = (image.name ?? 'image.png').replace(/[^\w.\-]/g, '_');
    const dest = nodePath.join(dir, `${Date.now()}-${safe}`);
    await fs.writeFile(dest, Buffer.from(await (await fetch(image.url)).arrayBuffer()));
    saved.push(dest);
    console.log(`[dev] saved design image ${safe} (${Math.round(image.size / 1024)}KB)`);
  }
  return saved;
}

// Inline text-based attachments (Discord turns any long paste into a `message.txt`,
// and people drop .md/.txt/.csv notes) so their content reaches the agent as task
// text instead of being silently ignored.
async function readTextAttachments(
  message: import('discord.js').Message,
): Promise<string | null> {
  const texts = [...message.attachments.values()].filter((a) => {
    const ct = a.contentType ?? '';
    const name = (a.name ?? '').toLowerCase();
    return ct.startsWith('text/') || ct.includes('json') || /\.(txt|md|markdown|csv|json|log|ya?ml|rtf)$/.test(name);
  });
  if (!texts.length) return null;
  const parts: string[] = [];
  for (const a of texts) {
    try {
      const content = await (await fetch(a.url)).text();
      // message.txt is just an overflowed paste - no need to label it.
      const label = a.name && a.name !== 'message.txt' ? `[${a.name}]\n` : '';
      parts.push((label + content).slice(0, 100_000));
      console.log(`[dev] read text attachment ${a.name} (${Math.round((a.size ?? 0) / 1024)}KB)`);
    } catch (error) {
      console.warn('[dev] failed reading text attachment', a.name, error);
    }
  }
  return parts.length ? parts.join('\n\n') : null;
}

// Save other document attachments (pdf, docx, epub, zip…) into <repo>/uploads/ so a
// dev session can open them with the Read tool.
async function saveDocAttachments(
  message: import('discord.js').Message,
  repoPath: string,
): Promise<string[]> {
  const docs = [...message.attachments.values()].filter((a) => {
    const ct = a.contentType ?? '';
    const name = (a.name ?? '').toLowerCase();
    if (ct.startsWith('image/') || ct.startsWith('audio/') || ct.startsWith('text/') || ct.includes('json')) return false;
    if (/\.(txt|md|markdown|csv|json|log|ya?ml|rtf)$/.test(name)) return false; // handled as text
    return true;
  });
  if (!docs.length) return [];
  const dir = nodePath.join(repoPath, 'uploads');
  await fs.mkdir(dir, { recursive: true });
  const saved: string[] = [];
  for (const a of docs) {
    const safe = (a.name ?? 'file').replace(/[^\w.\-]/g, '_');
    const dest = nodePath.join(dir, `${Date.now()}-${safe}`);
    await fs.writeFile(dest, Buffer.from(await (await fetch(a.url)).arrayBuffer()));
    saved.push(dest);
    console.log(`[dev] saved document ${safe} (${Math.round((a.size ?? 0) / 1024)}KB)`);
  }
  return saved;
}

const chatEnabled =
  config.enableMentionChat || config.chatChannels.length > 0 || devChannelsAvailable();

const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates];
if (chatEnabled) {
  // Both require the privileged Message Content intent in the developer portal.
  intents.push(GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent);
  intents.push(GatewayIntentBits.GuildMessageReactions); // react to react (👍 / 🔁 / 🗑️)
}

// Partials so reactions on messages not in cache still fire the event.
const client = new Client({ intents, partials: [Partials.Message, Partials.Reaction, Partials.Channel] });
const commandMap = new Map(commands.map((command) => [command.data.name, command]));

client.once(Events.ClientReady, async (ready) => {
  console.log(`Logged in as ${ready.user.tag}`);
  ready.user.setPresence({
    activities: [{ name: 'your life 🤖', type: 3 /* Watching */ }],
    status: 'online',
  });
  setDiscordClient(client);
  startProactive(client);
  void startWhatsApp(client).catch((error) => console.error('[whatsapp] start failed:', error));
  console.log(
    `Chat: mentions=${config.enableMentionChat}, channels=[${config.chatChannels.join(', ') || 'none'}]`,
  );
  const data = commands.map((command) => command.data.toJSON());
  if (config.guildId) {
    const guild = await ready.guilds.fetch(config.guildId);
    await guild.commands.set(data);
    console.log(`Registered ${data.length} commands in guild ${guild.name}`);
  } else {
    // Guild registration is instant; global registration can take up to an hour.
    for (const [, guild] of await ready.guilds.fetch()) {
      const full = await guild.fetch();
      await full.commands.set(data);
      console.log(`Registered ${data.length} commands in guild ${full.name}`);
    }
    if (!ready.guilds.cache.size) console.log('Bot is not in any guilds yet - invite it first.');
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = commandMap.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`[${interaction.commandName}] failed:`, error);
    const message = { content: 'That command blew up. Check the logs.', flags: MessageFlags.Ephemeral } as const;
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(message).catch(() => {});
    } else {
      await interaction.reply(message).catch(() => {});
    }
  }
});

// Successor to the old CommandHandlingService: @mention the bot anywhere to chat,
// and in CHAT_CHANNELS the bot replies to every message without needing a mention.
if (chatEnabled) {
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !client.user) return;
    const channelName =
      'name' in message.channel && typeof message.channel.name === 'string'
        ? message.channel.name.toLowerCase()
        : '';

    // Channel-per-repo development takes precedence over plain chat.
    const repoPath = repoForChannel(channelName);
    if (repoPath) {
      let task = message.content.trim();
      // Fold in any attached voicemails/voice notes alongside typed text.
      const spoken = await voiceToText(message).catch(() => null);
      if (spoken) task = [task, spoken].filter(Boolean).join('\n\n');
      // Save attached images (diagrams, sketches, screenshots) into the repo and
      // point the session at them - Claude's Read tool sees images as design input.
      const savedImages = await saveImages(message, repoPath).catch(() => [] as string[]);
      if (savedImages.length) {
        task =
          `${task}\n\n[Design image(s) attached: ${savedImages.join(', ')}. ` +
          `View each with the Read tool and use them as the design/spec to build from.]`.trim();
      }
      // Fold in text-file attachments (long pastes become message.txt; also .md/.txt notes).
      const docText = await readTextAttachments(message).catch(() => null);
      if (docText) task = [task, docText].filter(Boolean).join('\n\n');
      // Save other documents (pdf/docx/epub…) into the repo for the agent to Read.
      const savedDocs = await saveDocAttachments(message, repoPath).catch(() => [] as string[]);
      if (savedDocs.length) {
        task =
          `${task}\n\n[Document(s) attached: ${savedDocs.join(', ')}. ` +
          `Open each with the Read tool.]`.trim();
      }
      if (!task) return;
      if (task === '!reset') {
        const had = resetDevSession(message.channelId);
        await message.reply(had ? '🔄 Session reset - next message starts fresh.' : 'No active session.');
        return;
      }
      console.log(`[dev] ${message.author.tag} in #${channelName} -> ${repoPath}`);
      void message.react('👀').catch(() => {});
      try {
        const placeholder = await message.reply(`⚙️ **Working** in \`${path.basename(repoPath)}\`…`);
        const display = createProgressDisplay(
          (text) => placeholder.edit(text),
          `Working in ${path.basename(repoPath)}`,
        );
        const reply = await devChat(
          message.channelId,
          repoPath,
          task,
          display.onNote,
          config.ownerUserIds.includes(message.author.id),
        ).finally(() => display.finish());
        const attachments = reply.files.map(
          (file) => new AttachmentBuilder(file, { name: path.basename(file) }),
        );
        // Final as a fresh message (OpenClaw pattern) so the channel shows unread.
        await placeholder.delete().catch(() => {});
        await message.reply({ content: reply.text.slice(0, 2000), files: attachments });
        if (reply.text.length > 2000 && 'send' in message.channel) {
          for (let i = 2000; i < reply.text.length; i += 1990) {
            await message.channel.send(reply.text.slice(i, i + 1990));
          }
        }
        logHistory({
          userId: message.author.id,
          userTag: message.author.tag,
          guildId: message.guildId,
          channelId: message.channelId,
          command: 'dev',
          input: task,
          output: reply.text.slice(0, 4000),
        });
        void message.reactions.cache.get('👀')?.users.remove(client.user.id).catch(() => {});
        void message.react('✅').catch(() => {});
      } catch (error) {
        console.error('[dev] session failed:', error);
        void message.react('❌').catch(() => {});
        await message.reply('Dev session failed. Check the logs or send !reset.').catch(() => {});
      }
      return;
    }

    const isChatChannel =
      config.chatChannels.includes(message.channelId) ||
      config.chatChannels.includes(channelName);
    // Match direct user mentions, nickname mentions, and the bot's managed role.
    const isMention =
      config.enableMentionChat &&
      (message.mentions.users.has(client.user.id) ||
        message.mentions.roles.some((role) => role.tags?.botId === client.user?.id));
    console.log(
      `[chat] ${message.author.tag} in #${channelName || message.channelId}: ` +
        `chatChannel=${isChatChannel} mention=${isMention}`,
    );
    if (!isChatChannel && !isMention) return;
    let content = message.content
      .replaceAll(`<@${client.user.id}>`, '')
      .replaceAll(`<@!${client.user.id}>`, '')
      .replace(/<@&\d+>/g, '')
      .trim();
    let wasVoice = false;
    if (!content) {
      const transcript = await voiceToText(message).catch((error) => {
        console.warn('[voice] transcription failed:', error);
        return null;
      });
      if (!transcript) return;
      content = transcript;
      wasVoice = true;
    }
    void message.react('👀').catch(() => {});
    try {
      const placeholder = await message.reply('⚙️ Working…');
      const reply = await runGroundedChat(
        ai,
        message.channelId,
        content,
        (status) => placeholder.edit(status),
        config.ownerUserIds.includes(message.author.id),
      );
      const full = reply.answer + replyFooter(reply);
      // Final as a fresh message (OpenClaw pattern) so the channel shows unread.
      await placeholder.delete().catch(() => {});
      await message.reply({ content: full.slice(0, 2000), files: reply.attachments });
      if (full.length > 2000 && 'send' in message.channel) {
        for (let i = 2000; i < full.length; i += 1990) {
          await message.channel.send(full.slice(i, i + 1990));
        }
      }
      await reply.cleanup();
      if (wasVoice && config.voiceReplies && voiceAvailable()) {
        void sendVoiceReply(message.channelId, speechify(reply.answer)).catch((error) =>
          console.warn('[voice] reply failed:', error),
        );
      }
      logHistory({
        userId: message.author.id,
        userTag: message.author.tag,
        guildId: message.guildId,
        channelId: message.channelId,
        command: wasVoice ? 'voice' : isMention ? 'mention' : 'chat',
        input: content,
        output: reply.answer.slice(0, 4000),
      });
      void message.reactions.cache.get('👀')?.users.remove(client.user.id).catch(() => {});
    } catch (error) {
      console.error('[mention] AI request failed:', error);
      void message.react('❌').catch(() => {});
    }
  });
}

// React to a message the bot sent to control it:
//   🗑️ delete it · 🔊 hear it as a voice message · ♻️/🔁 regenerate the answer
if (chatEnabled) {
  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    try {
      if (user.bot || !client.user) return;
      if (reaction.partial) await reaction.fetch();
      const msg = reaction.message.partial ? await reaction.message.fetch() : reaction.message;
      if (msg.author?.id !== client.user.id) return; // only react to our own messages
      const emoji = reaction.emoji.name;

      if (emoji === '🗑️' || emoji === '🗑') {
        await msg.delete().catch(() => {});
      } else if (emoji === '🔊' && config.voiceReplies && voiceAvailable() && msg.content) {
        await sendVoiceReply(msg.channelId, speechify(msg.content)).catch((e) =>
          console.warn('[voice] reaction reply failed:', e),
        );
      } else if ((emoji === '♻️' || emoji === '🔁') && 'send' in msg.channel) {
        // Regenerate: re-run the user's previous turn in this channel.
        const prior = getHistory(msg.channelId);
        const lastUser = [...prior].reverse().find((m) => m.role === 'user');
        if (!lastUser) return;
        const placeholder = await msg.channel.send('♻️ Regenerating…');
        const regen = await runGroundedChat(
          ai,
          msg.channelId,
          lastUser.content,
          (status) => placeholder.edit(status),
          config.ownerUserIds.includes(user.id),
        );
        await placeholder.delete().catch(() => {});
        await msg.channel.send({
          content: (regen.answer + replyFooter(regen)).slice(0, 2000),
          files: regen.attachments,
        });
        await regen.cleanup();
      }
    } catch (error) {
      console.warn('[reactions] handler failed:', error);
    }
  });
}

// Auto-join the voice channel Mike enters (gated to one user id) so he can just hop
// in and talk - no /talk needed. Leaving is handled by the empty-channel check.
if (config.voiceAutoJoinUserId) {
  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    try {
      if (newState.id !== config.voiceAutoJoinUserId) return;
      const channel = newState.channel;
      if (!channel || channel.id === oldState.channelId) return; // only on a fresh join/move
      if (voiceSessionActive(newState.guild.id)) return;
      const textCh = newState.guild.channels.cache.find(
        (c) => c.name === config.briefingChannel && c.type === 0,
      );
      const textChannelId = textCh?.id ?? channel.id;
      console.log(`[voice] auto-join: ${newState.member?.user.tag} entered #${channel.name}`);
      await startVoiceSession(channel, textChannelId, (line) => {
        if (textCh && 'send' in textCh) {
          void (textCh as { send: (s: string) => Promise<unknown> }).send(line.slice(0, 1900)).catch(() => {});
        }
      }).catch((error) => console.error('[voice] auto-join failed:', error));
    } catch (error) {
      console.error('[voice] VoiceStateUpdate handler error:', error);
    }
  });
}

startHealthServer(client);
client.login(config.discordToken);
