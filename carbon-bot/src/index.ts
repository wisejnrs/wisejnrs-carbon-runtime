import path from 'node:path';
import { Client, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import { config } from './config.js';
import { ai, commands } from './commands/index.js';
import { createProgressDisplay, runGroundedChat, replyFooter } from './chat.js';
import { devChannelsAvailable, devChat, repoForChannel, resetDevSession } from './dev.js';
import { startHealthServer } from './health.js';
import { startProactive } from './proactive.js';
import { sendVoiceReply, speechify, transcribeAudio, voiceAvailable } from './voice.js';
import { logHistory } from './db/history.js';

// A Discord voice note is an audio attachment; transcribe it so the rest of
// the pipeline can treat it as text. Returns null when the message has none.
async function voiceToText(message: import('discord.js').Message): Promise<string | null> {
  const audio = message.attachments.find((a) => a.contentType?.startsWith('audio/'));
  if (!audio || !voiceAvailable()) return null;
  const buffer = Buffer.from(await (await fetch(audio.url)).arrayBuffer());
  const transcript = await transcribeAudio(buffer, audio.name ?? 'voice.ogg');
  console.log(`[voice] transcribed ${Math.round(buffer.length / 1024)}KB -> "${transcript.slice(0, 80)}"`);
  return transcript || null;
}

const chatEnabled =
  config.enableMentionChat || config.chatChannels.length > 0 || devChannelsAvailable();

const intents = [GatewayIntentBits.Guilds];
if (chatEnabled) {
  // Both require the privileged Message Content intent in the developer portal.
  intents.push(GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent);
}

const client = new Client({ intents });
const commandMap = new Map(commands.map((command) => [command.data.name, command]));

client.once(Events.ClientReady, async (ready) => {
  console.log(`Logged in as ${ready.user.tag}`);
  ready.user.setPresence({
    activities: [{ name: 'your life 🤖', type: 3 /* Watching */ }],
    status: 'online',
  });
  startProactive(client);
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
      if (!task) task = (await voiceToText(message).catch(() => null)) ?? '';
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
        const reply = await devChat(message.channelId, repoPath, task, display.onNote).finally(
          () => display.finish(),
        );
        // Final as a fresh message (OpenClaw pattern) so the channel shows unread.
        await placeholder.delete().catch(() => {});
        await message.reply(reply.slice(0, 2000));
        if (reply.length > 2000 && 'send' in message.channel) {
          for (let i = 2000; i < reply.length; i += 1990) {
            await message.channel.send(reply.slice(i, i + 1990));
          }
        }
        logHistory({
          userId: message.author.id,
          userTag: message.author.tag,
          guildId: message.guildId,
          channelId: message.channelId,
          command: 'dev',
          input: task,
          output: reply.slice(0, 4000),
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
      const reply = await runGroundedChat(ai, message.channelId, content, (status) =>
        placeholder.edit(status),
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

startHealthServer(client);
client.login(config.discordToken);
