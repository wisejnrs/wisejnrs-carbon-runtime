import { config } from '../config.js';
import type { AiProvider, ChatMessage } from '../ai/index.js';
import { embedOne } from './embeddings.js';
import { search } from './store.js';

export { ingestCorpus } from './ingest.js';
export { corpusCount } from './store.js';

// RAG-grounded ask: retrieve relevant corpus chunks and hand them to the model
// as context, like the old Kernel Memory AskAsync path. Falls back to plain
// chat when the corpus is empty.
export async function askWithRag(
  provider: AiProvider,
  history: ChatMessage[],
  question: string,
): Promise<{ answer: string; sources: string[] }> {
  const hits = await search(await embedOne(question), 5);

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

  const answer = await provider.chat(history, system);
  return { answer, sources };
}
