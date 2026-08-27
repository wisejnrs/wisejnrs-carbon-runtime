import {
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  ContextMenuCommandBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type Interaction,
  type MessageContextMenuCommandInteraction,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js';
import { liteQuery } from './ai/claudeCode.js';
import { provisionLabChannel } from './discordTools.js';
import { brandEmbed, channelUrl } from './embeds.js';
import { createProject, listProjects } from './projectFactory.js';

// Non-slash interactions: message context-menu commands, the modal they open,
// the buttons on the replies, and the /lab select menu. index.ts routes every
// interaction that isn't a chat-input command into handleInteraction().

export const contextMenuCommands = [
  new ContextMenuCommandBuilder().setName('Summarise').setType(ApplicationCommandType.Message),
  new ContextMenuCommandBuilder().setName('Make a project').setType(ApplicationCommandType.Message),
];

// Short-lived stash so a button (e.g. "Post to channel") can recover the text it
// needs — customIds are capped at 100 chars, so we key into this instead.
const pending = new Map<string, { channelId: string; text: string }>();
let seq = 0;
function stash(value: { channelId: string; text: string }): string {
  const key = `${Date.now().toString(36)}${(seq++).toString(36)}`;
  pending.set(key, value);
  setTimeout(() => pending.delete(key), 10 * 60 * 1000).unref?.();
  return key;
}

export async function handleInteraction(interaction: Interaction): Promise<void> {
  if (interaction.isMessageContextMenuCommand()) return onContextMenu(interaction);
  if (interaction.isModalSubmit()) return onModal(interaction);
  if (interaction.isButton()) return onButton(interaction);
  if (interaction.isStringSelectMenu()) return onSelect(interaction);
}

async function onContextMenu(i: MessageContextMenuCommandInteraction): Promise<void> {
  const seed = (i.targetMessage.content || '').trim();

  if (i.commandName === 'Summarise') {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    const summary = await liteQuery(
      `Summarise this Discord message in 2–3 crisp sentences:\n\n${(seed || '(no text)').slice(0, 4000)}`,
      'You are MrRoboto. Be concise and genuinely useful.',
    ).catch(() => 'Could not summarise that one.');
    const token = stash({ channelId: i.channelId ?? '', text: summary });
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`pubsum:${token}`).setLabel('Post to channel').setEmoji('📢').setStyle(ButtonStyle.Primary),
    );
    await i.editReply({ embeds: [brandEmbed({ title: '📝 Summary', description: summary })], components: [row] });
    return;
  }

  if (i.commandName === 'Make a project') {
    const modal = new ModalBuilder().setCustomId('mkproj').setTitle('Start a lab project');
    const name = new TextInputBuilder()
      .setCustomId('name').setLabel('Project name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(60);
    if (seed) name.setValue(seed.split('\n')[0].slice(0, 60));
    const why = new TextInputBuilder()
      .setCustomId('why').setLabel('Why / what problem it solves').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500);
    if (seed) why.setValue(seed.slice(0, 500));
    const summary = new TextInputBuilder()
      .setCustomId('summary').setLabel('One line on what it does (optional)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(120);
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(name),
      new ActionRowBuilder<TextInputBuilder>().addComponents(why),
      new ActionRowBuilder<TextInputBuilder>().addComponents(summary),
    );
    await i.showModal(modal);
  }
}

async function onModal(i: ModalSubmitInteraction): Promise<void> {
  if (i.customId !== 'mkproj') return;
  await i.deferReply();
  const name = i.fields.getTextInputValue('name');
  const why = i.fields.getTextInputValue('why');
  const summary = i.fields.getTextInputValue('summary') || undefined;

  let res;
  try {
    res = createProject(name, why, summary);
  } catch (e) {
    await i.editReply(`Couldn't create it: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }
  const prov = await provisionLabChannel(res.slug, { name, why, summary });
  const components = [];
  if (prov.channel && i.guildId) {
    components.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(`Open #lab-${res.slug}`).setURL(channelUrl(i.guildId, prov.channel.id)),
      ),
    );
  }
  await i.editReply({
    embeds: [
      brandEmbed({
        title: `🌱 Started “${name}”`,
        description: why,
        fields: [
          { name: 'Folder', value: `\`mrroboto-lab/projects/${res.slug}\``, inline: true },
          { name: 'Pushed', value: res.pushed ? 'yes' : 'pending', inline: true },
        ],
        footer: 'Build it out in its channel.',
      }),
    ],
    components,
  });
}

async function onButton(i: ButtonInteraction): Promise<void> {
  if (i.customId.startsWith('pubsum:')) {
    const rec = pending.get(i.customId.slice('pubsum:'.length));
    if (!rec) {
      await i.reply({ content: 'That summary expired — run Summarise again.', flags: MessageFlags.Ephemeral });
      return;
    }
    const ch = await i.client.channels.fetch(rec.channelId).catch(() => null);
    if (ch?.isTextBased() && 'send' in ch) {
      await ch.send({ embeds: [brandEmbed({ title: '📝 Summary', description: rec.text })] });
    }
    await i.update({ content: 'Posted to the channel. ✅', embeds: [], components: [] });
  }
}

async function onSelect(i: StringSelectMenuInteraction): Promise<void> {
  if (i.customId !== 'lab-open') return;
  const slug = i.values[0];
  const proj = listProjects().find((p) => p.slug === slug);
  const channelName = `lab-${slug}`;
  const ch = i.guild?.channels.cache.find((c) => c.name === channelName);
  const components = [];
  if (ch && i.guildId) {
    components.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(`Open #${channelName}`).setURL(channelUrl(i.guildId, ch.id)),
      ),
    );
  }
  await i.reply({
    flags: MessageFlags.Ephemeral,
    embeds: [
      brandEmbed({
        title: `🧪 ${proj?.title ?? slug}`,
        description: `Lab project \`${slug}\``,
        fields: [{ name: 'Folder', value: `\`mrroboto-lab/projects/${slug}\`` }],
      }),
    ],
    components,
  });
}
