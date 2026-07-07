import { query, type Options } from '@anthropic-ai/claude-agent-sdk';
import type { AiProvider, ChatMessage } from './provider.js';
import { config } from '../config.js';

// Routes chat through the local Claude Code CLI, so answers use the machine's
// existing Claude login (subscription) instead of a metered API key.
//
// CLAUDE_CODE_MODE controls how much the Discord session may do:
//   chat     - no tools at all, pure conversation (default)
//   readonly - loads user skills; only Skill/Read/Grep/Glob tools
//   full     - loads user skills with all tools auto-approved. Runs inside the
//              bot's container/host as the bot user - server members can drive it.
export class ClaudeCodeProvider implements AiProvider {
  readonly name = 'claude-code';

  constructor(readonly model: string) {}

  async chat(history: ChatMessage[], system: string): Promise<string> {
    // Each query() is a fresh session; replay the conversation as a transcript.
    const prompt = history
      .map((message) => `${message.role === 'user' ? 'User' : 'You'}: ${message.content}`)
      .join('\n\n');

    const options: Options = {
      systemPrompt: system,
      model: this.model === 'default' ? undefined : this.model,
      cwd: config.dataDir,
    };
    switch (config.claudeCodeMode) {
      case 'full':
        options.settingSources = ['user'];
        options.permissionMode = 'bypassPermissions';
        options.maxTurns = 40;
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
      if (message.type === 'result') {
        result =
          message.subtype === 'success'
            ? message.result
            : `Claude Code session ended without an answer (${message.subtype}).`;
      }
    }
    return result || '(no response)';
  }
}
