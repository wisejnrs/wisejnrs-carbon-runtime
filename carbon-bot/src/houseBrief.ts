import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { type Client, type TextChannel } from 'discord.js';
import { config } from './config.js';
import { getSkyData } from './sky.js';
import { runPool, type PoolResult } from './poolTools.js';
import { robovacStatus } from './robovacService.js';
import { garageStatus } from './garageService.js';
import { netStatus } from './netWatch.js';

// Daily "House Brief": one card to #project-house rolling up weather + sun + solar,
// air, pool (+alarm), robovac, holiday/season, BOM warnings and device health. Each
// source is best-effort so one failure never sinks the brief.

const pexec = promisify(execFile);

// Run a house/tools/*.py CLI and parse its final JSON line. Best-effort → null.
async function runPy(script: string): Promise<any | null> {
  try {
    const { stdout } = await pexec('uv', ['run', `/work/wisejnrs-projects/house/tools/${script}`], {
      cwd: '/work/wisejnrs-projects/house',
      timeout: 30_000,
      env: {
        ...process.env,
        PATH: `/usr/local/bin:${process.env.PATH ?? ''}`,
        UV_CACHE_DIR: process.env.UV_CACHE_DIR ?? '/app/data/uv-cache',
        UV_PYTHON_INSTALL_DIR: process.env.UV_PYTHON_INSTALL_DIR ?? '/app/data/uv-python',
      },
    });
    return JSON.parse(stdout.trim().split('\n').filter(Boolean).pop() ?? '{}');
  } catch {
    return null;
  }
}

function hhmm(iso?: string): string {
  return iso && iso.includes('T') ? iso.split('T')[1].slice(0, 5) : (iso ?? '');
}

export async function postHouseBrief(client: Client): Promise<{ posted: boolean; skipped?: string }> {
  if (!config.houseBriefEnabled) return { posted: false, skipped: 'disabled' };
  const channel = client.channels.cache.get(config.houseBriefChannelId) as TextChannel | undefined;
  if (!channel || !('send' in channel)) return { posted: false, skipped: 'channel not ready' };

  const [sky, pool, vac, hol, air, bom, net, bin, garage] = await Promise.all([
    getSkyData().catch(() => null),
    (runPool(['status']) as Promise<PoolResult>).catch(() => null),
    robovacStatus().catch(() => null),
    runPy('holidays.py'),
    runPy('air.py'),
    runPy('bom.py'),
    netStatus().catch(() => [] as { name: string; up: boolean }[]),
    runPy('bin.py'),
    garageStatus().catch(() => null),
  ]);

  const date = new Date().toLocaleDateString('en-AU', {
    timeZone: 'Australia/Brisbane', weekday: 'long', day: 'numeric', month: 'long',
  });
  const lines = [`🏠 **House Brief** — ${date}${hol?.season ? ` · ${hol.season}` : ''}`];

  if (sky) {
    lines.push(
      `🌤️ ${sky.weather.desc} · ${sky.weather.temp}°C (feels ${sky.weather.feels}°C) · ` +
        `🌅 ${hhmm(sky.sun.sunrise)}–${hhmm(sky.sun.sunset)} · UV ${sky.sun.uvMax} · ${sky.moon.emoji} ${sky.moon.illumination}%`,
    );
    if (sky.solar) {
      lines.push(
        `🔆 Solar: now ${((sky.solar.currentW ?? 0) / 1000).toFixed(2)} kW · today ${sky.solar.todayKwh} kWh · ` +
          `lifetime ${(sky.solar.totalKwh / 1000).toFixed(1)} MWh`,
      );
    }
  }
  if (pool && !pool.error && pool.water_temp_c !== undefined) {
    const alarm = String(pool.error_state) === '1' ? ` · 🚨 **alarm** (code ${pool.error_code})` : '';
    lines.push(
      `🏊 Pool: ${pool.water_temp_c}°C · pH ${pool.ph} · SWC ${pool.swc_pct}% · ` +
        `pump ${pool.filter_pump ? 'on' : 'off'} · chlorinator ${pool.production ? 'on' : 'off'}${alarm}`,
    );
  }
  if (air?.us_aqi != null) lines.push(`🫁 Air: AQI ${air.us_aqi} (${air.band}) · PM2.5 ${air.pm2_5}`);
  if (vac) lines.push(`🧹 ${vac.nick ?? 'Cinderella'}: 🔋 ${vac.battery ?? '?'}% · ${vac.state ?? '?'}`);
  if (garage?.ok) lines.push(`🚪 Garage: ${garage.open ? '⚠️ **OPEN**' : 'closed'}`);
  if (bom?.ok) {
    lines.push(
      bom.count > 0
        ? `🌩️ **BOM warning${bom.count > 1 ? 's' : ''}:** ${bom.warnings.map((w: any) => w.title).slice(0, 3).join('; ')}`
        : '🌩️ BOM: no current warnings',
    );
  }
  if (net?.length) {
    const down = net.filter((n) => !n.up).map((n) => n.name);
    lines.push(down.length ? `🖧 Network: ⚠️ **${down.join(', ')} down**` : `🖧 Network: all ${net.length} devices up`);
  }
  if (hol) {
    const bits: string[] = [];
    if (hol.is_holiday_today?.length) {
      bits.push(`🎉 **Public holiday today** — ${hol.is_holiday_today[0].name}`);
    } else if (hol.next) {
      const when = hol.next_in_days === 1 ? 'tomorrow' : `in ${hol.next_in_days} days`;
      bits.push(`📅 Next holiday: **${hol.next.name}** (${when})`);
    }
    if (hol.school?.in_term === false) bits.push(`🎒 school holidays (back in ${hol.school.days_to_next}d)`);
    else if (hol.school?.in_term === true) bits.push(`🎒 ${hol.school.label} (hols in ${hol.school.days_to_end}d)`);
    if (bits.length) lines.push(bits.join(' · '));
  }
  if (bin?.bins?.length) {
    const when = bin.days_away === 0 ? 'TODAY' : bin.days_away === 1 ? 'tomorrow' : `${bin.day} (${bin.days_away}d)`;
    lines.push(`🗑️ Bins ${when}: ${bin.bins.join(' + ')}`);
  }
  lines.push('📹 Security armed · ask me for status/control anytime, or paste a photo to analyse.');

  try {
    await channel.send(lines.join('\n').slice(0, 2000));
  } catch (e) {
    return { posted: false, skipped: `send failed: ${e instanceof Error ? e.message : String(e)}` };
  }
  return { posted: true };
}

// Night-before bin reminder: run each evening; only pings when TOMORROW is bin day.
export async function postBinReminder(client: Client): Promise<{ posted: boolean; skipped?: string }> {
  if (!config.binReminderEnabled) return { posted: false, skipped: 'disabled' };
  const channel = client.channels.cache.get(config.binReminderChannelId) as TextChannel | undefined;
  if (!channel || !('send' in channel)) return { posted: false, skipped: 'channel not ready' };
  const bin = await runPy('bin.py');
  if (!bin?.bins?.length || bin.days_away !== 1) return { posted: false, skipped: 'not bin-eve' };
  try {
    await channel.send(`🗑️ **Bins out tonight!** Tomorrow (${bin.day}) is collection: ${bin.bins.join(' + ')}`);
  } catch {
    return { posted: false, skipped: 'send failed' };
  }
  return { posted: true };
}
