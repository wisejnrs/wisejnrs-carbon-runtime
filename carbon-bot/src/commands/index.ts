import {
  AttachmentBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
} from 'discord.js';
import { createProvider } from '../ai/index.js';
import { corpusCount, ingestCorpus } from '../rag/index.js';
import { docmostSearch } from '../rag/knowledge.js';
import { runGroundedChat, replyFooter } from '../chat.js';
import { getWeather } from '../weather.js';
import {
  availableImageProviders,
  generateImage,
  type ImageProvider,
  type ImageSize,
} from '../imagegen.js';
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

    try {
      const reply = await runGroundedChat(ai, interaction.channelId, message, (status) =>
        interaction.editReply(status),
      );
      const parts = chunk(reply.answer + replyFooter(reply));
      await interaction.editReply({ content: parts[0], files: reply.attachments });
      for (const part of parts.slice(1)) await interaction.followUp(part);
      await reply.cleanup();
      audit(interaction, message, reply.answer);
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
    .setDescription('Detect objects in an image (YOLO26)')
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
        content: 'YOLO model not found on the server (models/*.onnx).',
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

const weather: Command = {
  data: new SlashCommandBuilder()
    .setName('weather')
    .setDescription('Current weather and 3-day forecast (Open-Meteo)')
    .addStringOption((option) =>
      option.setName('location').setDescription('City or place name').setRequired(true),
    ),
  async execute(interaction) {
    const location = interaction.options.getString('location', true);
    await interaction.deferReply();
    try {
      const report = await getWeather(location);
      await interaction.editReply(report.slice(0, 2000));
      audit(interaction, location, report);
    } catch (error) {
      console.error('[weather] failed:', error);
      await interaction.editReply('Weather lookup failed. Try again later.');
    }
  },
};

const docs: Command = {
  data: new SlashCommandBuilder()
    .setName('docs')
    .setDescription('Search the Docmost wiki (docs.wisejnrs.net)')
    .addStringOption((option) =>
      option.setName('query').setDescription('What to search for').setRequired(true),
    ),
  async execute(interaction) {
    const query = interaction.options.getString('query', true);
    await interaction.deferReply();
    const pages = await docmostSearch(query);
    if (!pages.length) {
      await interaction.editReply(`No wiki pages found for "${query}".`);
      return;
    }
    const lines = pages.slice(0, 6).map((page) => {
      const title = page.title === 'Untitled' ? '(untitled page)' : page.title;
      const excerpt = page.excerpt.replace(/\s+/g, ' ').slice(0, 140);
      return `**[${title}](https://docs.wisejnrs.net/p/${page.id})**\n${excerpt}`;
    });
    const reply = lines.join('\n\n').slice(0, 2000);
    await interaction.editReply(reply);
    audit(interaction, query, `${pages.length} results`);
  },
};

const imagine: Command = {
  data: new SlashCommandBuilder()
    .setName('imagine')
    .setDescription('Generate an image (OpenAI gpt-image-1 or Gemini)')
    .addStringOption((option) =>
      option.setName('prompt').setDescription('Describe the image').setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('provider')
        .setDescription('Image model to use')
        .addChoices(
          { name: 'OpenAI gpt-image-1', value: 'openai' },
          { name: 'Gemini (nano banana)', value: 'gemini' },
        ),
    )
    .addStringOption((option) =>
      option
        .setName('size')
        .setDescription('Image size (OpenAI only)')
        .addChoices(
          { name: 'Square 1024x1024', value: '1024x1024' },
          { name: 'Wide 1536x1024', value: '1536x1024' },
          { name: 'Tall 1024x1536', value: '1024x1536' },
        ),
    ),
  async execute(interaction) {
    const prompt = interaction.options.getString('prompt', true);
    const providers = availableImageProviders();
    if (!providers.length) {
      await interaction.reply({
        content: 'No image provider configured (need OPENAI_API_KEY or GEMINI_API_KEY).',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const provider = (interaction.options.getString('provider') ?? providers[0]) as ImageProvider;
    if (!providers.includes(provider)) {
      await interaction.reply({
        content: `Provider "${provider}" is not configured on the server.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const size = (interaction.options.getString('size') ?? '1024x1024') as ImageSize;
    await interaction.deferReply();
    try {
      const image = await generateImage(prompt, provider, size);
      const caption = `**${prompt.slice(0, 500)}**` + (image.note ? `\n-# ${image.note.slice(0, 800)}` : '');
      await interaction.editReply({
        content: caption.slice(0, 2000),
        files: [new AttachmentBuilder(image.buffer, { name: image.filename })],
      });
      audit(interaction, `${provider}: ${prompt}`, image.filename);
    } catch (error) {
      console.error('[imagine] failed:', error);
      await interaction.editReply(
        `Image generation failed: ${error instanceof Error ? error.message.slice(0, 300) : error}`,
      );
    }
  },
};

export const commands: Command[] = [ping, userinfo, cat, ask, corpus, yolov, weather, docs, imagine];
export { ai };
