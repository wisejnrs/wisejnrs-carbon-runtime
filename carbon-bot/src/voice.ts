import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from './config.js';

const execFileAsync = promisify(execFile);

// Discord voice messages (OpenClaw minimal path): inbound notes -> Whisper
// transcription; outbound replies -> TTS -> ffmpeg to OGG/Opus 48kHz mono ->
// Discord's 3-step voice-message upload (flag 1<<13) with a real waveform.

export function voiceAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function transcribeAudio(buffer: Buffer, filename = 'voice.ogg'): Promise<string> {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(buffer)]), filename);
  form.append('model', config.sttModel);
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });
  if (!response.ok) {
    throw new Error(`Transcription failed (${response.status}): ${(await response.text()).slice(0, 150)}`);
  }
  const data = (await response.json()) as { text: string };
  return data.text.trim();
}

async function synthesize(text: string): Promise<Buffer> {
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.ttsModel,
      voice: config.ttsVoice,
      input: text.slice(0, 2000),
      response_format: 'mp3',
    }),
  });
  if (!response.ok) {
    throw new Error(`TTS failed (${response.status}): ${(await response.text()).slice(0, 150)}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function ffmpeg(args: string[], input: Buffer): Promise<Buffer> {
  const child = execFileAsync('ffmpeg', args, {
    encoding: 'buffer',
    maxBuffer: 32 * 1024 * 1024,
  });
  child.child.stdin?.end(input);
  const { stdout } = await child;
  return stdout as unknown as Buffer;
}

interface VoiceNote {
  ogg: Buffer;
  durationSecs: number;
  waveform: string; // base64, 256 amplitude samples
}

async function toVoiceNote(audio: Buffer): Promise<VoiceNote> {
  // Discord requires OGG/Opus; 48kHz keeps playback speed correct.
  const ogg = await ffmpeg(
    ['-i', 'pipe:0', '-ac', '1', '-ar', '48000', '-c:a', 'libopus', '-b:a', '64k', '-f', 'ogg', 'pipe:1'],
    audio,
  );
  const pcm = await ffmpeg(
    ['-i', 'pipe:0', '-ac', '1', '-ar', '8000', '-f', 's16le', 'pipe:1'],
    audio,
  );
  const samples = pcm.length / 2;
  const durationSecs = Math.max(samples / 8000, 0.1);
  const buckets = new Uint8Array(256);
  const bucketSize = Math.max(1, Math.floor(samples / 256));
  for (let i = 0; i < 256; i++) {
    let peak = 0;
    const start = i * bucketSize;
    for (let s = start; s < Math.min(start + bucketSize, samples); s++) {
      peak = Math.max(peak, Math.abs(pcm.readInt16LE(s * 2)));
    }
    buckets[i] = Math.min(255, Math.round((peak / 32768) * 255));
  }
  return { ogg, durationSecs, waveform: Buffer.from(buckets).toString('base64') };
}

/** Make reply text listenable: drop code blocks and markdown, cap the length. */
export function speechify(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' (code omitted) ')
    .replace(/https?:\/\/\S+/g, ' (link) ')
    .replace(/[*_#>`|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 900);
}

/** TTS the text and post it as a native Discord voice message in the channel. */
export async function sendVoiceReply(channelId: string, text: string): Promise<void> {
  const note = await toVoiceNote(await synthesize(text));
  const api = 'https://discord.com/api/v10';
  const headers = {
    Authorization: `Bot ${config.discordToken}`,
    'Content-Type': 'application/json',
  };

  // 1. Reserve an upload slot
  const slotResponse = await fetch(`${api}/channels/${channelId}/attachments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      files: [{ filename: 'voice-message.ogg', file_size: note.ogg.length, id: '2' }],
    }),
  });
  if (!slotResponse.ok) throw new Error(`attachment slot failed (${slotResponse.status})`);
  const slot = (await slotResponse.json()) as {
    attachments: Array<{ upload_url: string; upload_filename: string }>;
  };

  // 2. Upload the bytes
  const putResponse = await fetch(slot.attachments[0].upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': 'audio/ogg' },
    body: new Uint8Array(note.ogg),
  });
  if (!putResponse.ok) throw new Error(`attachment upload failed (${putResponse.status})`);

  // 3. Post the voice message (flag 8192 = IS_VOICE_MESSAGE)
  const messageResponse = await fetch(`${api}/channels/${channelId}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      flags: 8192,
      attachments: [
        {
          id: '0',
          filename: 'voice-message.ogg',
          uploaded_filename: slot.attachments[0].upload_filename,
          duration_secs: Math.round(note.durationSecs * 10) / 10,
          waveform: note.waveform,
        },
      ],
    }),
  });
  if (!messageResponse.ok) {
    throw new Error(`voice message post failed (${messageResponse.status}): ${(await messageResponse.text()).slice(0, 150)}`);
  }
}
