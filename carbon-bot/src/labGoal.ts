import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { LAB_PROJECTS_DIR } from './projectFactory.js';

// Persistent, bounded, self-improving build goals for MrRoboto's lab projects
// (borrowed from Prime Agent's persistent-goal + bounded-autonomous-mode idea).
// A goal is durable JSON colocated with the project so it survives restarts; an
// inngest minute-driver advances every `active` goal one turn at a time until a
// quality gate passes (done), the agent is blocked (failed), or the budget runs
// out (budget). State lives in the file, not memory, so nothing is lost on crash.

const execFileAsync = promisify(execFile);

export type GoalStatus = 'active' | 'paused' | 'done' | 'failed' | 'budget';

export interface LabGoal {
  slug: string;
  channelId: string;
  goal: string;
  gate?: string; // shell command that must exit 0 for the goal to count as done
  status: GoalStatus;
  maxIterations: number;
  maxMinutes: number;
  iterations: number;
  startedAt: number;
  updatedAt: number;
  lastSummary: string;
  history: { at: number; note: string }[];
}

export const DEFAULT_MAX_ITERATIONS = 12;
export const DEFAULT_MAX_MINUTES = 40;
const HARD_MAX_ITERATIONS = 40;
const HARD_MAX_MINUTES = 120;

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(Math.round(n), lo), hi);
const goalPath = (slug: string) => path.join(LAB_PROJECTS_DIR, slug, '.mrroboto-goal.json');

export function getGoal(slug: string): LabGoal | null {
  try { return JSON.parse(fs.readFileSync(goalPath(slug), 'utf8')) as LabGoal; } catch { return null; }
}

export function saveGoal(goal: LabGoal): void {
  goal.updatedAt = Date.now();
  fs.mkdirSync(path.join(LAB_PROJECTS_DIR, goal.slug), { recursive: true });
  fs.writeFileSync(goalPath(goal.slug), JSON.stringify(goal, null, 2));
}

export function newGoal(
  slug: string,
  channelId: string,
  goal: string,
  opts: { gate?: string; maxIterations?: number; maxMinutes?: number } = {},
): LabGoal {
  const g: LabGoal = {
    slug, channelId, goal,
    gate: opts.gate,
    status: 'active',
    maxIterations: clamp(opts.maxIterations ?? DEFAULT_MAX_ITERATIONS, 1, HARD_MAX_ITERATIONS),
    maxMinutes: clamp(opts.maxMinutes ?? DEFAULT_MAX_MINUTES, 1, HARD_MAX_MINUTES),
    iterations: 0,
    startedAt: Date.now(),
    updatedAt: Date.now(),
    lastSummary: '',
    history: [],
  };
  saveGoal(g);
  return g;
}

export function stopGoal(slug: string, status: GoalStatus = 'paused'): LabGoal | null {
  const g = getGoal(slug);
  if (!g) return null;
  g.status = status;
  g.history.push({ at: Date.now(), note: `stopped (${status})` });
  saveGoal(g);
  return g;
}

/** Every lab project whose goal is currently `active` (the driver scans these). */
export function listActiveGoals(): LabGoal[] {
  let dirs: string[];
  try {
    dirs = fs.readdirSync(LAB_PROJECTS_DIR, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch { return []; }
  const out: LabGoal[] = [];
  for (const slug of dirs) { const g = getGoal(slug); if (g && g.status === 'active') out.push(g); }
  return out;
}

/** Run the quality gate command in the project dir. exit 0 = pass. */
export async function runGate(slug: string, gate: string): Promise<{ ok: boolean; out: string }> {
  const cwd = path.join(LAB_PROJECTS_DIR, slug);
  try {
    const { stdout, stderr } = await execFileAsync('bash', ['-lc', gate], { cwd, timeout: 5 * 60 * 1000, maxBuffer: 8 * 1024 * 1024 });
    return { ok: true, out: (stdout + stderr).trim().slice(-500) };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    return { ok: false, out: ((err.stdout ?? '') + (err.stderr ?? '') || err.message || 'gate failed').trim().slice(-500) };
  }
}
