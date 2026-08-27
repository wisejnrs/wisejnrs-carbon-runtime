import fs from 'node:fs';
import path from 'node:path';
import { type Client, type TextChannel } from 'discord.js';
import { config } from './config.js';
import { runPool } from './poolTools.js';

// Pool-alarm watch: poll the eXO periodically and post to #project-house only on
// a CHANGE — alarm appears, clears, or the error code changes. State persisted so
// we don't re-alert every tick (and survive restarts). Read-only; never actuates.

interface AlarmState {
  active: boolean; // error_state === "1"
  code: string | null; // error_code
}

function stateFile(): string {
  return path.join(config.dataDir, 'pool-alarm-state.json');
}

function load(): AlarmState | null {
  try {
    return JSON.parse(fs.readFileSync(stateFile(), 'utf8')) as AlarmState;
  } catch {
    return null;
  }
}

function save(s: AlarmState): void {
  try {
    fs.mkdirSync(config.dataDir, { recursive: true });
    fs.writeFileSync(stateFile(), JSON.stringify(s));
  } catch {
    /* non-fatal */
  }
}

export async function checkPoolAlarm(client: Client): Promise<{ posted: boolean; skipped?: string }> {
  if (!config.poolWatchEnabled) return { posted: false, skipped: 'disabled' };
  const channel = client.channels.cache.get(config.poolWatchChannelId) as TextChannel | undefined;
  if (!channel || !('send' in channel)) return { posted: false, skipped: 'channel not ready' };

  let status;
  try {
    status = await runPool(['status']);
  } catch (e) {
    // Transient cloud/ExoState hiccup — the bridge retries internally; skip this tick.
    return { posted: false, skipped: `read failed: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (status.error || status.error_state === undefined) {
    return { posted: false, skipped: 'no status' };
  }

  const now: AlarmState = {
    active: String(status.error_state) === '1',
    code: status.error_code != null ? String(status.error_code) : null,
  };
  const prev = load();

  // First run: record baseline silently (avoid alerting for a pre-existing alarm
  // the moment the watch starts — Mike already knows about the current one).
  if (prev === null) {
    save(now);
    return { posted: false, skipped: 'baseline recorded' };
  }

  // Only act on a transition.
  const changed = now.active !== prev.active || (now.active && now.code !== prev.code);
  if (!changed) return { posted: false, skipped: 'no change' };

  const temp = status.water_temp_c;
  const swc = status.swc_pct;
  let msg: string;
  if (now.active && !prev.active) {
    msg = `🚨 **Pool alarm** — eXO error **code ${now.code}** just went active.\n🌡️ ${temp}°C · SWC ${swc}% · pump ${status.filter_pump ? 'on' : 'off'} · chlorinator ${status.production ? 'producing' : 'off'}\nCheck the eXO panel for the exact alarm text (common: low salt / cold water / cell).`;
  } else if (!now.active && prev.active) {
    msg = `✅ **Pool alarm cleared** — the eXO alarm (was code ${prev.code}) is no longer active.\n🌡️ ${temp}°C · SWC ${swc}%`;
  } else {
    msg = `⚠️ **Pool alarm changed** — eXO error code ${prev.code} → **${now.code}** (still active).\n🌡️ ${temp}°C · SWC ${swc}%`;
  }

  try {
    await channel.send(msg.slice(0, 1900));
  } catch {
    return { posted: false, skipped: 'send failed' }; // don't save → retry next tick
  }
  save(now);
  return { posted: true };
}
