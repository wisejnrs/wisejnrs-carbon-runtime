import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';
import { getDiscordRequestContext } from './discordTools.js';

// Bridge to the wisejnrs-aqualink Python integration (WisePool / Zodiac eXO).
// The bot's container mounts /work/wisejnrs-projects rw and ships `uv`, so we
// run the self-contained PEP-723 bridge script; it provisions its own env
// (cached under /app/data) and reads credentials from the project's .env.
const POOL_DIR = process.env.POOL_PROJECT_DIR ?? '/work/wisejnrs-projects/wisejnrs-aqualink';
const POOL_SCRIPT = `${POOL_DIR}/scripts/pool.py`;
const pexec = promisify(execFile);

export interface PoolResult {
  [k: string]: unknown;
  error?: string;
}

export async function runPool(args: string[]): Promise<PoolResult> {
  const { stdout } = await pexec('uv', ['run', '--project', POOL_DIR, POOL_SCRIPT, ...args], {
    cwd: POOL_DIR,
    timeout: 150_000,
    maxBuffer: 4 * 1024 * 1024,
    env: {
      ...process.env,
      PATH: `/usr/local/bin:${process.env.PATH ?? ''}`,
      // Persist uv's env + python across container restarts (data volume).
      UV_CACHE_DIR: process.env.UV_CACHE_DIR ?? '/app/data/uv-cache',
      UV_PYTHON_INSTALL_DIR: process.env.UV_PYTHON_INSTALL_DIR ?? '/app/data/uv-python',
    },
  });
  // The script prints one JSON object/array as its final stdout line.
  const line = stdout.trim().split('\n').filter(Boolean).pop() ?? '{}';
  return JSON.parse(line) as PoolResult;
}

function ok(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}
function fail(text: string) {
  return { content: [{ type: 'text' as const, text }], isError: true };
}
function ownerBlocked(action: string) {
  const ctx = getDiscordRequestContext();
  // A non-owner (e.g. an @mention from a social channel) cannot actuate the pool.
  if (ctx.requesterId && !ctx.isOwner) return fail(`Only Mike can ${action}.`);
  return null;
}

const SWITCHES: Record<string, string> = {
  production: 'production',
  chlorinator: 'production',
  boost: 'boost',
  low: 'low',
  aux1: 'aux_1',
  aux2: 'aux_2',
};

function fmtStatus(s: PoolResult): string {
  const f = (b: unknown) => (b ? 'on' : 'off');
  return (
    `🏊 ${s.name} (${s.serial})\n` +
    `water: ${s.water_temp_c}°C · pH ${s.ph} · ORP ${s.orp_mv ?? '—'} mV · SWC ${s.swc_pct}%\n` +
    `pump: ${f(s.filter_pump)} · chlorinator: ${f(s.production)} · boost: ${f(s.boost)} · low: ${f(s.low)}\n` +
    `aux1: ${f(s.aux_1)} · aux2: ${f(s.aux_2)} · error: ${s.error_code ?? '0'}`
  );
}

interface Sched {
  key: string;
  name: string;
  start: string;
  end: string;
  enabled: boolean;
  active: boolean;
}
function fmtSchedules(list: Sched[]): string {
  return list
    .map(
      (s) =>
        `${s.key}  ${s.name.padEnd(26)} ${s.start}-${s.end}  ` +
        `${s.enabled ? 'on ' : 'off'}${s.active ? ' ▶active' : ''}`,
    )
    .join('\n');
}

export const poolMcpServer = createSdkMcpServer({
  name: 'pool',
  version: '1.0.0',
  tools: [
    tool(
      'pool_status',
      'Read the pool (WisePool / Zodiac eXO): water temp, pH, ORP, salt-chlorinator output %, and pump/chlorinator/boost/low/aux states. Read-only.',
      {},
      async () => {
        try {
          const r = await runPool(['status']);
          if (r.error) return fail(`Pool error: ${r.error}`);
          return ok(fmtStatus(r));
        } catch (e) {
          return fail(`Couldn't reach the pool: ${e instanceof Error ? e.message : String(e)}`);
        }
      },
    ),
    tool(
      'pool_control',
      'Turn a pool switch on or off. target: chlorinator (chlorine production), boost, low, aux1, aux2. Owner-only (physical equipment).',
      {
        target: z.enum(['chlorinator', 'production', 'boost', 'low', 'aux1', 'aux2']),
        state: z.enum(['on', 'off']),
      },
      async (args) => {
        const blocked = ownerBlocked('control the pool');
        if (blocked) return blocked;
        const sw = SWITCHES[args.target];
        if (!sw) return fail(`Unknown target "${args.target}".`);
        try {
          const r = await runPool(['set', sw, args.state]);
          if (r.error) return fail(`Pool error: ${r.error}`);
          const after = r.status as PoolResult | undefined;
          return ok(`${args.target} → ${args.state}` + (after ? `\n\n${fmtStatus(after)}` : ''));
        } catch (e) {
          return fail(`Control failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      },
    ),
    tool(
      'pool_schedules',
      "List the pool's programmed schedules (timers): each slot's name, on/off window, whether it's enabled, and whether it's currently active. Read-only.",
      {},
      async () => {
        try {
          const r = await runPool(['schedules']);
          if (!Array.isArray(r)) return fail(`Pool error: ${(r as PoolResult).error ?? 'unexpected result'}`);
          return ok(fmtSchedules(r as unknown as Sched[]));
        } catch (e) {
          return fail(`Couldn't read schedules: ${e instanceof Error ? e.message : String(e)}`);
        }
      },
    ),
    tool(
      'pool_schedule_set',
      "Update one pool schedule (timer). id is the slot key from pool_schedules (e.g. sch1). Provide any of: start/end as HH:MM (24h), and/or enabled. Owner-only.",
      {
        id: z.string().describe('schedule key, e.g. sch1'),
        start: z.string().optional().describe('HH:MM (24h)'),
        end: z.string().optional().describe('HH:MM (24h)'),
        enabled: z.boolean().optional().describe('enable or disable the schedule'),
      },
      async (args) => {
        const blocked = ownerBlocked('change the pool schedule');
        if (blocked) return blocked;
        const extra: string[] = [];
        if (args.start) extra.push(args.start);
        if (args.end) extra.push(args.end);
        if (args.enabled !== undefined) extra.push(args.enabled ? 'on' : 'off');
        if (extra.length === 0) return fail('Nothing to change: pass start, end and/or enabled.');
        try {
          const r = await runPool(['schedule', args.id, ...extra]);
          if (r.error) return fail(`Pool error: ${r.error}`);
          const s = r.schedule as Sched | undefined;
          return ok(
            s
              ? `Updated ${s.key} (${s.name}): ${s.start}-${s.end}  ${s.enabled ? 'enabled' : 'disabled'}`
              : 'Updated.',
          );
        } catch (e) {
          return fail(`Schedule update failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      },
    ),
  ],
});
