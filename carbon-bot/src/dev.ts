import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { query, type Options } from '@anthropic-ai/claude-agent-sdk';
import { config } from './config.js';
import { describeToolUse } from './ai/claudeCode.js';
import type { ChatProgress } from './ai/index.js';
import { clearDevSession, getDevSession, setDevSession } from './db/history.js';

// Channel-per-repo development: a Discord channel named after a directory under
// REPO_ROOT becomes a persistent Claude Code session working in that repo.
// Sessions resume across messages and bot restarts (persisted in SQLite);
// "!reset" starts a fresh one. The session gets the user's MCP servers
// (knowledge base etc.) plus the repo's own project settings/CLAUDE.md.

// User-scope MCP servers live in ~/.claude.json; in Docker that file is
// mounted read-only at HOST_CLAUDE_JSON. Passed programmatically so the
// dev session has the same MCPs (knowledge base, etc.) as the host CLI.
function loadUserMcpServers(): Options['mcpServers'] {
  const file = process.env.HOST_CLAUDE_JSON ?? path.join(os.homedir(), '.claude.json');
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as {
      mcpServers?: Options['mcpServers'];
    };
    return parsed.mcpServers && Object.keys(parsed.mcpServers).length
      ? parsed.mcpServers
      : undefined;
  } catch {
    return undefined;
  }
}

const userMcpServers = loadUserMcpServers();
if (userMcpServers) {
  console.log('[dev] MCP servers for dev sessions:', Object.keys(userMcpServers).join(', '));
}

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

export async function devChat(
  channelId: string,
  repoPath: string,
  prompt: string,
  onProgress?: ChatProgress,
): Promise<string> {
  const options: Options = {
    cwd: repoPath,
    model: config.claudeCodeModel === 'default' ? undefined : config.claudeCodeModel,
    permissionMode: 'bypassPermissions',
    settingSources: ['user', 'project'], // user skills + repo CLAUDE.md/.mcp.json
    mcpServers: userMcpServers,
    maxTurns: 150,
    resume: getDevSession(channelId),
    systemPrompt:
      `You are MrRoboto, a coding agent working in the git repository at ${repoPath}. ` +
      'You are driven from a Discord channel dedicated to this repo, so keep final replies ' +
      'under 1800 characters and lead with what changed or what you found. ' +
      'Commit when asked; never push to remotes unless explicitly asked.',
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
  return result || '(no response)';
}
