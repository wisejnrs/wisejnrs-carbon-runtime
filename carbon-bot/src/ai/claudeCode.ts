import fs from 'node:fs/promises';
import path from 'node:path';
import { query, type Options } from '@anthropic-ai/claude-agent-sdk';
import { commandGuardHook } from '../commandGuard.js';
import type { AiProvider, ChatMessage, ChatProgress, ChatResult } from './provider.js';
import { config } from '../config.js';
import { userMcpServers } from '../mcp.js';
import { whatsappMcpServer } from '../waTools.js';
import { discordMcpServer } from '../discordTools.js';
import { graphMcpServer } from '../graphTools.js';
import { poolMcpServer } from '../poolTools.js';
import { skyMcpServer } from '../skyTools.js';
import { robovacMcpServer } from '../robovacTools.js';
import { garageMcpServer } from '../garageTools.js';
import { statsMcpServer } from '../statsTools.js';

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
    owner = true,
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
        // Guard destructive Bash for non-owners (e.g. @mentions from social channels).
        options.hooks = { PreToolUse: [{ hooks: [commandGuardHook(owner)] }] };
        options.mcpServers = {
          ...(userMcpServers ?? {}),
          ...(config.whatsappEnabled ? { whatsapp: whatsappMcpServer } : {}),
          ...(config.graphEnabled ? { work: graphMcpServer } : {}),
          discord: discordMcpServer,
          ...(config.poolEnabled ? { pool: poolMcpServer } : {}),
          ...(config.skyEnabled ? { sky: skyMcpServer } : {}),
          ...(config.robovacEnabled ? { robovac: robovacMcpServer } : {}),
          ...(config.garageEnabled ? { garage: garageMcpServer } : {}),
          ...(config.statsEnabled ? { housestats: statsMcpServer } : {}),
        };
        options.maxTurns = 40;
        options.systemPrompt =
          system +
          '\n\nIf the task produces output files, save them into the current working ' +
          'directory - they will be attached to your Discord reply automatically.' +
          (config.whatsappEnabled
            ? '\n\nYou have WhatsApp tools (wa_recent_chats, wa_messages, wa_search, wa_send) ' +
              'for the user\'s linked personal account - use them for anything WhatsApp-related.'
            : '') +
          '\n\nYou have Discord tools (discord_channels, discord_read, discord_search, ' +
          'discord_post, discord_invite) for this server - use them to catch up on, post to, ' +
          'or (when the channel owner asks) invite people into channels. discord_invite defaults ' +
          'to the current channel and only succeeds if the requester owns/manages it.' +
          '\n\nFor richer output you also have: discord_embed (post a titled card with fields - use ' +
          'it instead of plain text for statuses, summaries, briefs, checklists), discord_poll (a ' +
          'native vote when a decision needs input), discord_thread (open a thread to keep a task ' +
          'tidy), and discord_pin (pin an important message). Reach for embeds by default when the ' +
          'content has clear parts.' +
          '\n\nYou also have start_project: when you genuinely spot a real need for a new tool, ' +
          'script, or small app - whether it comes up in conversation or you notice it on your own - ' +
          'you may start one. It scaffolds a folder in your own lab, opens a private #lab-... channel ' +
          'to build it in, and commits+pushes to your private lab. Use it deliberately for things ' +
          'genuinely worth building (not trivial answers), name it clearly, and say why. You then ' +
          'build it out from its #lab-... channel. Never make anything public or push other repos.' +
          '\n\nInside a #lab-... channel you also have set_goal / stop_goal: set_goal gives that ' +
          'project an AUTONOMOUS build goal (with an optional quality gate like "npm test" and a ' +
          'turn/time budget) and you then keep building toward it on your own, one bounded turn at a ' +
          'time with no human reply, until the gate passes, you are blocked, or the budget runs out - ' +
          'posting progress in the channel each turn. Use it when Mike asks you to build something out ' +
          'autonomously / on your own / overnight. stop_goal pauses it.' +
          (config.graphEnabled
            ? '\n\nYou have WORK Microsoft 365 tools (work_calendar, work_email, work_send_email) ' +
              `for ${config.workEmail} - use these whenever the user asks about their WORK calendar or email ` +
              '(this is a different account from the personal Google one).'
            : '') +
          (config.skyEnabled
            ? '\n\nYou have a SKY tool (sky_status): current weather, sun times (sunrise/sunset, ' +
              'daylight hours, UV, expected sunshine), moon phase, AND live Fronius solar ' +
              '(PV now + energy today/year/lifetime) for the home location.'
            : '') +
          (config.robovacEnabled
            ? '\n\nYou have ROBOVAC tools for the Deebot "Cinderella" (N30 PRO OMNI): robovac_status ' +
              '(battery/state/rooms), robovac_clean (whole-house or named rooms like Kitchen/Hallway, ' +
              'optional fan speed), robovac_control (dock/pause/resume/stop), robovac_fan. Cleaning ' +
              'actuates the real vac and is owner-only.'
            : '') +
          (config.garageEnabled
            ? '\n\nYou have GARAGE tools (Meross): garage_status (open/closed), garage_open, ' +
              'garage_close. Open/close actuate the real door and are owner-only.'
            : '') +
          (config.statsEnabled
            ? '\n\nYou have house_stats: trends across all topics (weather/solar/pool/air/garage/vac/network) over N days.'
            : '') +
          (config.poolEnabled
            ? '\n\nYou have POOL tools for Mike\'s WisePool (Zodiac eXO salt-water chlorinator): ' +
              'pool_status (temp, pH, salt %, pump/chlorinator/aux states), pool_control (turn ' +
              'chlorinator/boost/low/aux1/aux2 on or off), pool_schedules (list the timer slots), and ' +
              'pool_schedule_set (change a slot\'s window or enabled flag). Control and schedule changes ' +
              'actuate real equipment and are owner-only. Note the chlorinator only produces when the ' +
              'filter pump is running (no-flow interlock).'
            : '') +
          (config.extraContext ? `\n\n${config.extraContext}` : '');
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

