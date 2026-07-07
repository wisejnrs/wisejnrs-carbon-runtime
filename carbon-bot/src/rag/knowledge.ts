import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { config } from '../config.js';
import type { SearchHit } from './store.js';

// Remote retrieval against the Wise knowledge server (knowledge.wisejnrs.net MCP).
// The server already has the full corpus indexed, so /ask searches it directly
// instead of re-embedding documents locally.

interface KnowledgeResult {
  score: number;
  topic: string;
  filename: string;
  snippet: string;
}

let clientPromise: Promise<Client> | undefined;

export function knowledgeConfigured(): boolean {
  return Boolean(config.knowledgeMcpUrl && config.knowledgeMcpKey);
}

async function connect(): Promise<Client> {
  const client = new Client({ name: 'carbon-bot', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(config.knowledgeMcpUrl!), {
    requestInit: { headers: { Authorization: `Bearer ${config.knowledgeMcpKey}` } },
  });
  await client.connect(transport);
  console.log('[knowledge] connected to', config.knowledgeMcpUrl);
  return client;
}

function getClient(): Promise<Client> {
  clientPromise ??= connect();
  return clientPromise;
}

export async function knowledgeSearch(query: string, k = 6): Promise<SearchHit[]> {
  if (!knowledgeConfigured()) return [];
  try {
    const client = await getClient();
    const result = await client.callTool({
      name: 'semantic_search',
      arguments: { query, top_k: k },
    });
    const content = (result.content ?? []) as Array<{ type: string; text?: string }>;
    const text = content.find((item) => item.type === 'text')?.text;
    if (!text) return [];
    const parsed = JSON.parse(text) as { results?: KnowledgeResult[] };
    return (parsed.results ?? [])
      .filter((hit) => hit.snippet)
      .map((hit) => ({
        text: hit.snippet,
        source: `${hit.topic}/${hit.filename}`,
        score: hit.score,
      }));
  } catch (error) {
    console.warn('[knowledge] search failed, will fall back to local store:', error);
    clientPromise = undefined; // drop the session; reconnect on the next query
    return [];
  }
}
