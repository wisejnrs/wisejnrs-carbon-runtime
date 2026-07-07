import { Client, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import { config } from './config.js';
import { ai, commands } from './commands/index.js';
import { getHistory, pushHistory } from './ai/index.js';
import { askWithRag } from './rag/index.js';
import { startHealthServer } from './health.js';
import { logHistory } from './db/history.js';

const chatEnabled = config.enableMentionChat || config.chatChannels.length > 0;

const intents = [GatewayIntentBits.Guilds];
if (chatEnabled) {
  // Both require the privileged Message Content intent in the developer portal.
  intents.push(GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent);
}

const client = new Client({ intents });
const commandMap = new Map(commands.map((command) => [command.data.name, command]));

client.once(Events.ClientReady, async (ready) => {
  console.log(`Logged in as ${ready.user.tag}`);
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
    const content = message.content
      .replaceAll(`<@${client.user.id}>`, '')
      .replaceAll(`<@!${client.user.id}>`, '')
      .replace(/<@&\d+>/g, '')
      .trim();
    if (!content) return;
    try {
      await message.channel.sendTyping();
      pushHistory(message.channelId, { role: 'user', content });
      const { answer } = await askWithRag(ai, getHistory(message.channelId), content);
      pushHistory(message.channelId, { role: 'assistant', content: answer });
      await message.reply(answer.slice(0, 2000));
      logHistory({
        userId: message.author.id,
        userTag: message.author.tag,
        guildId: message.guildId,
        channelId: message.channelId,
        command: isMention ? 'mention' : 'chat',
        input: content,
        output: answer.slice(0, 4000),
      });
    } catch (error) {
      console.error('[mention] AI request failed:', error);
    }
  });
}

startHealthServer(client);
client.login(config.discordToken);
