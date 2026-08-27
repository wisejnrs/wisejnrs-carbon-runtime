import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Inngest } from 'inngest';
import { extractExchange } from './commitments.js';
import { config } from './config.js';
import { dream } from './memory.js';
import { runAutonomousIteration } from './labAutonomous.js';
import { listActiveGoals } from './labGoal.js';
import { deliverCheckins, deliverEvents, postBriefing, proactiveClient } from './proactive.js';
import { scanReolink } from './reolink.js';
import { checkPoolAlarm } from './poolWatch.js';
import { postHouseBrief, postBinReminder } from './houseBrief.js';
import { checkNetwork } from './netWatch.js';
import { checkGarageOpen } from './garageWatch.js';
import { logStats } from './houseStats.js';

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

// Lab autonomous goals: a minute-driver scans lab projects for `active` goals
// and dispatches one iterate event per goal; lab-iterate runs a single bounded
// build turn, serialized per slug so turns never overlap. Each turn self-guards
// on the goal's own budget/status, so an extra dispatch is a safe no-op.
export const labDriver = inngest.createFunction(
  {
    id: 'lab-driver',
    concurrency: { limit: 1 },
    triggers: [{ cron: '* * * * *' }, { event: 'mrroboto/lab.drive' }],
  },
  async ({ step }) => {
    const slugs = await step.run('scan', () => listActiveGoals().map((g) => g.slug));
    for (const slug of slugs) {
      await step.sendEvent(`iter-${slug}`, { name: 'mrroboto/lab.iterate', data: { slug } });
    }
    return { dispatched: slugs.length };
  },
);

export const labIterate = inngest.createFunction(
  {
    id: 'lab-iterate',
    concurrency: { key: 'event.data.slug', limit: 1 },
    retries: 0,
    triggers: [{ event: 'mrroboto/lab.iterate' }],
  },
  async ({ event, step }) => {
    const slug = (event.data as { slug?: string })?.slug;
    if (!slug) return { skipped: 'no slug' };
    const client = proactiveClient();
    return step.run('iterate', () => runAutonomousIteration(slug, client ?? undefined));
  },
);

// Reolink detection loop: once a minute, pick up new AI/motion snapshots dropped
// by the cameras and post them (with a Claude-vision caption) to #project-house.
export const reolinkWatch = inngest.createFunction(
  {
    id: 'reolink-watch',
    name: 'Reolink detection loop',
    retries: 0,
    concurrency: { limit: 1 },
    triggers: [{ cron: '* * * * *' }, { event: 'mrroboto/reolink.scan' }],
  },
  async ({ step }) => {
    const client = proactiveClient();
    if (!client) return { skipped: 'discord client not ready' };
    return step.run('scan', () => scanReolink(client));
  },
);

// Pool-alarm watch: poll the eXO and post to #project-house only when the alarm
// state changes (appears / clears / code changes).
export const poolWatch = inngest.createFunction(
  {
    id: 'pool-watch',
    name: 'Pool alarm watch',
    retries: 0,
    concurrency: { limit: 1 },
    triggers: [{ cron: config.poolWatchCron }, { event: 'mrroboto/pool.watch' }],
  },
  async ({ step }) => {
    const client = proactiveClient();
    if (!client) return { skipped: 'discord client not ready' };
    return step.run('check', () => checkPoolAlarm(client));
  },
);

// Bin night-before reminder: each evening, ping only when tomorrow is bin day.
export const binReminder = inngest.createFunction(
  {
    id: 'bin-reminder',
    name: 'Bin reminder',
    retries: 1,
    concurrency: { limit: 1 },
    triggers: [{ cron: dailyCron(config.binReminderTime) }, { event: 'mrroboto/bin.remind' }],
  },
  async ({ step }) => {
    const client = proactiveClient();
    if (!client) return { skipped: 'discord client not ready' };
    return step.run('remind', () => postBinReminder(client));
  },
);

// House stats logger: snapshot every topic to the stats CSV on a cron.
export const statsLogger = inngest.createFunction(
  {
    id: 'stats-logger',
    name: 'House stats logger',
    retries: 0,
    concurrency: { limit: 1 },
    triggers: [{ cron: config.statsCron }, { event: 'mrroboto/stats.log' }],
  },
  async ({ step }) => step.run('log', () => logStats()),
);

// Garage "left open" watch: alert #project-house if the door stays open / is open after dark.
export const garageWatch = inngest.createFunction(
  {
    id: 'garage-watch',
    name: 'Garage watch',
    retries: 0,
    concurrency: { limit: 1 },
    triggers: [{ cron: config.garageWatchCron }, { event: 'mrroboto/garage.watch' }],
  },
  async ({ step }) => {
    const client = proactiveClient();
    if (!client) return { skipped: 'discord client not ready' };
    return step.run('check', () => checkGarageOpen(client));
  },
);

// Home-network watchdog: probe key devices, post to #project-house on up/down change.
export const netWatch = inngest.createFunction(
  {
    id: 'net-watch',
    name: 'Home network watch',
    retries: 0,
    concurrency: { limit: 1 },
    triggers: [{ cron: config.netWatchCron }, { event: 'mrroboto/net.watch' }],
  },
  async ({ step }) => {
    const client = proactiveClient();
    if (!client) return { skipped: 'discord client not ready' };
    return step.run('check', () => checkNetwork(client));
  },
);

// Daily House Brief: one digest card to #project-house each morning.
export const houseBrief = inngest.createFunction(
  {
    id: 'house-brief',
    name: 'House brief',
    retries: 1,
    concurrency: { limit: 1 },
    triggers: [{ cron: dailyCron(config.houseBriefTime) }, { event: 'mrroboto/housebrief.run' }],
  },
  async ({ step }) => {
    const client = proactiveClient();
    if (!client) return { skipped: 'discord client not ready' };
    return step.run('post', () => postHouseBrief(client));
  },
);

// Register only the functions whose feature is configured, so a default install
// doesn't fire empty crons. The proactive set requires the claude-code provider
// (same gate startProactive always had).
export const inngestFunctions = [
  ...scheduledScripts,
  ...(config.provider === 'claude-code'
    ? [
        proactiveTick,
        labDriver,
        labIterate,
        ...(config.briefingChannel && config.briefingTime ? [morningBriefing] : []),
        ...(config.memoryEnabled && config.dreamTime ? [nightlyDream] : []),
        ...(config.commitmentsEnabled ? [commitmentExtraction] : []),
        ...(config.reolinkEnabled ? [reolinkWatch] : []),
        ...(config.poolEnabled && config.poolWatchEnabled ? [poolWatch] : []),
        ...(config.houseBriefEnabled ? [houseBrief] : []),
        ...(config.netWatchEnabled ? [netWatch] : []),
        ...(config.garageEnabled && config.garageWatchEnabled ? [garageWatch] : []),
        ...(config.statsEnabled ? [statsLogger] : []),
        ...(config.binReminderEnabled ? [binReminder] : []),
      ]
    : []),
];
