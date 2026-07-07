import Anthropic from '@anthropic-ai/sdk';
import type { AiProvider, ChatMessage } from './provider.js';

export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic';
  private readonly client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

  constructor(readonly model: string) {}

  async chat(history: ChatMessage[], system: string): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      thinking: { type: 'adaptive' },
      system,
      messages: history,
    });
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');
    if (response.stop_reason === 'refusal') {
      return 'Sorry, I can’t help with that one.';
    }
    return text || '(no response)';
  }
}
