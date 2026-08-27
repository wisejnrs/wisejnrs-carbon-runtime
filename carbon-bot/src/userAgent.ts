// Outbound HTTP should present as a real browser — never identify the bot — so it
// isn't fingerprinted or blocked by sites that reject non-browser clients. The pool
// below is a set of current desktop browser User-Agent strings (Chrome/Firefox/
// Safari/Edge across Windows/macOS/Linux), modelled on luminati-io/curl-user-agent.
const BROWSER_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
];

/** A randomly-chosen current browser User-Agent string. */
export function browserUserAgent(): string {
  return BROWSER_USER_AGENTS[Math.floor(Math.random() * BROWSER_USER_AGENTS.length)];
}

// Discord's REST API rejects browser User-Agents (403/40333) — it requires a
// DiscordBot UA. discord.js sets this itself; this is for our own raw Discord fetches.
export const DISCORD_API_USER_AGENT = 'DiscordBot (https://wisejnrs.net, 1.0)';

function hostOf(input: unknown): string {
  const url =
    typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request)?.url ?? '';
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

function isDiscordHost(host: string): boolean {
  return host === 'discord.com' || host === 'discordapp.com' || host.endsWith('.discord.com');
}

let installed = false;

/**
 * Wrap the global `fetch` so every outbound request presents as a browser unless the
 * caller set a UA — EXCEPT Discord's API, which gets a DiscordBot UA (a browser UA is
 * rejected there). discord.js uses its own HTTP client, so this only affects our own
 * `fetch` calls. Idempotent.
 */
export function installGlobalBrowserUA(): void {
  if (installed) return;
  installed = true;
  const orig = globalThis.fetch;
  globalThis.fetch = ((input: Parameters<typeof orig>[0], init: RequestInit = {}) => {
    const headers = new Headers(init.headers ?? {});
    if (!headers.has('user-agent')) {
      headers.set('user-agent', isDiscordHost(hostOf(input)) ? DISCORD_API_USER_AGENT : browserUserAgent());
    }
    return orig(input, { ...init, headers });
  }) as typeof fetch;
}
