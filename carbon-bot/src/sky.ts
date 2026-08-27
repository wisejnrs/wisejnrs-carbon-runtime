// Sky report: weather + sun times + moon phase for a location, via Open-Meteo
// (free, no key) plus a self-contained moon-phase calc. Structured so live solar
// data (Fronius inverter) can be merged in later without changing callers.

import { config } from './config.js';
import { WMO_CODES, fetchJson, geocode } from './weather.js';

export interface SkyData {
  where: string;
  weather: { code: number; desc: string; temp: number; feels: number; humidity: number; wind: number };
  sun: {
    sunrise: string; // ISO local
    sunset: string;
    daylightHours: number;
    sunshineHours: number;
    uvMax: number;
  };
  moon: { phase: string; illumination: number; ageDays: number; emoji: string };
  solar?: SolarData;
}

export interface SolarData {
  currentW: number | null; // instantaneous PV power (null when idle/night)
  todayKwh: number;
  yearKwh: number;
  totalKwh: number;
  mode: string;
}

// Fronius local Solar API (no auth on LAN). produce-only rigs return PV energy
// totals; P_PV is null when the inverter is idle (night / no sun). Best-effort.
export async function getSolar(): Promise<SolarData | null> {
  if (!config.solarEnabled) return null;
  try {
    const r = await fetch(`${config.froniusUrl}/solar_api/v1/GetPowerFlowRealtimeData.fcgi`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { Body?: { Data?: { Site?: Record<string, number | string | null> } } };
    const s = j?.Body?.Data?.Site;
    if (!s) return null;
    const num = (v: unknown) => (typeof v === 'number' ? v : 0);
    return {
      currentW: typeof s.P_PV === 'number' ? s.P_PV : null,
      todayKwh: Math.round(num(s.E_Day) / 100) / 10,
      yearKwh: Math.round(num(s.E_Year) / 1000),
      totalKwh: Math.round(num(s.E_Total) / 1000),
      mode: String(s.Mode ?? ''),
    };
  } catch {
    return null;
  }
}

const SYNODIC = 29.530588853; // days between new moons

function moonPhase(now: Date): SkyData['moon'] {
  // Julian date, then age since a known new moon (2000-01-06 18:14 UTC).
  const jd = now.getTime() / 86_400_000 + 2440587.5;
  const knownNew = Date.UTC(2000, 0, 6, 18, 14, 0) / 86_400_000 + 2440587.5;
  const age = (((jd - knownNew) % SYNODIC) + SYNODIC) % SYNODIC;
  const illumination = Math.round(((1 - Math.cos((2 * Math.PI * age) / SYNODIC)) / 2) * 100);
  const idx = Math.floor((age / SYNODIC) * 8 + 0.5) % 8;
  const names = [
    'New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous',
    'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent',
  ];
  const emojis = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
  return { phase: names[idx], emoji: emojis[idx], illumination, ageDays: Math.round(age * 10) / 10 };
}

export async function getSkyData(location = config.skyLocation): Promise<SkyData | null> {
  const place = await geocode(location);
  if (!place) return null;

  const data = await fetchJson<{
    current: {
      temperature_2m: number; apparent_temperature: number;
      relative_humidity_2m: number; wind_speed_10m: number; weather_code: number;
    };
    daily: {
      sunrise: string[]; sunset: string[];
      daylight_duration: number[]; sunshine_duration: number[]; uv_index_max: number[];
    };
  }>(
    'https://api.open-meteo.com/v1/forecast' +
      `?latitude=${place.latitude}&longitude=${place.longitude}` +
      '&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code' +
      '&daily=sunrise,sunset,daylight_duration,sunshine_duration,uv_index_max' +
      '&timezone=auto&forecast_days=1',
  );

  const { current, daily } = data;
  return {
    where: [place.name, place.admin1, place.country].filter(Boolean).join(', '),
    weather: {
      code: current.weather_code,
      desc: WMO_CODES[current.weather_code] ?? 'Unknown',
      temp: current.temperature_2m,
      feels: current.apparent_temperature,
      humidity: current.relative_humidity_2m,
      wind: current.wind_speed_10m,
    },
    sun: {
      sunrise: daily.sunrise[0],
      sunset: daily.sunset[0],
      daylightHours: Math.round((daily.daylight_duration[0] / 3600) * 10) / 10,
      sunshineHours: Math.round((daily.sunshine_duration[0] / 3600) * 10) / 10,
      uvMax: daily.uv_index_max[0],
    },
    moon: moonPhase(new Date()),
    solar: (await getSolar()) ?? undefined,
  };
}

function hhmm(iso: string): string {
  // Open-Meteo daily times are local (timezone=auto), formatted "YYYY-MM-DDTHH:mm".
  return iso.includes('T') ? iso.split('T')[1].slice(0, 5) : iso;
}

export function formatSky(d: SkyData): string {
  return [
    `🌤️ **Sky — ${d.where}**`,
    `${d.weather.desc}  ·  🌡️ ${d.weather.temp}°C (feels ${d.weather.feels}°C)  ·  💧 ${d.weather.humidity}%  ·  💨 ${d.weather.wind} km/h`,
    `🌅 Sunrise ${hhmm(d.sun.sunrise)}  ·  🌇 Sunset ${hhmm(d.sun.sunset)}  ·  ☀️ ${d.sun.daylightHours}h daylight`,
    `😎 UV max ${d.sun.uvMax}  ·  🔆 ${d.sun.sunshineHours}h sunshine expected`,
    `${d.moon.emoji} ${d.moon.phase} · ${d.moon.illumination}% lit (age ${d.moon.ageDays}d)`,
    ...(d.solar
      ? [
          `🔆 **Solar** — now ${((d.solar.currentW ?? 0) / 1000).toFixed(2)} kW · ` +
            `today ${d.solar.todayKwh} kWh · year ${d.solar.yearKwh.toLocaleString()} kWh · ` +
            `lifetime ${(d.solar.totalKwh / 1000).toFixed(1)} MWh`,
        ]
      : []),
  ].join('\n');
}
