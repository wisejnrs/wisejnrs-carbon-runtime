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

export function repoForChannel(channelName: string): string | null {
  if (!channelName || channelName.includes('/') || channelName.includes('..')) return null;
  // "#project-pushmanifesto" and "#pushmanifesto" both map to REPO_ROOT/pushmanifesto.
  const candidates = channelName.startsWith('project-')
    ? [channelName.slice('project-'.length), channelName]
    : [channelName];
  for (const name of candidates) {
    const dir = path.join(config.repoRoot, name);
    try {
      if (fs.statSync(dir).isDirectory()) return dir;
    } catch {
      // not a repo dir; try the next candidate
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
  const options: Options = {
    cwd: repoPath,
    model: config.claudeCodeModel === 'default' ? undefined : config.claudeCodeModel,
    permissionMode: 'bypassPermissions',
    // Guard destructive Bash commands for non-owners without disrupting normal dev.
    hooks: { PreToolUse: [{ hooks: [commandGuardHook(owner)] }] },
    settingSources: ['user', 'project'], // user skills + repo CLAUDE.md/.mcp.json
    mcpServers: userMcpServers,
    maxTurns: 150,
    resume: getDevSession(channelId),
    systemPrompt:
      `You are MrRoboto, a coding agent working in the git repository at ${repoPath}. ` +
      'You are driven from a Discord channel dedicated to this repo, so keep final replies ' +
      'under 1800 characters and lead with what changed or what you found. ' +
      'Commit when asked; never push to remotes unless explicitly asked.' +
      (config.extraContext ? `\n\n${config.extraContext}` : ''),
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
