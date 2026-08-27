import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { query, type Options } from '@anthropic-ai/claude-agent-sdk';
import { config } from './config.js';
import { commandGuardHook } from './commandGuard.js';
import { describeToolUse } from './ai/claudeCode.js';
import type { ChatProgress } from './ai/index.js';
import { clearDevSession, getDevSession, setDevSession } from './db/history.js';

// Channel-per-repo development: a Discord channel named after a directory under
// REPO_ROOT becomes a persistent Claude Code session working in that repo.
// Sessions resume across messages and bot restarts (persisted in SQLite);
// "!reset" starts a fresh one. The session gets the user's MCP servers
// (knowledge base etc.) plus the repo's own project settings/CLAUDE.md.

import { userMcpServers } from './mcp.js';
import { poolMcpServer } from './poolTools.js';
import { skyMcpServer } from './skyTools.js';
import { robovacMcpServer } from './robovacTools.js';
import { garageMcpServer } from './garageTools.js';
import { statsMcpServer } from './statsTools.js';
import { LAB_PROJECTS_DIR } from './projectFactory.js';

// Channels whose name doesn't match a repo dir 1:1.
const CHANNEL_REPO_ALIASES: Record<string, string> = {
  // The Printful/Shopify shop lives inside the website (headless Shopify storefront).
  'wisejnrs-store': 'wisejnrs-website',
};

// Optional "suite" channels: some channels span a whole suite of sibling repos
// (shared shell/design-system, submodules, cross-app changes) rather than one
// repo, so they root the session at a shared parent dir and can traverse/edit
// siblings. Names + path come from config (env), so nothing org-specific is
// hardcoded here. Empty config = no suite behavior.
const SUITE_ROOT_CHANNELS = new Set(config.suiteChannels);
const SUITE_SUBDIR = config.suiteSubdir;

export function repoForChannel(channelName: string): string | null {
  if (!channelName || channelName.includes('/') || channelName.includes('..')) return null;
  // "#project-pushmanifesto" and "#pushmanifesto" both map to <root>/pushmanifesto.
  const base = channelName.startsWith('project-')
    ? channelName.slice('project-'.length)
    : channelName;
  // MrRoboto's self-started lab projects: #lab-<slug> -> mrroboto-lab/projects/<slug>.
  if (base.startsWith('lab-')) {
    const labProject = path.join(LAB_PROJECTS_DIR, base.slice('lab-'.length));
    try {
      if (fs.statSync(labProject).isDirectory()) return labProject;
    } catch {
      // not a lab project; fall through to normal resolution
    }
  }
  // Suite channels work from the suite root, not a single repo (opt-in via env).
  if (SUITE_SUBDIR && SUITE_ROOT_CHANNELS.has(base)) {
    const suiteRoot = path.join(config.repoRoot, SUITE_SUBDIR);
    try {
      if (fs.statSync(suiteRoot).isDirectory()) return suiteRoot;
    } catch {
      // suite root not mounted; fall through to per-repo resolution
    }
  }
  const candidates = channelName.startsWith('project-')
    ? [channelName.slice('project-'.length), channelName]
    : [channelName];
  if (CHANNEL_REPO_ALIASES[base]) candidates.unshift(CHANNEL_REPO_ALIASES[base]);
  // Search REPO_ROOT directly AND one level deep, so a shared parent (e.g. REPO_ROOT=/work)
  // covers multiple sibling project trees beneath it.
  let roots = [config.repoRoot];
  try {
    roots = roots.concat(
      fs
        .readdirSync(config.repoRoot, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
        .map((e) => path.join(config.repoRoot, e.name)),
    );
  } catch {
    // REPO_ROOT unreadable; fall back to REPO_ROOT-only
  }
  for (const name of candidates) {
    for (const root of roots) {
      const dir = path.join(root, name);
      try {
        if (fs.statSync(dir).isDirectory()) return dir;
      } catch {
        // not a repo dir; try the next
      }
    }
  }
  return null;
}

export function devChannelsAvailable(): boolean {
  try {
    return fs.statSync(config.repoRoot).isDirectory();
  } catch {
    return false;
  }
}

export function resetDevSession(channelId: string): boolean {
  return clearDevSession(channelId);
}

// Deliverable artifact types worth attaching to Discord after a dev turn.
const DELIVERABLE = new Set([
  '.pdf', '.epub', '.mobi', '.docx', '.pptx', '.xlsx', '.csv',
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.zip', '.html',
]);
const SKIP_DIRS = new Set(['.git', 'node_modules', 'attic', '.next', 'vendor']);
const MAX_ATTACH_BYTES = 9 * 1024 * 1024;

// Files the session created/modified during this turn (by mtime), so build
// outputs (a PDF, an EPUB) get attached to the Discord reply automatically.
async function collectArtifacts(repoPath: string, since: number): Promise<string[]> {
  const found: string[] = [];
  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 6 || found.length >= 10) return;
    const entries = await fs.promises.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (found.length >= 10) return;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) await walk(full, depth + 1);
      } else if (DELIVERABLE.has(path.extname(entry.name).toLowerCase())) {
        const stat = await fs.promises.stat(full).catch(() => null);
        if (stat && stat.mtimeMs >= since && stat.size > 0 && stat.size <= MAX_ATTACH_BYTES) {
          found.push(full);
        }
      }
    }
  }
  await walk(repoPath, 0);
  return found;
}

