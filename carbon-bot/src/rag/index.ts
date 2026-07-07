import { config } from '../config.js';
import type { AiProvider, ChatMessage, ChatProgress } from '../ai/index.js';
import { embedOne } from './embeddings.js';
import { search, type SearchHit } from './store.js';
import { knowledgeConfigured, knowledgeSearch } from './knowledge.js';

export { ingestCorpus } from './ingest.js';
export { corpusCount } from './store.js';
export { knowledgeConfigured } from './knowledge.js';

export interface RagAnswer {
  answer: string;
  sources: string[];
  files: string[];
  workDir?: string;
}

// RAG-grounded ask: retrieve relevant corpus passages and hand them to the model
// as context. Retrieval prefers the remote knowledge server (full Wise corpus,
// already indexed); the local LanceDB store is the fallback. Falls back to plain
// chat when both are empty.
export async function askWithRag(
  provider: AiProvider,
  history: ChatMessage[],
  question: string,
  onProgress?: ChatProgress,
): Promise<RagAnswer> {
  onProgress?.('searching the corpus');
  let hits: SearchHit[] = [];
  if (knowledgeConfigured()) hits = await knowledgeSearch(question, 6);
  if (!hits.length) hits = await search(await embedOne(question), 5);

  let system = config.systemPrompt;
  const sources = [...new Set(hits.map((hit) => hit.source))];
  if (hits.length) {
    const context = hits
      .map((hit, i) => `[${i + 1}] (${hit.source})\n${hit.text}`)
      .join('\n\n---\n\n');
    system +=
      '\n\nUse the following corpus excerpts when they are relevant to the question. ' +
      'If they do not contain the answer, say so rather than inventing one.\n\n' +
      context;
  }

  const result = await provider.chat(history, system, onProgress);
  return { answer: result.text, sources, files: result.files, workDir: result.workDir };
}
