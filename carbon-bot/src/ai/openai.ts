import OpenAI from 'openai';
import type { AiProvider, ChatMessage } from './provider.js';

export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';
  private readonly client = new OpenAI(); // reads OPENAI_API_KEY from the environment

  constructor(readonly model: string) {}

  async chat(history: ChatMessage[], system: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_completion_tokens: 1024,
      messages: [{ role: 'system', content: system }, ...history],
    });
    return response.choices[0]?.message?.content ?? '(no response)';
  }
}
