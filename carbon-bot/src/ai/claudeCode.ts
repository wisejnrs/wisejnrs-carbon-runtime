import fs from 'node:fs/promises';
import path from 'node:path';
import { query, type Options } from '@anthropic-ai/claude-agent-sdk';
import type { AiProvider, ChatMessage, ChatProgress, ChatResult } from './provider.js';
import { config } from '../config.js';

// Routes chat through the local Claude Code CLI, so answers use the machine's
// existing Claude login (subscription) instead of a metered API key.
//
// CLAUDE_CODE_MODE controls how much the Discord session may do:
//   chat     - no tools at all, pure conversation (default)
//   readonly - loads user skills; only Skill/Read/Grep/Glob tools
//   full     - loads user skills with all tools auto-approved. Runs inside the
//              bot's container/host as the bot user - server members can drive it.
//
// Each request runs in a fresh session directory; files the session writes
// there are returned so the caller can attach them to the Discord reply.
export class ClaudeCodeProvider implements AiProvider {
  readonly name = 'claude-code';

  constructor(readonly model: string) {}

  async chat(
    history: ChatMessage[],
    system: string,
    onProgress?: ChatProgress,
  ): Promise<ChatResult> {
    const sessionDir = path.join(
      config.dataDir,
      'sessions',
      `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    );
    await fs.mkdir(sessionDir, { recursive: true });

    // Each query() is a fresh session; replay the conversation as a transcript.
    const prompt = history
      .map((message) => `${message.role === 'user' ? 'User' : 'You'}: ${message.content}`)
      .join('\n\n');

    const options: Options = {
      systemPrompt: system,
      model: this.model === 'default' ? undefined : this.model,
      cwd: sessionDir,
    };
    switch (config.claudeCodeMode) {
      case 'full':
        options.settingSources = ['user'];
        options.permissionMode = 'bypassPermissions';
        options.maxTurns = 40;
        options.systemPrompt =
          system +
          '\n\nIf the task produces output files, save them into the current working ' +
          'directory - they will be attached to your Discord reply automatically.';
        break;
      case 'readonly':
        options.settingSources = ['user'];
        options.tools = ['Skill', 'Read', 'Grep', 'Glob'];
        options.maxTurns = 20;
        break;
      default:
        options.tools = []; // no tools: Discord chat cannot touch this machine
        options.maxTurns = 8;
    }

    let result = '';
    for await (const message of query({ prompt, options })) {
      if (message.type === 'assistant') {
        for (const block of message.message.content) {
          if (block.type === 'tool_use') onProgress?.(describeToolUse(block.name, block.input));
        }
      } else if (message.type === 'result') {
        result =
          message.subtype === 'success'
            ? message.result
            : `Claude Code session ended without an answer (${message.subtype}).`;
      }
    }

    return {
      text: result || '(no response)',
      files: await collectFiles(sessionDir),
      workDir: sessionDir,
    };
  }
}

export function describeToolUse(name: string, input: unknown): string {
  const args = (input ?? {}) as Record<string, unknown>;
  if (name === 'Skill' && typeof args.command === 'string') return `skill ${args.command}`;
  if (name === 'Skill' && typeof args.skill === 'string') return `skill ${args.skill}`;
  if (name === 'Bash' && typeof args.description === 'string') return args.description;
  if (typeof args.file_path === 'string') return `${name} ${path.basename(args.file_path)}`;
  return `using ${name}`;
}

async function collectFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  let entries: string[];
  try {
    entries = await fs.readdir(dir, { recursive: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (entry.split(path.sep).some((part) => part.startsWith('.'))) continue;
    const fullPath = path.join(dir, entry);
    const stat = await fs.stat(fullPath).catch(() => null);
    if (stat?.isFile() && stat.size > 0) files.push(fullPath);
  }
  return files;
}