export interface DevResult {
  text: string;
  files: string[];
}

export async function devChat(
  channelId: string,
  repoPath: string,
  prompt: string,
  onProgress?: ChatProgress,
  owner = true,
): Promise<DevResult> {
  const startedAt = Date.now() - 2000; // small clock-skew buffer
  const isSuiteRoot = path.basename(repoPath) === SUITE_SUBDIR;
  const systemPrompt = isSuiteRoot
    ? `You are MrRoboto, a coding agent working from ${config.suiteName} root at ${repoPath}. ` +
      'This directory holds many sibling repos — each its own git repo — that share a common ' +
      'shell/design-system, backend pattern, and infrastructure. Read ./CLAUDE.md (the suite guide)' +
      (config.suiteBrain ? ` and ${config.suiteBrain}` : '') +
      ' for how they fit together, and a repo’s own CLAUDE.md before changing it. Traverse into and ' +
      'edit whatever sibling repos the task needs (a shared shell change can roll across all apps; ' +
      'some repos have submodules); commit within each repo you actually changed. Keep final replies ' +
      'under 1800 characters and lead with what changed or what you found. Never push to remotes unless explicitly asked.'
    : `You are MrRoboto, a coding agent working in the git repository at ${repoPath}. ` +
      'You are driven from a Discord channel dedicated to this repo, so keep final replies ' +
      'under 1800 characters and lead with what changed or what you found. ' +
      'Commit when asked; never push to remotes unless explicitly asked.';
  const options: Options = {
    cwd: repoPath,
    model: config.claudeCodeModel === 'default' ? undefined : config.claudeCodeModel,
    permissionMode: 'bypassPermissions',
    // Guard destructive Bash commands for non-owners without disrupting normal dev.
    hooks: { PreToolUse: [{ hooks: [commandGuardHook(owner)] }] },
    settingSources: ['user', 'project'], // user skills + repo CLAUDE.md/.mcp.json
    mcpServers: {
      ...userMcpServers,
      ...(config.poolEnabled ? { pool: poolMcpServer } : {}),
      ...(config.skyEnabled ? { sky: skyMcpServer } : {}),
      ...(config.robovacEnabled ? { robovac: robovacMcpServer } : {}),
      ...(config.garageEnabled ? { garage: garageMcpServer } : {}),
      ...(config.statsEnabled ? { housestats: statsMcpServer } : {}),
    },
    maxTurns: 150,
    resume: getDevSession(channelId),
    systemPrompt: systemPrompt + (config.extraContext ? `\n\n${config.extraContext}` : ''),
  };

  let result = '';
  for await (const message of query({ prompt, options })) {
    if (message.type === 'system' && message.subtype === 'init') {
      setDevSession(channelId, message.session_id, repoPath);
    } else if (message.type === 'assistant') {
      for (const block of message.message.content) {
        if (block.type === 'tool_use') onProgress?.(describeToolUse(block.name, block.input));
      }
    } else if (message.type === 'result') {
      result =
        message.subtype === 'success'
          ? message.result
          : `Session ended without an answer (${message.subtype}). Try again or send !reset.`;
    }
  }
  return { text: result || '(no response)', files: await collectArtifacts(repoPath, startedAt) };
}
