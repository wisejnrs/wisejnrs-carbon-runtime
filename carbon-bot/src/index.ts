import { Client, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import { config } from './config.js';
import { ai, commands } from './commands/index.js';
import { getHistory, pushHistory } from './ai/index.js';
import { askWithRag } from './rag/index.js';
import { startHealthServer } from './health.js';
import { logHistory } from './db/history.js';

const intents = [GatewayIntentBits.Guilds];
if (config.enableMentionChat) {
  // Both require the privileged Message Content intent in the developer portal.
  intents.push(GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent);
}

const client = new Client({ intents });
const commandMap = new Map(commands.map((command) => [command.data.name, command]));

client.once(Events.ClientReady, async (ready) => {
  console.log(`Logged in as ${ready.user.tag}`);
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

// Successor to the old CommandHandlingService mention path: @mention the bot to chat.
if (config.enableMentionChat) {
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !client.user) return;
    if (!message.mentions.has(client.user)) return;
    const content = message.content.replaceAll(`<@${client.user.id}>`, '').trim();
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
        command: 'mention',
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
