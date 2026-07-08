import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Options } from '@anthropic-ai/claude-agent-sdk';

// User-scope MCP servers live in ~/.claude.json on the host; in Docker that
// file is mounted read-only at HOST_CLAUDE_JSON. Loaded once and passed to
// every Claude Code session (chat full mode + dev channels) so the bot has
// the same MCPs (knowledge base, gmail, calendar, ...) as the host CLI.
//
// Registered paths reference the host home (/home/ubuntu/...); inside the
// container home is /home/node, so remap any home-prefixed strings.
function remapHome(value: string, hostHome: string): string {
  return value.split(hostHome).join(os.homedir());
}

function loadServers(): Options['mcpServers'] {
  const file = process.env.HOST_CLAUDE_JSON ?? path.join(os.homedir(), '.claude.json');
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as {
      mcpServers?: Record<string, Record<string, unknown>>;
    };
    const servers = parsed.mcpServers ?? {};
    if (!Object.keys(servers).length) return undefined;

    const hostHome = process.env.HOST_HOME ?? '/home/ubuntu';
    if (path.resolve(hostHome) !== path.resolve(os.homedir())) {
      for (const server of Object.values(servers)) {
        for (const [key, value] of Object.entries(server)) {
          if (typeof value === 'string') server[key] = remapHome(value, hostHome);
          else if (Array.isArray(value)) {
            server[key] = value.map((item) =>
              typeof item === 'string' ? remapHome(item, hostHome) : item,
            );
          } else if (key === 'env' && value && typeof value === 'object') {
            const env = value as Record<string, unknown>;
            for (const [envKey, envValue] of Object.entries(env)) {
              if (typeof envValue === 'string') env[envKey] = remapHome(envValue, hostHome);
            }
          }
        }
      }
    }
    return servers as Options['mcpServers'];
  } catch {
    return undefined;
  }
}

export const userMcpServers = loadServers();
if (userMcpServers) {
  console.log('[mcp] user MCP servers loaded:', Object.keys(userMcpServers).join(', '));
}
