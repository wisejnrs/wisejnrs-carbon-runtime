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
import { runGroundedChat } from './chat.js';
import { config } from './config.js';
import { insertWaMessage, logHistory } from './db/history.js';
import { transcribeAudio, voiceAvailable } from './voice.js';

// WhatsApp assistant line (Baileys, multi-device web protocol - unofficial,
// opt-in via WHATSAPP=true): the account's "Message yourself" chat becomes a
// direct line to MrRoboto. Text or voice-note your own number and the answer
// comes back in the same chat, prefixed 🤖. No chats are mirrored anywhere;
// the #whatsapp Discord channel is used only for QR / link status notices.

const BOT_PREFIX = '🤖 ';
const logger = pino({ level: 'silent' });
let sock: ReturnType<typeof makeWASocket> | undefined;
let statusChannel: TextChannel | undefined;
let selfJid = '';
const ownMessageIds = new Set<string>();

function extractText(message: WAMessage): string {
  const content = message.message;
  return (
    content?.conversation ??
    content?.extendedTextMessage?.text ??
    content?.imageMessage?.caption ??
    ''
  );
}

const groupNames = new Map<string, string>();

async function chatNameFor(jid: string, pushName?: string | null): Promise<string | null> {
  if (jid.endsWith('@g.us')) {
    if (!groupNames.has(jid) && sock) {
      try {
        groupNames.set(jid, (await sock.groupMetadata(jid)).subject);
      } catch {
        groupNames.set(jid, jid.split('@')[0]);
      }
    }
    return groupNames.get(jid) ?? null;
  }
  return pushName ?? null;
}

// Store every text-bearing message in SQLite so sessions can browse/search
// conversations via the whatsapp MCP tools.
async function storeMessage(message: WAMessage): Promise<void> {
  const jid = message.key.remoteJid;
  if (!jid || jid === 'status@broadcast' || !message.message) return;
  const text = extractText(message);
  if (!text) return;
  insertWaMessage({
    msgId: message.key.id ?? null,
    jid,
    chatName: await chatNameFor(jid, message.pushName),
    sender: message.key.fromMe ? null : (message.pushName ?? jid.split('@')[0]),
    fromMe: Boolean(message.key.fromMe),
    text,
    ts: Number(message.messageTimestamp ?? Date.now() / 1000) * 1000,
  });
}

async function handleSelfChat(message: WAMessage): Promise<void> {
  if (!sock || message.key.remoteJid !== selfJid) return;
  if (message.key.id && ownMessageIds.has(message.key.id)) return;

  let prompt = extractText(message).trim();
  if (prompt.startsWith(BOT_PREFIX.trim())) return; // our own reply echoing back

  if (!prompt && message.message?.audioMessage && voiceAvailable()) {
    try {
      const buffer = (await downloadMediaMessage(message, 'buffer', {})) as Buffer;
      prompt = await transcribeAudio(buffer, 'voice.ogg');
    } catch (error) {
      console.warn('[whatsapp] voice transcription failed:', error);
    }
  }
  if (!prompt) return;

  console.log(`[whatsapp] self-chat prompt: "${prompt.slice(0, 80)}"`);
  try {
    // Lazy import breaks the module cycle claudeCode -> waTools -> whatsapp -> commands.
    const { ai } = await import('./commands/index.js');
    const reply = await runGroundedChat(ai, `whatsapp:${selfJid}`, prompt, async () => {});
    const sent = await sock.sendMessage(selfJid, {
      text: BOT_PREFIX + reply.answer.slice(0, 3900),
    });
    if (sent?.key.id) {
      ownMessageIds.add(sent.key.id);
      if (ownMessageIds.size > 200) ownMessageIds.delete(ownMessageIds.values().next().value!);
    }
    await reply.cleanup();
    logHistory({
      userId: 'whatsapp',
      userTag: 'whatsapp-self',
      guildId: null,
      channelId: `whatsapp:${selfJid}`,
      command: 'whatsapp',
      input: prompt,
      output: reply.answer.slice(0, 4000),
    });
  } catch (error) {
    console.error('[whatsapp] assistant reply failed:', error);
    await sock.sendMessage(selfJid, { text: BOT_PREFIX + 'Something went wrong - try again.' }).catch(() => {});
  }
}

export function whatsappConnected(): boolean {
  return Boolean(sock && selfJid);
}

/** Send a WhatsApp message to a phone number (e.g. +61423..., 0423... assumes AU). */
export async function sendWhatsApp(number: string, text: string): Promise<string> {
  if (!sock) throw new Error('WhatsApp is not connected');
  let digits = number.replace(/[^\d]/g, '');
  if (digits.startsWith('0')) digits = config.whatsappDefaultCc + digits.slice(1);
  const results = await sock.onWhatsApp(`${digits}@s.whatsapp.net`);
  const exists = results?.[0];
  if (!exists?.exists || !exists.jid) throw new Error(`+${digits} is not on WhatsApp`);
  const sent = await sock.sendMessage(exists.jid, { text });
  if (sent?.key.id) ownMessageIds.add(sent.key.id);
  return `+${digits}`;
}

export async function startWhatsApp(client: Client): Promise<void> {
  if (!config.whatsappEnabled) return;
  for (const [, channel] of client.channels.cache) {
    if (channel.type === ChannelType.GuildText && (channel as TextChannel).name === config.whatsappChannel) {
      statusChannel = channel as TextChannel;
      break;
    }
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
        if (update.qr && statusChannel) {
          const png = await QRCode.toBuffer(update.qr, { width: 512, margin: 2 });
          await statusChannel
            .send({
              content:
                '📱 **Link WhatsApp**: phone → Settings → Linked Devices → Link a device → scan. ' +
                'Then message yourself on WhatsApp to talk to MrRoboto.',
              files: [new AttachmentBuilder(png, { name: 'whatsapp-qr.png' })],
            })
            .catch(() => {});
        }
        if (update.connection === 'open') {
          selfJid = `${sock?.user?.id.split(':')[0]}@s.whatsapp.net`;
          console.log('[whatsapp] connected; assistant line =', selfJid);
        }
        if (update.connection === 'close') {
          const code = (update.lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode;
          if (code === DisconnectReason.loggedOut) {
            console.warn('[whatsapp] logged out - relink required');
            await statusChannel?.send('⚠️ WhatsApp logged out. Restart the bot to relink.').catch(() => {});
          } else {
            setTimeout(connect, 5000);
          }
        }
      })();
    });

    sock.ev.on('messages.upsert', ({ messages, type }) => {
      for (const message of messages) {
        void storeMessage(message).catch(() => {});
        if (type === 'notify') {
          void handleSelfChat(message).catch((error) => console.warn('[whatsapp] handler failed:', error));
        }
      }
    });

    // Link-time history sync backfills recent conversations into the store.
    sock.ev.on('messaging-history.set', ({ messages }) => {
      for (const message of messages) void storeMessage(message).catch(() => {});
      console.log(`[whatsapp] history sync: ${messages.length} messages stored`);
    });
  };
  connect();
}
