import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { config } from '../config.js';
import type { SearchHit } from './store.js';

// Remote retrieval against the knowledge server MCP (KNOWLEDGE_MCP_URL).
// The server already has the corpus indexed, so /ask searches it directly
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

async function callKnowledgeTool<T>(name: string, args: Record<string, unknown>): Promise<T | null> {
  if (!knowledgeConfigured()) return null;
  try {
    const client = await getClient();
    const result = await client.callTool({ name, arguments: args });
    const content = (result.content ?? []) as Array<{ type: string; text?: string }>;
    const text = content.find((item) => item.type === 'text')?.text;
    return text ? (JSON.parse(text) as T) : null;
  } catch (error) {
    console.warn(`[knowledge] ${name} failed:`, error);
    clientPromise = undefined; // drop the session; reconnect on the next query
    return null;
  }
}

export async function knowledgeSearch(query: string, k = 6): Promise<SearchHit[]> {
  const parsed = await callKnowledgeTool<{ results?: KnowledgeResult[] }>('semantic_search', {
    query,
    top_k: k,
  });
  return (parsed?.results ?? [])
    .filter((hit) => hit.snippet)
    .map((hit) => ({
      text: hit.snippet,
      source: `${hit.topic}/${hit.filename}`,
      score: hit.score,
    }));
}

export interface DocmostPage {
  id: string;
  title: string;
  excerpt: string;
}

export async function docmostSearch(query: string): Promise<DocmostPage[]> {
  const parsed = await callKnowledgeTool<{ results?: DocmostPage[] }>('docmost_search', {
    query,
  });
  return (parsed?.results ?? []).map((page) => ({
    ...page,
    excerpt: (page.excerpt ?? '').replace(/<\/?b>/g, '**'),
  }));
}
