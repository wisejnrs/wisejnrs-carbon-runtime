import OpenAI from 'openai';
import type { AiProvider, ChatMessage, ChatResult } from './provider.js';

export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';
  private readonly client: OpenAI;
  private readonly local: boolean;

  // With no opts this reads OPENAI_API_KEY from the environment. Pass a baseURL
  // to target any OpenAI-compatible server — e.g. a local Ollama at
  // http://host:11434/v1 — which is how the no-spend Claude fallback works.
  constructor(
    readonly model: string,
    opts?: { baseURL?: string; apiKey?: string },
  ) {
    this.local = Boolean(opts?.baseURL);
    this.client = new OpenAI(this.local ? { baseURL: opts!.baseURL, apiKey: opts?.apiKey ?? 'ollama' } : {});
  }

  async chat(history: ChatMessage[], system: string): Promise<ChatResult> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_completion_tokens: 1024,
      messages: [{ role: 'system', content: system }, ...history],
      // Ollama maps reasoning_effort:'none' to think=false. Without it, hybrid-thinking
      // models (Qwen3.x) spend the whole token budget in `reasoning` and return an
      // empty `content` — a 46 s silent reply. Real OpenAI models reject the field.
      ...(this.local ? { reasoning_effort: 'none' as const } : {}),
    });
    return { text: response.choices[0]?.message?.content ?? '(no response)', files: [] };
  }
}
