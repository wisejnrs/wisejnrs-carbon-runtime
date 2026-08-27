import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { getSkyData } from './sky.js';
import { runPool, type PoolResult } from './poolTools.js';
import { garageStatus } from './garageService.js';
import { robovacStatus } from './robovacService.js';
import { netStatus } from './netWatch.js';

// House stats: append a timestamped snapshot of every topic to a CSV so we can
// see trends (and open it in a spreadsheet). Best-effort — missing sources are
// blank fields. One header row, then one row per logging tick.

const pexec = promisify(execFile);

// Ordered CSV columns.
const COLUMNS = [
  'ts', 'temp', 'humidity', 'wind', 'uv',
  'solar_now_kw', 'solar_today_kwh', 'solar_total_mwh',
  'pool_temp', 'pool_ph', 'pool_swc', 'pool_alarm', 'pool_code',
  'air_aqi', 'air_pm25', 'garage_open', 'vac_battery', 'vac_state', 'net_down',
] as const;

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

const cell = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v).replace(/[,\n]/g, ' ').trim(); // keep CSV single-cell safe
};

export async function logStats(): Promise<{ logged: boolean }> {
  if (!config.statsEnabled) return { logged: false };
  const [sky, pool, air, garage, vac, net] = await Promise.all([
    getSkyData().catch(() => null),
    (runPool(['status']) as Promise<PoolResult>).catch(() => null),
    runPy('air.py'),
    garageStatus().catch(() => null),
    robovacStatus().catch(() => null),
    netStatus().catch(() => [] as { name: string; up: boolean }[]),
  ]);
  const poolOk = pool && !pool.error;
  const rec: Record<string, unknown> = {
    ts: new Date().toISOString(),
    temp: sky?.weather?.temp, humidity: sky?.weather?.humidity, wind: sky?.weather?.wind, uv: sky?.sun?.uvMax,
    solar_now_kw: sky?.solar ? Math.round((sky.solar.currentW ?? 0) / 10) / 100 : null,
    solar_today_kwh: sky?.solar?.todayKwh ?? null,
    solar_total_mwh: sky?.solar ? Math.round(sky.solar.totalKwh / 100) / 10 : null,
    pool_temp: poolOk ? pool!.water_temp_c : null,
    pool_ph: poolOk ? pool!.ph : null,
    pool_swc: poolOk ? pool!.swc_pct : null,
    pool_alarm: poolOk ? String(pool!.error_state) === '1' : null,
    pool_code: poolOk ? pool!.error_code : null,
    air_aqi: air?.us_aqi ?? null, air_pm25: air?.pm2_5 ?? null,
    garage_open: garage?.ok ? Boolean(garage.open) : null,
    vac_battery: vac?.battery ?? null, vac_state: vac?.state ?? null,
    net_down: (net ?? []).filter((n) => !n.up).map((n) => n.name).join(';'),
  };
  try {
    fs.mkdirSync(path.dirname(config.statsFile), { recursive: true });
    if (!fs.existsSync(config.statsFile)) fs.writeFileSync(config.statsFile, COLUMNS.join(',') + '\n');
    fs.appendFileSync(config.statsFile, COLUMNS.map((c) => cell(rec[c])).join(',') + '\n');
  } catch {
    return { logged: false };
  }
  return { logged: true };
}

function readRows(days: number): Record<string, any>[] {
  try {
    const lines = fs.readFileSync(config.statsFile, 'utf8').split('\n').filter(Boolean);
    const header = lines.shift()!.split(',');
    const cutoff = Date.now() - days * 86_400_000;
    return lines
      .map((l) => {
        const cells = l.split(',');
        const o: Record<string, any> = {};
        header.forEach((h, i) => {
          const v = cells[i] ?? '';
          o[h] = v === '' ? null : v === 'true' ? true : v === 'false' ? false : Number.isNaN(Number(v)) ? v : Number(v);
        });
        return o;
      })
      .filter((r) => r.ts && new Date(r.ts).getTime() >= cutoff);
  } catch {
    return [];
  }
}

function agg(rows: any[], key: string) {
  const vals = rows.map((r) => r[key]).filter((v) => typeof v === 'number');
  if (!vals.length) return null;
  return { min: Math.min(...vals), max: Math.max(...vals), avg: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10, latest: vals[vals.length - 1] };
}

export function summarizeStats(days = 7): string {
  const rows = readRows(days);
  if (!rows.length) return `No stats logged yet in the last ${days}d (logger runs ${config.statsCron}). CSV: ${config.statsFile}`;
  const temp = agg(rows, 'temp');
  const poolT = agg(rows, 'pool_temp');
  const poolPh = agg(rows, 'pool_ph');
  const aqi = agg(rows, 'air_aqi');
  const solarPeak = agg(rows, 'solar_now_kw');
  const solarToday = rows.map((r) => r.solar_today_kwh).filter((v) => typeof v === 'number');
  let garageOpens = 0;
  for (let i = 1; i < rows.length; i++) if (rows[i].garage_open === true && rows[i - 1].garage_open !== true) garageOpens++;
  const alarmSamples = rows.filter((r) => r.pool_alarm === true).length;
  const netDownRows = rows.filter((r) => r.net_down).length;

  const L: string[] = [`📊 **House stats — last ${days}d** (${rows.length} samples)`];
  if (temp) L.push(`🌡️ Temp ${temp.min}–${temp.max}°C (avg ${temp.avg})`);
  if (solarPeak) L.push(`🔆 Solar peak ${solarPeak.max} kW · latest today ${solarToday.at(-1) ?? '?'} kWh`);
  if (poolT || poolPh) L.push(`🏊 Pool ${poolT ? `${poolT.min}–${poolT.max}°C` : '?'} · pH ${poolPh ? `${poolPh.min}–${poolPh.max} (avg ${poolPh.avg})` : '?'}${alarmSamples ? ` · ⚠️ alarm ${alarmSamples}/${rows.length}` : ''}`);
  if (aqi) L.push(`🫁 AQI avg ${aqi.avg} (max ${aqi.max})`);
  L.push(`🚪 Garage opened ${garageOpens}× · 🖧 net-down samples ${netDownRows}`);
  return L.join('\n');
}
