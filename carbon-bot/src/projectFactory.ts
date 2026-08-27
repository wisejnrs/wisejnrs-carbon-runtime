import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// MrRoboto's "start a project" capability. When he spots a genuine need — in
// conversation or on his own — he can scaffold a new project in his lab, commit
// it, and (best-effort) push to the private lab remote. The Discord side (a
// channel to build it in) lives in discordTools.ts; this module is pure
// filesystem + git so it stays testable and Discord-free.

export const LAB_DIR = process.env.LAB_DIR ?? '/work/wisejnrs-projects/mrroboto-lab';
export const LAB_PROJECTS_DIR = path.join(LAB_DIR, 'projects');
const LEDGER = path.join(LAB_DIR, '.factory-ledger.json');

// Soft guard so an unprompted loop can't sprawl the lab. Owner can always ask
// again tomorrow, or build inside an existing project channel.
export const MAX_PROJECTS_PER_DAY = 5;

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'project'
  );
}

interface LedgerEntry {
  slug: string;
  at: string;
}

function readLedger(): LedgerEntry[] {
  try {
    const v = JSON.parse(fs.readFileSync(LEDGER, 'utf8'));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function writeLedger(entries: LedgerEntry[]): void {
  try {
    fs.writeFileSync(LEDGER, JSON.stringify(entries, null, 2));
  } catch {
    // ledger is a soft guard; never fail the whole action over it
  }
}

/** How many projects MrRoboto has started today (local date). */
export function projectsStartedToday(): number {
  const today = new Date().toISOString().slice(0, 10);
  return readLedger().filter((e) => e.at.slice(0, 10) === today).length;
}

export interface LabProject {
  slug: string;
  title: string;
}

/** List MrRoboto's lab projects (newest first), with a title from each README. */
export function listProjects(): LabProject[] {
  let entries: string[];
  try {
    entries = fs
      .readdirSync(LAB_PROJECTS_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name);
  } catch {
    return [];
  }
  return entries
    .map((slug) => {
      const dir = path.join(LAB_PROJECTS_DIR, slug);
      let title = slug;
      try {
        const first = fs.readFileSync(path.join(dir, 'README.md'), 'utf8').split('\n')[0];
        title = first.replace(/^#\s*/, '').trim() || slug;
      } catch {
        // no README; fall back to slug
      }
      let mtime = 0;
      try {
        mtime = fs.statSync(dir).mtimeMs;
      } catch {
        // ignore
      }
      return { slug, title, mtime };
    })
    .sort((a, b) => b.mtime - a.mtime)
    .map(({ slug, title }) => ({ slug, title }));
}

export interface ProjectResult {
  slug: string;
  dir: string;
  pushed: boolean;
}

/**
 * Scaffold a new lab project: a folder under projects/ with a README stating
 * what and why, committed to the lab repo and (best-effort) pushed to origin.
 * Returns the resolved slug (deduped) and whether the push succeeded.
 */
export function createProject(name: string, why: string, summary?: string): ProjectResult {
  fs.mkdirSync(LAB_PROJECTS_DIR, { recursive: true });

  // Dedupe the slug against existing folders.
  const baseSlug = slugify(name);
  let slug = baseSlug;
  let dir = path.join(LAB_PROJECTS_DIR, slug);
  for (let n = 2; fs.existsSync(dir); n += 1) {
    slug = `${baseSlug}-${n}`;
    dir = path.join(LAB_PROJECTS_DIR, slug);
  }
  fs.mkdirSync(dir, { recursive: true });

  const readme =
    `# ${name}\n\n` +
    `> Started by MrRoboto on his own initiative.\n\n` +
    `**Why:** ${why}\n\n` +
    (summary ? `**What it will do:** ${summary}\n\n` : '') +
    `## Status\n\nJust scaffolded — build it out from the \`#lab-${slug}\` channel.\n`;
  fs.writeFileSync(path.join(dir, 'README.md'), readme);

  // Commit in the lab repo; push is best-effort (auth may not be wired in the
  // container — the local commit is what matters, push can follow).
  let pushed = false;
  const git = (...args: string[]) => execFileSync('git', args, { cwd: LAB_DIR, stdio: 'pipe' });
  try {
    git('add', '-A');
    git(
      '-c', `user.name=${process.env.GIT_AUTHOR_NAME || 'MrRoboto'}`,
      '-c', `user.email=${process.env.GIT_AUTHOR_EMAIL || 'mrroboto@users.noreply.github.com'}`,
      'commit', '-m', `feat(${slug}): start project — ${name}\n\nWhy: ${why}`,
    );
    try {
      git('push', 'origin', 'HEAD');
      pushed = true;
    } catch {
      pushed = false;
    }
  } catch {
    // nothing to commit / git unavailable — folder still exists
  }

  const ledger = readLedger();
  ledger.push({ slug, at: new Date().toISOString() });
  writeLedger(ledger);

  return { slug, dir, pushed };
}
