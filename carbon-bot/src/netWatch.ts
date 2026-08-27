import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { type Client, type TextChannel } from 'discord.js';
import { config } from './config.js';

// Home-network watchdog: TCP-connect probe of key always-on devices; alert
// #project-house only when a device's up/down state CHANGES. Baselines silently
// on first run; retries once before declaring down to filter transient blips.
// (Deliberately excludes the Fronius — it sleeps in low light and would flap.)

export interface NetTarget {
  name: string;
  host: string;
  port: number;
}

export function parseTargets(): NetTarget[] {
  const raw = config.netWatchTargets;
  return raw
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [name, host, port] = s.split('|');
      return { name, host, port: Number(port) };
    })
    .filter((t) => t.name && t.host && t.port);
}

function probe(host: string, port: number, timeout = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let done = false;
    const finish = (up: boolean) => {
      if (done) return;
      done = true;
      sock.destroy();
      resolve(up);
    };
    sock.setTimeout(timeout);
    sock.once('connect', () => finish(true));
    sock.once('timeout', () => finish(false));
    // A refused connection still proves the host is UP (something answered).
    sock.once('error', (e: NodeJS.ErrnoException) => finish(e.code === 'ECONNREFUSED'));
    sock.connect(port, host);
  });
}

async function isUp(t: NetTarget): Promise<boolean> {
  if (await probe(t.host, t.port)) return true;
  await new Promise((r) => setTimeout(r, 1500)); // one retry to filter blips
  return probe(t.host, t.port);
}

function stateFile(): string {
  return path.join(config.dataDir, 'net-watch-state.json');
}
function load(): Record<string, boolean> {
  try {
    return JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
  } catch {
    return {};
  }
}
function save(s: Record<string, boolean>): void {
  try {
    fs.mkdirSync(config.dataDir, { recursive: true });
    fs.writeFileSync(stateFile(), JSON.stringify(s));
  } catch {
    /* non-fatal */
  }
}

// Current up/down for every target (used by the house brief).
export async function netStatus(): Promise<{ name: string; up: boolean }[]> {
  const targets = parseTargets();
  return Promise.all(targets.map(async (t) => ({ name: t.name, up: await isUp(t) })));
}

export async function checkNetwork(client: Client): Promise<{ posted: boolean; skipped?: string }> {
  if (!config.netWatchEnabled) return { posted: false, skipped: 'disabled' };
  const channel = client.channels.cache.get(config.netWatchChannelId) as TextChannel | undefined;
  if (!channel || !('send' in channel)) return { posted: false, skipped: 'channel not ready' };

  const targets = parseTargets();
  const prev = load();
  const first = Object.keys(prev).length === 0;
  const now: Record<string, boolean> = {};
  const changes: string[] = [];

  for (const t of targets) {
    const up = await isUp(t);
    now[t.name] = up;
    if (!first && prev[t.name] !== undefined && prev[t.name] !== up) {
      changes.push(up ? `🟢 **${t.name}** is back online` : `🔴 **${t.name}** (${t.host}) is DOWN`);
    }
  }

  save(now);
  if (first || changes.length === 0) return { posted: false, skipped: first ? 'baseline' : 'no change' };

  try {
    await channel.send(`🖧 **Network** — ${changes.join('\n')}`.slice(0, 1900));
  } catch {
    return { posted: false, skipped: 'send failed' };
  }
  return { posted: true };
}
