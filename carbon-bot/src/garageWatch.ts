import fs from 'node:fs';
import path from 'node:path';
import { type Client, type TextChannel } from 'discord.js';
import { config } from './config.js';
import { garageStatus } from './garageService.js';

// Garage "left open" watch: alert #project-house once per open-episode if the door
// stays open too long OR is open after dark, and confirm when it closes.

interface GState {
  openSince: number | null;
  alerted: boolean;
}
function stateFile(): string {
  return path.join(config.dataDir, 'garage-watch-state.json');
}
function load(): GState {
  try {
    return JSON.parse(fs.readFileSync(stateFile(), 'utf8')) as GState;
  } catch {
    return { openSince: null, alerted: false };
  }
}
function save(s: GState): void {
  try {
    fs.mkdirSync(config.dataDir, { recursive: true });
    fs.writeFileSync(stateFile(), JSON.stringify(s));
  } catch {
    /* non-fatal */
  }
}
function brisbaneHour(): number {
  return Number(new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', hour: '2-digit', hour12: false }));
}

export async function checkGarageOpen(client: Client): Promise<{ posted: boolean; skipped?: string }> {
  if (!config.garageWatchEnabled) return { posted: false, skipped: 'disabled' };
  const channel = client.channels.cache.get(config.garageWatchChannelId) as TextChannel | undefined;
  if (!channel || !('send' in channel)) return { posted: false, skipped: 'channel not ready' };

  const s = await garageStatus();
  if (!s?.ok) return { posted: false, skipped: 'no status' };
  const st = load();
  const now = Date.now();

  if (!s.open) {
    let posted = false;
    if (st.alerted) {
      try {
        await channel.send('✅ Garage is now closed.');
        posted = true;
      } catch {
        /* ignore */
      }
    }
    save({ openSince: null, alerted: false });
    return { posted };
  }

  // open
  if (!st.openSince) st.openSince = now;
  const openMin = Math.round((now - st.openSince) / 60000);
  const afterDark = brisbaneHour() >= config.garageDarkHour;
  if (!st.alerted && (openMin >= config.garageOpenAlertMin || afterDark)) {
    const why = afterDark && openMin < config.garageOpenAlertMin ? 'and it\'s after dark' : `for ${openMin} min`;
    try {
      await channel.send(`🚪 <@${config.ownerUserIds[0] ?? ''}> **garage is still OPEN** ${why}.`);
    } catch {
      save(st);
      return { posted: false, skipped: 'send failed' };
    }
    st.alerted = true;
    save(st);
    return { posted: true };
  }
  save(st);
  return { posted: false, skipped: 'open, no alert yet' };
}
