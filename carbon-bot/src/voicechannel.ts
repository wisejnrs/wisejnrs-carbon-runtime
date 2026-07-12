import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Readable } from 'node:stream';
import {
  joinVoiceChannel,
  entersState,
  createAudioPlayer,
  createAudioResource,
  EndBehaviorType,
  VoiceConnectionStatus,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  type VoiceConnection,
  type AudioPlayer,
} from '@discordjs/voice';
import prism from 'prism-media';
import type { VoiceBasedChannel } from 'discord.js';
import { config } from './config.js';
import { ai } from './commands/index.js';
import { runGroundedChat } from './chat.js';
import { transcribeAudio, synthesizeSpeech, speechify } from './voice.js';

const execFileAsync = promisify(execFile);

// Live voice-channel chat. The bot joins a Discord voice channel, listens to each
// speaker, transcribes their utterances (gpt-4o-transcribe), and only acts on ones
// with the "Hey MrRoboto" wake word — then stays open for follow-ups for a short
// window so it feels conversational. Replies are spoken back with the configured
// Hume voice. It auto-leaves once the channel is empty of humans.

interface VoiceSession {
  connection: VoiceConnection;
  player: AudioPlayer;
  channel: VoiceBasedChannel;
  guildId: string;
  textChannelId: string;
  onLog?: (line: string) => void;
  convWindowUntil: number;
  activeUserId?: string;
  speaking: boolean;
  inFlight: Set<string>;
  emptyChecks: number;
  emptyTimer?: ReturnType<typeof setInterval>;
}

const sessions = new Map<string, VoiceSession>();

// Lenient so mis-transcriptions still trigger: "hey mr roboto", "hi mister roboto",
// "ok roboto", "a mr. roboto", etc.
const WAKE = /\b(?:hey|hi|ok(?:ay)?|a|hey,)\b[\s,]*(?:mr\.?|mister)?\s*roboto\b/i;

// 48kHz * 2 channels * 2 bytes = 192000 bytes/sec of decoded PCM; ~0.4s minimum
// so we skip coughs, clicks and single-word noise.
const MIN_PCM_BYTES = 76_800;

export function voiceSessionActive(guildId: string): boolean {
  return sessions.has(guildId);
}

// libsodium powers Discord's voice encryption; make sure it's initialised before
// the first connection so the handshake doesn't race (a cause of join timeouts).
let sodiumReady: Promise<void> | null = null;
function ensureSodium(): Promise<void> {
  if (!sodiumReady) {
    sodiumReady = import('libsodium-wrappers')
      .then((m) => (m as unknown as { default: { ready: Promise<void> } }).default.ready)
      .catch(() => undefined);
  }
  return sodiumReady;
}

// Decoded Discord audio is signed 16-bit LE, 48kHz stereo. gpt-4o-transcribe wants
// a normal container, so downmix to 16kHz mono WAV via ffmpeg (already in the image).
async function pcmToWav(pcm: Buffer): Promise<Buffer> {
  const child = execFileAsync(
    'ffmpeg',
    ['-f', 's16le', '-ar', '48000', '-ac', '2', '-i', 'pipe:0', '-ar', '16000', '-ac', '1', '-f', 'wav', 'pipe:1'],
    { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 },
  );
  child.child.stdin?.end(pcm);
  const { stdout } = await child;
  return stdout as unknown as Buffer;
}

async function speak(session: VoiceSession, text: string): Promise<void> {
  try {
    session.speaking = true;
    const mp3 = await synthesizeSpeech(text);
    const resource = createAudioResource(Readable.from(mp3), { inputType: StreamType.Arbitrary });
    session.player.play(resource);
    await entersState(session.player, AudioPlayerStatus.Playing, 10_000).catch(() => {});
    await entersState(session.player, AudioPlayerStatus.Idle, 120_000).catch(() => {});
  } catch (err) {
    console.warn('[voicechannel] speak failed:', (err as Error).message);
  } finally {
    // Small tail so the receiver doesn't transcribe the end of our own playback.
    setTimeout(() => {
      session.speaking = false;
    }, 400);
  }
}

function listen(session: VoiceSession, userId: string): void {
  // One capture per speaker at a time; never capture while we're talking (feedback).
  if (session.inFlight.has(userId) || session.speaking) return;
  session.inFlight.add(userId);
  const opus = session.connection.receiver.subscribe(userId, {
    end: { behavior: EndBehaviorType.AfterSilence, duration: 1000 },
  });
  const decoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });
  const chunks: Buffer[] = [];
  const done = () => session.inFlight.delete(userId);
  decoder.on('data', (chunk: Buffer) => chunks.push(chunk));
  opus.on('error', done);
  decoder.on('error', done);
  opus.pipe(decoder);
  decoder.on('end', async () => {
    done();
    const pcm = Buffer.concat(chunks);
    console.log(`[voicechannel] utterance captured: ${pcm.length} bytes (min ${MIN_PCM_BYTES})`);
    if (pcm.length < MIN_PCM_BYTES || session.speaking) return;
    try {
      const wav = await pcmToWav(pcm);
      const text = (await transcribeAudio(wav, 'utterance.wav')).trim();
      console.log(`[voicechannel] transcript: "${text}"`);
      if (text) await handleUtterance(session, userId, text);
    } catch (err) {
      console.warn('[voicechannel] transcription failed:', (err as Error).message);
    }
  });
}

