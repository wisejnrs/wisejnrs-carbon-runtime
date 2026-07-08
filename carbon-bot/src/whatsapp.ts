import path from 'node:path';
import { AttachmentBuilder, ChannelType, Client, type TextChannel } from 'discord.js';
import makeWASocket, {
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WAMessage,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import { config } from './config.js';
import { transcribeAudio, voiceAvailable } from './voice.js';

// Personal WhatsApp bridge (Baileys, multi-device web protocol - the same
// approach OpenClaw's WhatsApp channel uses). Inbound messages land in the
// #whatsapp Discord channel; replying to a bridged message sends the reply
// back to that WhatsApp chat. Link by scanning the QR the bot posts.
// NOTE: unofficial protocol - technically against WhatsApp ToS.

const logger = pino({ level: 'silent' });
let sock: ReturnType<typeof makeWASocket> | undefined;
let bridgeChannel: TextChannel | undefined;

// discord message id -> whatsapp jid, so Discord replies route back
const replyMap = new Map<string, string>();
function remember(discordId: string, jid: string): void {
  replyMap.set(discordId, jid);
  if (replyMap.size > 500) replyMap.delete(replyMap.keys().next().value!);
}

export function whatsappJidFor(discordMessageId: string): string | undefined {
  return replyMap.get(discordMessageId);
}

export function isWhatsappBridgeChannel(channelName: string): boolean {
  return config.whatsappEnabled && channelName === config.whatsappChannel;
}

export async function sendWhatsApp(jid: string, text: string): Promise<void> {
  if (!sock) throw new Error('WhatsApp is not connected');
  await sock.sendMessage(jid, { text });
}

function extractText(message: WAMessage): string {
  const content = message.message;
  return (
    content?.conversation ??
    content?.extendedTextMessage?.text ??
    content?.imageMessage?.caption ??
    content?.videoMessage?.caption ??
    ''
  );
}

async function bridgeInbound(message: WAMessage): Promise<void> {
  if (!bridgeChannel || !message.message || message.key.fromMe) return;
  const jid = message.key.remoteJid;
  if (!jid || jid === 'status@broadcast') return;

  const sender = message.pushName || jid.split('@')[0];
  const group = jid.endsWith('@g.us') ? ' (group)' : '';
  const text = extractText(message);
  const files: AttachmentBuilder[] = [];
  let extra = '';

  const media = message.message.imageMessage
    ? { kind: 'image', ext: 'jpg' }
    : message.message.audioMessage
      ? { kind: 'audio', ext: 'ogg' }
      : message.message.videoMessage
        ? { kind: 'video', ext: 'mp4' }
        : message.message.documentMessage
          ? { kind: 'document', ext: 'bin' }
          : undefined;
  if (media) {
    try {
      const buffer = (await downloadMediaMessage(message, 'buffer', {})) as Buffer;
      const name = message.message.documentMessage?.fileName ?? `whatsapp-${media.kind}.${media.ext}`;
      if (buffer.length <= 9 * 1024 * 1024) files.push(new AttachmentBuilder(buffer, { name }));
      else extra += `\n-# ${media.kind} too large to bridge (${Math.round(buffer.length / 1024 / 1024)}MB)`;
      if (media.kind === 'audio' && voiceAvailable() && buffer.length < 5 * 1024 * 1024) {
        const transcript = await transcribeAudio(buffer, 'voice.ogg').catch(() => '');
        if (transcript) extra += `\n-# 🎙️ "${transcript.slice(0, 400)}"`;
      }
    } catch (error) {
      extra += '\n-# (media could not be downloaded)';
      logger.debug?.(error);
    }
  }

  const sent = await bridgeChannel
    .send({
      content: `**${sender}**${group}: ${text || (media ? `[${media.kind}]` : '[unsupported message]')}${extra}`.slice(0, 2000),
      files,
    })
    .catch(() => undefined);
  if (sent) remember(sent.id, jid);
}

export async function startWhatsApp(client: Client): Promise<void> {
  if (!config.whatsappEnabled) return;
  for (const [, channel] of client.channels.cache) {
    if (channel.type === ChannelType.GuildText && (channel as TextChannel).name === config.whatsappChannel) {
      bridgeChannel = channel as TextChannel;
      break;
    }
  }
  if (!bridgeChannel) {
    console.warn(`[whatsapp] bridge channel #${config.whatsappChannel} not found - disabled`);
    return;
  }

  const { state, saveCreds } = await useMultiFileAuthState(path.join(config.dataDir, 'whatsapp'));
  const version = await fetchLatestBaileysVersion()
    .then((v) => v.version)
    .catch(() => undefined);

  const connect = (): void => {
    sock = makeWASocket({ auth: state, logger, version });
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      void (async () => {
        if (update.qr) {
          const png = await QRCode.toBuffer(update.qr, { width: 512, margin: 2 });
          await bridgeChannel!
            .send({
              content:
                '📱 **Link WhatsApp**: phone → WhatsApp → Settings → Linked Devices → ' +
                'Link a device → scan this (expires in ~60s; a fresh code posts automatically).',
              files: [new AttachmentBuilder(png, { name: 'whatsapp-qr.png' })],
            })
            .catch(() => {});
        }
        if (update.connection === 'open') {
          console.log('[whatsapp] connected as', sock?.user?.id);
          await bridgeChannel!.send('✅ WhatsApp linked - your messages will appear here.').catch(() => {});
        }
        if (update.connection === 'close') {
          const code = (update.lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode;
          if (code === DisconnectReason.loggedOut) {
            console.warn('[whatsapp] logged out - relink required');
            await bridgeChannel!.send('⚠️ WhatsApp logged out. Restart the bot to relink.').catch(() => {});
          } else {
            console.log('[whatsapp] connection closed, reconnecting...');
            setTimeout(connect, 5000);
          }
        }
      })();
    });

    sock.ev.on('messages.upsert', ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const message of messages) {
        void bridgeInbound(message).catch((error) => console.warn('[whatsapp] bridge failed:', error));
      }
    });
  };
  connect();
}
