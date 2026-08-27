import {
  ActionRowBuilder,
  AttachmentBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import { listProjects } from '../projectFactory.js';
import { config } from '../config.js';
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
import {
  instagramConfigured,
  linkedinConfigured,
  postToInstagram,
  postToLinkedIn,
} from '../social.js';
import { sendWhatsApp, whatsappConnected } from '../whatsapp.js';
import { startVoiceSession, stopVoiceSession } from '../voicechannel.js';
import { logHistory } from '../db/history.js';
import type { GuildMember } from 'discord.js';

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
      const reply = await runGroundedChat(
        ai,
        interaction.channelId,
        message,
        (status) => interaction.editReply(status),
        config.ownerUserIds.includes(interaction.user.id),
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
    .setDescription('Search the Docmost wiki')
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
      const heading = config.docmostUrl
        ? `**[${title}](${config.docmostUrl}/p/${page.id})**`
        : `**${title}**`;
      return `${heading}\n${excerpt}`;
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

const post: Command = {
  data: new SlashCommandBuilder()
    .setName('post')
    .setDescription('Publish to a social platform (official APIs)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) =>
      option
        .setName('platform')
        .setDescription('Where to post')
        .setRequired(true)
        .addChoices(
          { name: 'LinkedIn', value: 'linkedin' },
          { name: 'Instagram', value: 'instagram' },
        ),
    )
    .addStringOption((option) =>
      option.setName('text').setDescription('Post text / caption').setRequired(true),
    )
    .addAttachmentOption((option) =>
      option.setName('image').setDescription('Image (required for Instagram)'),
    ),
  async execute(interaction) {
    const platform = interaction.options.getString('platform', true);
    const text = interaction.options.getString('text', true);
    const image = interaction.options.getAttachment('image');

    if (platform === 'linkedin' && !linkedinConfigured()) {
      await interaction.reply({
        content: 'LinkedIn is not configured (need LINKEDIN_ACCESS_TOKEN + LINKEDIN_AUTHOR_URN - see SETUP-social.md).',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (platform === 'instagram') {
      if (!instagramConfigured()) {
        await interaction.reply({
          content: 'Instagram is not configured (need INSTAGRAM_USER_ID + INSTAGRAM_ACCESS_TOKEN - see SETUP-social.md).',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (!image?.contentType?.startsWith('image/')) {
        await interaction.reply({
          content: 'Instagram posts need an image attachment (JPEG works best).',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    await interaction.deferReply();
    try {
      let link: string;
      if (platform === 'linkedin') {
        const buffer = image?.contentType?.startsWith('image/')
          ? Buffer.from(await (await fetch(image.url)).arrayBuffer())
          : undefined;
        link = await postToLinkedIn(text, buffer);
      } else {
        link = await postToInstagram(text, image!.url);
      }
      await interaction.editReply(`✅ Posted to ${platform}: ${link}`);
      audit(interaction, `${platform}: ${text.slice(0, 200)}`, link);
    } catch (error) {
      console.error('[post] failed:', error);
      await interaction.editReply(
        `Posting failed: ${error instanceof Error ? error.message.slice(0, 400) : error}`,
      );
    }
  },
};

const whatsapp: Command = {
  data: new SlashCommandBuilder()
    .setName('whatsapp')
    .setDescription('Send a WhatsApp message from your linked account')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) =>
      option.setName('to').setDescription('Phone number (+61... or 04...)').setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('message').setDescription('The message to send').setRequired(true),
    ),
  async execute(interaction) {
    const to = interaction.options.getString('to', true);
    const text = interaction.options.getString('message', true);
    if (!whatsappConnected()) {
      await interaction.reply({
        content: 'WhatsApp is not connected (check #whatsapp for the QR / status).',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const recipient = await sendWhatsApp(to, text);
      await interaction.editReply(`✅ Sent to ${recipient} on WhatsApp.`);
      audit(interaction, `${to}: ${text.slice(0, 200)}`, 'sent');
    } catch (error) {
      await interaction.editReply(
        `Send failed: ${error instanceof Error ? error.message.slice(0, 200) : error}`,
      );
    }
  },
};

const talk: Command = {
  data: new SlashCommandBuilder()
    .setName('talk')
    .setDescription("Join your voice channel for live voice chat (say 'Hey MrRoboto')")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    const member = interaction.member as GuildMember | null;
    const channel = member?.voice?.channel ?? null;
    if (!channel) {
      await interaction.reply({
        content: 'Hop into a voice channel first, then run /talk and I will join you.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const textChannel = interaction.channel;
      await startVoiceSession(channel, interaction.channelId, (line) => {
        if (textChannel && 'send' in textChannel) void textChannel.send(line.slice(0, 1900)).catch(() => {});
      });
      await interaction.editReply(
        `🔊 Joined **${channel.name}**. Say “Hey MrRoboto…” and I'll answer out loud — follow-ups don't need the wake word for ${Math.round(config.voiceConvWindowMs / 1000)}s. Run /leave to end.`,
      );
      audit(interaction, `join ${channel.name}`);
    } catch (error) {
      console.error('[talk] join failed:', error);
      await interaction.editReply(
        `Couldn't join voice: ${error instanceof Error ? error.message.slice(0, 300) : error}`,
      );
    }
  },
};

const leave: Command = {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Leave the voice channel / end voice chat')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    const left = interaction.guildId ? stopVoiceSession(interaction.guildId) : false;
    await interaction.reply({
      content: left ? '👋 Left the voice channel.' : "I'm not in a voice channel.",
      flags: MessageFlags.Ephemeral,
    });
    audit(interaction);
  },
};

const lab: Command = {
  data: new SlashCommandBuilder().setName('lab').setDescription("Browse MrRoboto's lab projects"),
  async execute(interaction) {
    const projects = listProjects();
    if (!projects.length) {
      await interaction.reply({
        content: "No lab projects yet — I create them in #lab-… channels when I spot a genuine need.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const menu = new StringSelectMenuBuilder()
      .setCustomId('lab-open')
      .setPlaceholder('Pick a lab project')
      .addOptions(
        projects.slice(0, 25).map((p) => ({
          label: p.title.slice(0, 100),
          value: p.slug,
          description: `mrroboto-lab/projects/${p.slug}`.slice(0, 100),
        })),
      );
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
    await interaction.reply({
      content: `${projects.length} lab project(s) — pick one:`,
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  },
};

export const commands: Command[] = [ping, userinfo, cat, ask, corpus, yolov, weather, docs, imagine, post, whatsapp, talk, leave, lab];
export { ai };
