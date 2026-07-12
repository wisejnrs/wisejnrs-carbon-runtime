import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Inngest } from 'inngest';
import { extractExchange } from './commitments.js';
import { config } from './config.js';
import { dream } from './memory.js';
import { deliverCheckins, deliverEvents, postBriefing, proactiveClient } from './proactive.js';

const execFileAsync = promisify(execFile);

// Inngest workflow engine. Functions run IN this process (carbon-bot); a single
// self-hosted Inngest server (a sidecar) orchestrates schedules, retries and run
// history, and calls back into the serve() handler mounted on the health server
// (see health.ts). Connection is via env: INNGEST_BASE_URL points at the server,
// INNGEST_DEV=1 uses the local dev server.
//
// ALL scheduled work lives here - the proactive tick, morning briefing, nightly
// dream, commitment extraction and the external brief script. There are no
// setInterval loops left; if the Inngest sidecar is down, proactive features
// pause (and catch up per their retry policy) while chat keeps working.
export const inngest = new Inngest({ id: 'mrroboto' });

// Daily crons fire in the process TZ (matching the old setInterval scheduler,
// which compared against local wall-clock time). Without TZ set, Inngest crons
// run in UTC - same as a bare container.
function dailyCron(time: string): string {
  const [hour, minute] = time.split(':').map(Number);
  return `${process.env.TZ ? `TZ=${process.env.TZ} ` : ''}${minute} ${hour} * * *`;
}

// Minute tick: deliver due commitment check-ins and queued system events.
// concurrency 1 replaces the old `running` re-entrancy guard; no retries -
// the next tick is at most a minute away.
export const proactiveTick = inngest.createFunction(
  {
    id: 'proactive-tick',
    name: 'Proactive tick',
    retries: 0,
    concurrency: { limit: 1 },
    triggers: [{ cron: '* * * * *' }, { event: 'mrroboto/tick.run' }],
  },
  async ({ step }) => {
    const client = proactiveClient();
    if (!client) return { skipped: 'discord client not ready' };
    const checkins = await step.run('deliver-checkins', () => deliverCheckins(client));
    const events = await step.run('deliver-events', () => deliverEvents(client));
    return { checkins, events };
  },
);

// Morning briefing composed by the agent (email + calendar + follow-ups + weather).
export const morningBriefing = inngest.createFunction(
  {
    id: 'morning-briefing',
    name: 'Morning briefing',
    retries: 2,
    concurrency: { limit: 1 },
    triggers: [{ cron: dailyCron(config.briefingTime || '07:30') }, { event: 'mrroboto/briefing.run' }],
  },
  async ({ step }) => {
    const client = proactiveClient();
    if (!client) return { skipped: 'discord client not ready' };
    const posted = await step.run('post-briefing', () => postBriefing(client));
    return { posted };
  },
);

// Nightly dream: consolidate the day's history into long-term memory facts.
export const nightlyDream = inngest.createFunction(
  {
    id: 'nightly-dream',
    name: 'Nightly dream',
    retries: 1,
    concurrency: { limit: 1 },
    triggers: [{ cron: dailyCron(config.dreamTime || '03:30') }, { event: 'mrroboto/dream.run' }],
  },
  async ({ step }) => {
    const summary = await step.run('dream', () => dream());
    return { summary };
  },
);

// Commitment extraction: chat sends `mrroboto/exchange.logged` per turn; the
// per-channel debounce keeps only the latest exchange in a burst (previously an
// in-process 8s setTimeout debounce).
export const commitmentExtraction = inngest.createFunction(
  {
    id: 'commitment-extraction',
    name: 'Commitment extraction',
    retries: 1,
    debounce: { key: 'event.data.channelId', period: '8s' },
    triggers: [{ event: 'mrroboto/exchange.logged' }],
  },
  async ({ event }) => {
    const { channelId, user, assistant } = event.data as {
      channelId: string;
      user: string;
      assistant: string;
    };
    const noted = await extractExchange(channelId, { user, assistant });
    return { noted };
  },
);

// External scheduled scripts (SCHEDULED_SCRIPTS / DAILY_BRIEF_SCRIPT): each runs
// a standalone Node file on its cron, and on demand via `mrroboto/<id>.run`. The
// script does its own output (e.g. posts a report to Discord).
export const scheduledScripts = config.scheduledScripts.map(({ id, cron, script }) =>
  inngest.createFunction(
    {
      id,
      name: `Scheduled script: ${id}`,
      retries: 2,
      concurrency: { limit: 1 },
      triggers: [{ cron }, { event: `mrroboto/${id}.run` }],
    },
    async ({ step }) =>
      step.run('run-script', async () => {
        const { stdout, stderr } = await execFileAsync('node', [script], {
          maxBuffer: 32 * 1024 * 1024,
          timeout: 12 * 60 * 1000,
        });
        const tail = (stdout + stderr).trim().split('\n').slice(-8).join('\n');
        return { ok: true, tail };
      }),
  ),
);

// Register only the functions whose feature is configured, so a default install
// doesn't fire empty crons. The proactive set requires the claude-code provider
// (same gate startProactive always had).
export const inngestFunctions = [
  ...scheduledScripts,
  ...(config.provider === 'claude-code'
    ? [
        proactiveTick,
        ...(config.briefingChannel && config.briefingTime ? [morningBriefing] : []),
        ...(config.memoryEnabled && config.dreamTime ? [nightlyDream] : []),
        ...(config.commitmentsEnabled ? [commitmentExtraction] : []),
      ]
    : []),
];
