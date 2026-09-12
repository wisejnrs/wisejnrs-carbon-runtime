import { readFileSync } from 'node:fs';
import { config } from '../config.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAiProvider } from './openai.js';
import { ClaudeCodeProvider } from './claudeCode.js';
import type { AiProvider, ChatMessage, ChatProgress, ChatResult } from './provider.js';

export type { AiProvider, ChatMessage, ChatProgress, ChatResult };

export function createProvider(): AiProvider {
  switch (config.provider) {
    case 'openai':
      return new OpenAiProvider(config.openaiModel);
    case 'claude-code':
      return new ClaudeCodeProvider(config.claudeCodeModel);
    default:
      return new AnthropicProvider(config.anthropicModel);
  }
}

// No-spend self-heal: a plain conversational answer from the local Ollama model
// (or metered OpenAI) when the Claude subscription is capped. No tools/RAG/files —
// pure chat. Returns null if disabled or the fallback itself errors.
export async function fallbackChat(history: ChatMessage[], system: string): Promise<string | null> {
  if (config.fallbackProvider === 'none') return null;
  try {
    const provider =
      config.fallbackProvider === 'openai'
        ? new OpenAiProvider(config.openaiModel)
        : new OpenAiProvider(resolveOllamaModel(), { baseURL: config.ollamaUrl, apiKey: 'ollama' });
    const { text } = await provider.chat(history, system);
    return text?.trim() ? text : null;
  } catch (error) {
    console.warn('[fallback] local model failed:', error);
    return null;
  }
}

export function fallbackLabel(): string {
  return config.fallbackProvider === 'openai' ? config.openaiModel : `local ${resolveOllamaModel()}`;
}

// Which local model to fall back to on THIS host. OLLAMA_MODEL pins a tag; 'auto'
// reads picks.chat.tag from llm-fit.json (house/tools/llm_fit.py: llmfit's
// hardware-aware scoring joined to Ollama's installed tags, refreshed daily by
// cron), so a new GPU or a newly pulled model changes the pick with no redeploy.
// Re-read on every call — it's one small file and the cron may have just run.
let warnedFitFile = false;
export function resolveOllamaModel(): string {
  if (config.ollamaModel !== 'auto') return config.ollamaModel;
  try {
    const fit = JSON.parse(readFileSync(config.llmFitFile, 'utf8')) as {
      picks?: { chat?: { tag?: string } };
    };
    const tag = fit.picks?.chat?.tag;
    if (tag) return tag;
  } catch (error) {
    if (!warnedFitFile) {
      warnedFitFile = true;
      console.warn(`[fallback] no readable pick in ${config.llmFitFile}; using ${config.ollamaModelDefault}:`, error);
    }
  }
  return config.ollamaModelDefault;
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
