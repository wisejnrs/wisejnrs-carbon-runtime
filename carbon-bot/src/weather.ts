// Weather via Open-Meteo (free, no API key) - the working successor to the old
// .NET bot's never-exposed OpenWeatherMapService.

const WMO_CODES: Record<number, string> = {
  0: '☀️ Clear', 1: '🌤️ Mostly clear', 2: '⛅ Partly cloudy', 3: '☁️ Overcast',
  45: '🌫️ Fog', 48: '🌫️ Rime fog',
  51: '🌦️ Light drizzle', 53: '🌦️ Drizzle', 55: '🌧️ Heavy drizzle',
  61: '🌧️ Light rain', 63: '🌧️ Rain', 65: '🌧️ Heavy rain',
  66: '🌧️ Freezing rain', 67: '🌧️ Heavy freezing rain',
  71: '🌨️ Light snow', 73: '🌨️ Snow', 75: '❄️ Heavy snow', 77: '❄️ Snow grains',
  80: '🌦️ Light showers', 81: '🌧️ Showers', 82: '⛈️ Violent showers',
  85: '🌨️ Snow showers', 86: '❄️ Heavy snow showers',
  95: '⛈️ Thunderstorm', 96: '⛈️ Thunderstorm w/ hail', 99: '⛈️ Severe thunderstorm',
};

interface Place {
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
}

async function fetchJson<T>(url: string, tries = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'carbon-bot/1.0 (Discord weather command)' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function geocode(location: string): Promise<Place | null> {
  // Open-Meteo's geocoding host resolves flakily from some networks; fall back
  // to OSM Nominatim when it can't be reached.
  try {
    const geo = await fetchJson<{ results?: Place[] }>(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`,
    );
    return geo.results?.[0] ?? null;
  } catch {
    const results = await fetchJson<
      Array<{ display_name: string; lat: string; lon: string }>
    >(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(location)}`);
    const hit = results[0];
    if (!hit) return null;
    const [name, ...rest] = hit.display_name.split(', ');
    return {
      name,
      admin1: rest[0],
      country: rest[rest.length - 1] ?? '',
      latitude: Number(hit.lat),
      longitude: Number(hit.lon),
    };
  }
}

export async function getWeather(location: string): Promise<string> {
  const place = await geocode(location);
  if (!place) return `Couldn't find a place called "${location}".`;

  const data = await fetchJson<{
    current: {
      temperature_2m: number; apparent_temperature: number;
      relative_humidity_2m: number; wind_speed_10m: number; weather_code: number;
    };
    daily: {
      time: string[]; weather_code: number[];
      temperature_2m_max: number[]; temperature_2m_min: number[];
      precipitation_probability_max: number[];
    };
  }>(
    'https://api.open-meteo.com/v1/forecast' +
      `?latitude=${place.latitude}&longitude=${place.longitude}` +
      '&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
      '&timezone=auto&forecast_days=3',
  );

  const { current, daily } = data;
  const where = [place.name, place.admin1, place.country].filter(Boolean).join(', ');
  const lines = [
    `**${where}** — ${WMO_CODES[current.weather_code] ?? 'Unknown'}`,
    `🌡️ ${current.temperature_2m}°C (feels like ${current.apparent_temperature}°C) · ` +
      `💧 ${current.relative_humidity_2m}% · 💨 ${current.wind_speed_10m} km/h`,
    '',
  ];
  daily.time.forEach((day, i) => {
    const name = new Date(`${day}T12:00:00`).toLocaleDateString('en-AU', { weekday: 'short' });
    lines.push(
      `**${name}** ${WMO_CODES[daily.weather_code[i]] ?? ''} ` +
        `${daily.temperature_2m_min[i]}–${daily.temperature_2m_max[i]}°C, ` +
        `rain ${daily.precipitation_probability_max[i]}%`,
    );
  });
  return lines.join('\n');
}
