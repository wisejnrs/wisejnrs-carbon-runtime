import * as lancedb from '@lancedb/lancedb';
import path from 'node:path';
import { config } from '../config.js';

const TABLE = 'corpus';

export interface CorpusChunk {
  vector: number[];
  text: string;
  source: string;
  chunk: number;
  [key: string]: unknown;
}

export interface SearchHit {
  text: string;
  source: string;
  score: number;
}

let dbPromise: Promise<lancedb.Connection> | undefined;

function getDb(): Promise<lancedb.Connection> {
  dbPromise ??= lancedb.connect(path.join(config.dataDir, 'lancedb'));
  return dbPromise;
}

export async function replaceCorpus(chunks: CorpusChunk[]): Promise<void> {
  const db = await getDb();
  await db.createTable(TABLE, chunks, { mode: 'overwrite' });
}

export async function corpusCount(): Promise<number> {
  try {
    const db = await getDb();
    const table = await db.openTable(TABLE);
    return await table.countRows();
  } catch {
    return 0; // table doesn't exist yet
  }
}

export async function search(vector: number[], k = 5): Promise<SearchHit[]> {
  try {
    const db = await getDb();
    const table = await db.openTable(TABLE);
    const rows = (await table.vectorSearch(vector).limit(k).toArray()) as Array<
      CorpusChunk & { _distance: number }
    >;
    return rows.map((row) => ({
      text: String(row.text),
      source: String(row.source),
      score: row._distance,
    }));
  } catch {
    return []; // no corpus ingested yet
  }
}