// Minimal one-shot query: no tools, no skills, no MCP. Used for background
// work (commitment extraction, proactive check-in drafting) where re-injected
// content is untrusted and must not be able to trigger tools.
export async function liteQuery(prompt: string, system: string, model?: string): Promise<string> {
  let result = '';
  for await (const message of query({
    prompt,
    options: {
      systemPrompt: system,
      model: model ?? (config.claudeCodeModel === 'default' ? undefined : config.claudeCodeModel),
      tools: [],
      maxTurns: 4,
      cwd: config.dataDir,
    },
  })) {
    if (message.type === 'result' && message.subtype === 'success') result = message.result;
  }
  return result;
}

// Compact OpenClaw-style tool rows: "🛠️ Bash: run tests"
const TOOL_EMOJI: Record<string, string> = {
  Bash: '🛠️', Read: '📖', Write: '✏️', Edit: '✏️', Glob: '🗂️', Grep: '🔍',
  WebSearch: '🔎', WebFetch: '🌐', Skill: '🧰', Task: '🤖', TodoWrite: '📋',
};

export function describeToolUse(name: string, input: unknown): string {
  const args = (input ?? {}) as Record<string, unknown>;
  const emoji = TOOL_EMOJI[name] ?? (name.startsWith('mcp__') ? '🔌' : '⚙️');
  const label = name.startsWith('mcp__') ? name.split('__').slice(1).join(' ') : name;
  let detail = '';
  if (name === 'Skill' && typeof args.command === 'string') detail = args.command;
  else if (name === 'Skill' && typeof args.skill === 'string') detail = String(args.skill);
  else if (name === 'Bash' && typeof args.description === 'string') detail = args.description;
  else if (typeof args.file_path === 'string') detail = path.basename(args.file_path);
  else if (typeof args.query === 'string') detail = `"${String(args.query).slice(0, 40)}"`;
  return `${emoji} ${label}${detail ? `: ${detail}` : ''}`;
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
