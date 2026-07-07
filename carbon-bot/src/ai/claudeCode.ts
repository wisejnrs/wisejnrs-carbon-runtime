import { query } from '@anthropic-ai/claude-agent-sdk';
import type { AiProvider, ChatMessage } from './provider.js';
import { config } from '../config.js';

// Routes chat through the local Claude Code CLI, so answers use the machine's
// existing Claude login (subscription) instead of a metered API key.
// Tools are disabled: a Discord message must never touch this machine.
export class ClaudeCodeProvider implements AiProvider {
  readonly name = 'claude-code';

  constructor(readonly model: string) {}

  async chat(history: ChatMessage[], system: string): Promise<string> {
    // Each query() is a fresh session; replay the conversation as a transcript.
    const prompt = history
      .map((message) => `${message.role === 'user' ? 'User' : 'You'}: ${message.content}`)
      .join('\n\n');

    let result = '';
    for await (const message of query({
      prompt,
      options: {
        systemPrompt: system,
        model: this.model === 'default' ? undefined : this.model,
        allowedTools: [],
        maxTurns: 1,
        cwd: config.dataDir,
      },
    })) {
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
