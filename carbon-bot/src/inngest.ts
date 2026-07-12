import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Inngest } from 'inngest';
import { config } from './config.js';

const execFileAsync = promisify(execFile);

// Inngest workflow engine. Functions run IN this process (carbon-bot); a single
// self-hosted Inngest server (a sidecar) orchestrates schedules, retries and run
// history, and calls back into the serve() handler mounted on the health server
// (see health.ts). Connection is via env: INNGEST_BASE_URL points at the server,
// INNGEST_DEV=1 uses the local dev server.
export const inngest = new Inngest({ id: 'mrroboto' });

// Example scheduled function: run a configured script on a cron (and on demand
// via the `mrroboto/daily-brief.run` event), with automatic retries + run history
// in the Inngest dashboard. Set DAILY_BRIEF_SCRIPT to enable it. The script is a
// standalone Node file (e.g. a report generator) that does its own output.
export const dailyBrief = inngest.createFunction(
  {
    id: 'daily-brief',
    name: 'Scheduled brief',
    retries: 2,
    triggers: [{ cron: config.dailyBriefCron }, { event: 'mrroboto/daily-brief.run' }],
  },
  async ({ step }) => {
    if (!config.dailyBriefScript) return { skipped: 'DAILY_BRIEF_SCRIPT not set' };
    return step.run('run-daily-brief', async () => {
      const { stdout, stderr } = await execFileAsync('node', [config.dailyBriefScript], {
        maxBuffer: 32 * 1024 * 1024,
        timeout: 12 * 60 * 1000,
      });
      const tail = (stdout + stderr).trim().split('\n').slice(-8).join('\n');
      return { ok: true, tail };
    });
  },
);

// Only register the scheduled function when a script is configured, so a default
// install doesn't fire an empty cron.
export const inngestFunctions = config.dailyBriefScript ? [dailyBrief] : [];