async function handleUtterance(session: VoiceSession, userId: string, text: string): Promise<void> {
  const now = Date.now();
  const woken = WAKE.test(text);
  // Follow-ups may skip the wake word, but ONLY for the same person who woke it and
  // only briefly - otherwise in a shared channel it answers everyone's chatter.
  const inWindow = now < session.convWindowUntil && userId === session.activeUserId;
  if (!woken && !inWindow) return; // needs the wake word

  session.activeUserId = userId;
  const query = text.replace(WAKE, '').replace(/^[\s,.:;-]+/, '').trim();
  session.onLog?.(`🎙️ ${text}`);
  if (!query) {
    session.convWindowUntil = now + config.voiceConvWindowMs;
    await speak(session, 'Yes Mike?');
    return;
  }

  session.convWindowUntil = Number.MAX_SAFE_INTEGER; // hold the window open while thinking
  try {
    const reply = await runGroundedChat(ai, session.textChannelId, query, async () => {});
    const answer = reply.answer;
    await reply.cleanup?.();
    session.onLog?.(`🤖 ${answer.slice(0, 400)}`);
    await speak(session, speechify(answer));
  } catch (err) {
    console.error('[voicechannel] reply failed:', err);
    await speak(session, 'Sorry, something went wrong on my end.');
  } finally {
    session.convWindowUntil = Date.now() + config.voiceConvWindowMs;
  }
}

// Count real (non-bot) people in the channel so we can leave once it's just us.
function humanCount(channel: VoiceBasedChannel): number {
  return channel.members.filter((m) => !m.user.bot).size;
}

async function connect(channel: VoiceBasedChannel): Promise<VoiceConnection> {
  await ensureSodium();
  const attempt = () => {
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });
    connection.on('stateChange', (o, n) => console.log(`[voicechannel] conn: ${o.status} -> ${n.status}`));
    connection.on('error', (e) => console.warn('[voicechannel] conn error:', (e as Error).message));
    return connection;
  };
  let connection = attempt();
  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
    return connection;
  } catch (first) {
    // One clean retry: tear down and try a fresh connection before giving up.
    console.warn('[voicechannel] first connect failed, retrying:', (first as Error).message);
    try {
      connection.destroy();
    } catch {
      /* noop */
    }
    connection = attempt();
    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
    return connection;
  }
}

export async function startVoiceSession(
  channel: VoiceBasedChannel,
  textChannelId: string,
  onLog?: (line: string) => void,
): Promise<void> {
  const guildId = channel.guild.id;
  stopVoiceSession(guildId); // clear any prior session

  let connection: VoiceConnection;
  try {
    connection = await connect(channel);
  } catch (err) {
    console.error('[voicechannel] could not reach Ready, destroying:', (err as Error).message);
    throw err; // no ghost: connect() already destroyed the attempts
  }

  const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
  connection.subscribe(player);

  const session: VoiceSession = {
    connection,
    player,
    channel,
    guildId,
    textChannelId,
    onLog,
    convWindowUntil: 0,
    speaking: false,
    inFlight: new Set(),
    emptyChecks: 0,
  };
  sessions.set(guildId, session);

  connection.receiver.speaking.on('start', (userId) => {
    console.log(`[voicechannel] hearing speech from ${userId}`);
    listen(session, userId);
  });

  // Recover transient drops; a real disconnect tears the session down cleanly.
  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
    } catch {
      stopVoiceSession(guildId);
    }
  });

  // Leave once the channel has no humans for ~30s (two consecutive empty checks).
  session.emptyTimer = setInterval(() => {
    if (humanCount(channel) === 0) {
      session.emptyChecks += 1;
      if (session.emptyChecks >= 2) {
        console.log('[voicechannel] channel empty, leaving');
        stopVoiceSession(guildId);
      }
    } else {
      session.emptyChecks = 0;
    }
  }, 15_000);

  console.log('[voicechannel] connected; playing greeting');
  await speak(session, 'Voice chat is live. Say, hey Mister Robot-oh, followed by your question.');
  console.log('[voicechannel] greeting finished; listening for the wake word');
}

export function stopVoiceSession(guildId: string): boolean {
  const session = sessions.get(guildId);
  if (!session) return false;
  if (session.emptyTimer) clearInterval(session.emptyTimer);
  try {
    session.connection.destroy();
  } catch {
    /* already gone */
  }
  sessions.delete(guildId);
  return true;
}
