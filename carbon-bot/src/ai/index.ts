import { config } from '../config.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAiProvider } from './openai.js';
import type { AiProvider, ChatMessage } from './provider.js';

export type { AiProvider, ChatMessage };

export function createProvider(): AiProvider {
  return config.provider === 'openai'
    ? new OpenAiProvider(config.openaiModel)
    : new AnthropicProvider(config.anthropicModel);
}

// Per-channel conversation memory, capped so long-lived channels don't grow unbounded.
const histories = new Map<string, ChatMessage[]>();

export function getHistory(channelId: string): ChatMessage[] {
  let history = histories.get(channelId);
  if (!history) {
    history = [];
    histories.set(channelId, history);
  }
  return history;
}

export function pushHistory(channelId: string, message: ChatMessage): void {
  const history = getHistory(channelId);
  history.push(message);
  while (history.length > config.historyLimit) history.shift();
}
