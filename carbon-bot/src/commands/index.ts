import {
  AttachmentBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
} from 'discord.js';
import { config } from '../config.js';
import { createProvider, getHistory, pushHistory } from '../ai/index.js';
import { askWithRag, corpusCount, ingestCorpus } from '../rag/index.js';
import { detectObjects, yoloAvailable } from '../yolo/detect.js';
import { logHistory } from '../db/history.js';

export interface Command {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

const ai = createProvider();

// Discord caps messages at 2000 chars; split long AI answers across follow-ups.
function chunk(text: string, size = 1990): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size));
  return chunks.length ? chunks : ['(empty response)'];
}

function audit(
  interaction: ChatInputCommandInteraction,
  input?: string,
  output?: string,
): void {
  logHistory({
    userId: interaction.user.id,
    userTag: interaction.user.tag,
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    command: interaction.commandName,
    input,
    output: output?.slice(0, 4000),
  });
}

const ping: Command = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Health check'),
  async execute(interaction) {
    await interaction.reply(`Pong! Gateway latency: ${interaction.client.ws.ping}ms`);
    audit(interaction);
  },
};

const userinfo: Command = {
  data: new SlashCommandBuilder().setName('userinfo').setDescription('Show your user info'),
  async execute(interaction) {
    await interaction.reply({
      content: `**${interaction.user.tag}** (id: ${interaction.user.id})`,
      flags: MessageFlags.Ephemeral,
    });
    audit(interaction);
  },
};

const cat: Command = {
  data: new SlashCommandBuilder().setName('cat').setDescription('Fetch a random cat picture'),
  async execute(interaction) {
    await interaction.deferReply();
    const response = await fetch('https://cataas.com/cat');
    if (!response.ok) {
      await interaction.editReply('The cat API is napping. Try again later.');
      return;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    await interaction.editReply({
      files: [new AttachmentBuilder(buffer, { name: 'cat.jpg' })],
    });
    audit(interaction);
  },
};

const ask: Command = {
  data: new SlashCommandBuilder()
    .setName('ask')
    .setDescription(`Ask the AI, grounded in the corpus (${ai.name}: ${ai.model})`)
    .addStringOption((option) =>
      option.setName('message').setDescription('What do you want to ask?').setRequired(true),
    ),
  async execute(interaction) {
    const message = interaction.options.getString('message', true);
    await interaction.deferReply();

    pushHistory(interaction.channelId, { role: 'user', content: message });
    try {
      const { answer, sources } = await askWithRag(
        ai,
        getHistory(interaction.channelId),
        message,
      );
      pushHistory(interaction.channelId, { role: 'assistant', content: answer });

      const footer = sources.length ? `\n-# Sources: ${sources.join(', ')}`.slice(0, 500) : '';
      const parts = chunk(answer + footer);
      await interaction.editReply(parts[0]);
      for (const part of parts.slice(1)) await interaction.followUp(part);
      audit(interaction, message, answer);
    } catch (error) {
      console.error('[ask] AI request failed:', error);
      await interaction.editReply('Something went wrong talking to the AI. Check the logs.');
    }
  },
};

const corpus: Command = {
  data: new SlashCommandBuilder()
    .setName('corpus')
    .setDescription('Re-ingest the knowledge corpus (local folder + Google Drive)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const before = await corpusCount();
      const result = await ingestCorpus();
      const summary =
        result.documents === 0
          ? 'No documents found. Drop files into the corpus folder or configure Google Drive.'
          : `Ingested **${result.documents}** documents into **${result.chunks}** chunks (was ${before}).`;
      await interaction.editReply(summary);
      audit(interaction, undefined, summary);
    } catch (error) {
      console.error('[corpus] Ingest failed:', error);
      await interaction.editReply(`Ingest failed: ${error instanceof Error ? error.message : error}`);
    }
  },
};

const yolov: Command = {
  data: new SlashCommandBuilder()
    .setName('yolov')
    .setDescription('Detect objects in an image (YOLOv8)')
    .addAttachmentOption((option) =>
      option.setName('image').setDescription('Image to analyse').setRequired(true),
    ),
  async execute(interaction) {
    const attachment = interaction.options.getAttachment('image', true);
    if (!attachment.contentType?.startsWith('image/')) {
      await interaction.reply({
        content: 'That attachment is not an image.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (!yoloAvailable()) {
      await interaction.reply({
        content: 'YOLO model not found on the server (models/yolov8s.onnx).',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.deferReply();
    try {
      const response = await fetch(attachment.url);
      const buffer = Buffer.from(await response.arrayBuffer());
      const { detections, annotated } = await detectObjects(buffer);

      const summary = detections.length
        ? detections
            .map((d) => `**${d.label}** ${(d.confidence * 100).toFixed(0)}%`)
            .join(', ')
            .slice(0, 1900)
        : 'No objects detected.';
      await interaction.editReply({
        content: summary,
        files: [new AttachmentBuilder(annotated, { name: 'detections.jpg' })],
      });
      audit(interaction, attachment.name ?? attachment.url, summary);
    } catch (error) {
      console.error('[yolov] Detection failed:', error);
      await interaction.editReply('Object detection failed. Check the logs.');
    }
  },
};

export const commands: Command[] = [ping, userinfo, cat, ask, corpus, yolov];
export { ai };
