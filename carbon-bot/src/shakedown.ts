/**
 * Live shakedown: checks every external subsystem MrRoboto depends on and exits
 * non-zero if any is unhealthy. Run against the deployed bot (it reads the same
 * environment), e.g.:  docker exec carbon-bot node dist/shakedown.js
 * Unlike the unit tests (commandGuard.test.ts) this makes real network calls.
 */
import { checkCommand } from './commandGuard.js';
import { DISCORD_API_USER_AGENT } from './userAgent.js';

type Check = { name: string; ok: boolean; detail: string };
const results: Check[] = [];
const add = (name: string, ok: boolean, detail: string) => results.push({ name, ok, detail });
const env = process.env;

async function run<T>(name: string, fn: () => Promise<string>): Promise<void> {
  try {
    add(name, true, await fn());
  } catch (err) {
    add(name, false, (err as Error).message.slice(0, 120));
  }
}

const discordHeaders = { Authorization: `Bot ${env.DISCORD_TOKEN}`, 'User-Agent': DISCORD_API_USER_AGENT };

await run('Discord API', async () => {
  const me = await fetch('https://discord.com/api/v10/users/@me', { headers: discordHeaders }).then((r) => r.json());
  const guilds = await fetch('https://discord.com/api/v10/users/@me/guilds', { headers: discordHeaders }).then((r) => r.json());
  if (!me.username) throw new Error('no bot identity');
  return `@${me.username}, ${guilds.length} guild(s)`;
});

await run('Health server', async () => {
  const port = env.HEALTH_PORT ?? '8300';
  const pong = await fetch(`http://localhost:${port}/ping`).then((r) => r.text());
  if (!/pong/i.test(pong)) throw new Error(`unexpected: ${pong.slice(0, 40)}`);
  return pong.trim();
});

await run('Command guard', async () => {
  const blocked = checkCommand('echo x && sudo rm -rf /');
  const allowed = checkCommand('git commit -am wip && git push');
  if (!blocked) throw new Error('did not block a sudo chain');
  if (allowed) throw new Error(`false-blocked normal dev: ${allowed}`);
  return 'blocks destructive, allows normal dev';
});

await run('Voice stack', async () => {
  const voice = await import('@discordjs/voice');
  const report = voice.generateDependencyReport();
  const ok = /opusscript: \d/.test(report) && /libsodium-wrappers: \d/.test(report) && /version:/.test(report);
  if (!ok) throw new Error('missing opus / encryption / ffmpeg');
  return 'opus + encryption + ffmpeg';
});

if (env.OPENAI_API_KEY) {
  await run('OpenAI voice', async () => {
    const model = env.STT_MODEL ?? 'whisper-1';
    const r = await fetch(`https://api.openai.com/v1/models/${model}`, {
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    }).then((res) => res.json());
    if (!r.id) throw new Error(JSON.stringify(r.error ?? r).slice(0, 80));
    return `${model} + ${env.TTS_MODEL ?? 'tts-1'} reachable`;
  });
}

if (env.HUME_API_KEY) {
  await run('Hume TTS', async () => {
    const r = await fetch('https://api.hume.ai/v0/tts', {
      method: 'POST',
      headers: { 'X-Hume-Api-Key': env.HUME_API_KEY!, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        utterances: [{ text: 'ok', voice: { name: env.HUME_VOICE_NAME, provider: env.HUME_VOICE_PROVIDER ?? 'CUSTOM_VOICE' } }],
        format: { type: 'mp3' },
      }),
    }).then((res) => res.json());
    if (!r.generations?.[0]?.audio) throw new Error(JSON.stringify(r).slice(0, 80));
    return `${env.HUME_VOICE_NAME} voice ok`;
  });
}

if (env.AZURE_AD_CLIENT_ID && env.WORK_EMAIL) {
  await run('MS Graph (work)', async () => {
    const token = await fetch(`https://login.microsoftonline.com/${env.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.AZURE_AD_CLIENT_ID!,
        client_secret: env.AZURE_AD_CLIENT_SECRET!,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    }).then((r) => r.json());
    if (!token.access_token) throw new Error('token failed');
    const status = await fetch(`https://graph.microsoft.com/v1.0/users/${env.WORK_EMAIL}/events?$top=1`, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    }).then((r) => r.status);
    if (status !== 200) throw new Error(`calendar HTTP ${status}`);
    return 'token + calendar ok';
  });
}

console.log('\n===== MrRoboto shakedown =====');
for (const c of results) console.log(`${c.ok ? '✅' : '❌'} ${c.name.padEnd(18)} ${c.detail}`);
const healthy = results.filter((c) => c.ok).length;
console.log(`\n${healthy}/${results.length} subsystems healthy`);
process.exit(healthy === results.length ? 0 : 1);
