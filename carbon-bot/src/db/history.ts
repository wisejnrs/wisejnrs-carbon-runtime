import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

// Port of the old Carbon.Bot.Data History audit entity: every command
// invocation is logged with who ran it, where, and what came back.
let db: Database.Database | undefined;

function getDb(): Database.Database {
  if (!db) {
    fs.mkdirSync(config.dataDir, { recursive: true });
    db = new Database(path.join(config.dataDir, 'carbon-bot.db'));
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        user_id TEXT NOT NULL,
        user_tag TEXT NOT NULL,
        guild_id TEXT,
        channel_id TEXT NOT NULL,
        command TEXT NOT NULL,
        input TEXT,
        output TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_history_timestamp ON history(timestamp);
      CREATE INDEX IF NOT EXISTS idx_history_user ON history(user_id);
      CREATE INDEX IF NOT EXISTS idx_history_command ON history(command);
      CREATE TABLE IF NOT EXISTS dev_sessions (
        channel_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        repo TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      CREATE TABLE IF NOT EXISTS commitments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        dedupe_key TEXT NOT NULL,
        due_earliest INTEGER NOT NULL,
        due_latest INTEGER NOT NULL,
        confidence REAL NOT NULL,
        suggested_text TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        delivered_at TEXT,
        UNIQUE(channel_id, dedupe_key)
      );
      CREATE INDEX IF NOT EXISTS idx_commitments_due ON commitments(status, due_earliest);
      CREATE TABLE IF NOT EXISTS kv (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS facts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fact TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL DEFAULT 'general',
        score REAL NOT NULL DEFAULT 0.7,
        recall_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        last_recalled TEXT
      );
      CREATE TABLE IF NOT EXISTS dream_diary (
        date TEXT PRIMARY KEY,
        summary TEXT NOT NULL
      );
    `);
  }
  return db;
}

export interface HistoryEntry {
  userId: string;
  userTag: string;
  guildId: string | null;
  channelId: string;
  command: string;
  input?: string;
  output?: string;
}

export function logHistory(entry: HistoryEntry): void {
  try {
    getDb()
      .prepare(
        `INSERT INTO history (user_id, user_tag, guild_id, channel_id, command, input, output)
         VALUES (@userId, @userTag, @guildId, @channelId, @command, @input, @output)`,
      )
      .run({ input: null, output: null, ...entry });
  } catch (error) {
    console.error('[history] Failed to log entry:', error);
  }
}

export function getDevSession(channelId: string): string | undefined {
  try {
    const row = getDb()
      .prepare('SELECT session_id FROM dev_sessions WHERE channel_id = ?')
      .get(channelId) as { session_id: string } | undefined;
    return row?.session_id;
  } catch {
    return undefined;
  }
}

export function setDevSession(channelId: string, sessionId: string, repo: string): void {
  try {
    getDb()
      .prepare(
        `INSERT INTO dev_sessions (channel_id, session_id, repo, updated_at)
         VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
         ON CONFLICT(channel_id) DO UPDATE SET
           session_id = excluded.session_id, repo = excluded.repo, updated_at = excluded.updated_at`,
      )
      .run(channelId, sessionId, repo);
  } catch (error) {
    console.error('[dev] failed to persist session:', error);
  }
}

export function clearDevSession(channelId: string): boolean {
  try {
    return getDb().prepare('DELETE FROM dev_sessions WHERE channel_id = ?').run(channelId).changes > 0;
  } catch {
    return false;
  }
}

export interface Commitment {
  id: number;
  channel_id: string;
  kind: string;
  dedupe_key: string;
  due_earliest: number;
  due_latest: number;
  confidence: number;
  suggested_text: string;
  status: string;
}

export function insertCommitment(c: Omit<Commitment, 'id' | 'status'>): boolean {
  try {
    const result = getDb()
      .prepare(
        `INSERT OR IGNORE INTO commitments
           (channel_id, kind, dedupe_key, due_earliest, due_latest, confidence, suggested_text)
         VALUES (@channel_id, @kind, @dedupe_key, @due_earliest, @due_latest, @confidence, @suggested_text)`,
      )
      .run(c);
    return result.changes > 0;
  } catch (error) {
    console.error('[commitments] insert failed:', error);
    return false;
  }
}

export function dueCommitments(now: number): Commitment[] {
  try {
    return getDb()
      .prepare(
        `SELECT * FROM commitments WHERE status = 'pending' AND due_earliest <= ? ORDER BY due_earliest LIMIT 20`,
      )
      .all(now) as Commitment[];
  } catch {
    return [];
  }
}

export function settleCommitments(ids: number[], status: 'delivered' | 'dropped'): void {
  if (!ids.length) return;
  try {
    const mark = getDb().prepare(
      `UPDATE commitments SET status = ?, delivered_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
    );
    for (const id of ids) mark.run(status, id);
  } catch (error) {
    console.error('[commitments] settle failed:', error);
  }
}

export function deliveredToday(channelId: string): number {
  try {
    const row = getDb()
      .prepare(
        `SELECT COUNT(*) AS count FROM commitments
         WHERE channel_id = ? AND status = 'delivered' AND delivered_at >= strftime('%Y-%m-%dT00:00:00Z','now')`,
      )
      .get(channelId) as { count: number };
    return row.count;
  } catch {
    return 0;
  }
}

export function kvGet(key: string): string | undefined {
  try {
    const row = getDb().prepare('SELECT value FROM kv WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return row?.value;
  } catch {
    return undefined;
  }
}

export function kvSet(key: string, value: string): void {
  try {
    getDb()
      .prepare('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, value);
  } catch (error) {
    console.error('[kv] set failed:', error);
  }
}

export interface Fact {
  id: number;
  fact: string;
  category: string;
  score: number;
  recall_count: number;
  created_at: string;
}

export function listFacts(limit = 200): Fact[] {
  try {
    return getDb()
      .prepare(`SELECT id, fact, category, score, recall_count, created_at FROM facts
                WHERE status = 'active' ORDER BY score DESC, recall_count DESC LIMIT ?`)
      .all(limit) as Fact[];
  } catch {
    return [];
  }
}

export function factsCount(): number {
  try {
    const row = getDb().prepare(`SELECT COUNT(*) AS count FROM facts WHERE status='active'`).get() as { count: number };
    return row.count;
  } catch {
    return 0;
  }
}

export function insertFact(fact: string, category: string, score: number): boolean {
  try {
    return (
      getDb()
        .prepare('INSERT OR IGNORE INTO facts (fact, category, score) VALUES (?, ?, ?)')
        .run(fact.slice(0, 500), category.slice(0, 50), score).changes > 0
    );
  } catch {
    return false;
  }
}

export function updateFact(id: number, fact: string): void {
  try {
    getDb().prepare('UPDATE facts SET fact = ? WHERE id = ?').run(fact.slice(0, 500), id);
  } catch { /* keep old wording */ }
}

export function archiveFacts(ids: number[]): void {
  if (!ids.length) return;
  try {
    const mark = getDb().prepare(`UPDATE facts SET status = 'archived' WHERE id = ?`);
    for (const id of ids) mark.run(id);
  } catch { /* non-fatal */ }
}

export function bumpRecalls(ids: number[]): void {
  if (!ids.length) return;
  try {
    const bump = getDb().prepare(
      `UPDATE facts SET recall_count = recall_count + 1,
       last_recalled = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
    );
    for (const id of ids) bump.run(id);
  } catch { /* non-fatal */ }
}

/** Archive stale facts: never recalled, older than 30 days, low score. */
export function pruneStaleFacts(): number {
  try {
    return getDb()
      .prepare(
        `UPDATE facts SET status = 'archived'
         WHERE status = 'active' AND recall_count = 0 AND score < 0.75
           AND created_at < strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days')`,
      )
      .run().changes;
  } catch {
    return 0;
  }
}

export function recentHistory(sinceIso: string, limit = 80): Array<{ command: string; input: string; output: string }> {
  try {
    return getDb()
      .prepare(
        `SELECT command, COALESCE(input,'') AS input, COALESCE(output,'') AS output
         FROM history WHERE timestamp >= ? AND command IN ('chat','mention','voice','ask','dev')
         ORDER BY timestamp LIMIT ?`,
      )
      .all(sinceIso, limit) as Array<{ command: string; input: string; output: string }>;
  } catch {
    return [];
  }
}

export function appendDiary(date: string, summary: string): void {
  try {
    getDb()
      .prepare('INSERT INTO dream_diary (date, summary) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET summary = excluded.summary')
      .run(date, summary.slice(0, 2000));
  } catch { /* non-fatal */ }
}

export function historyCount(): number {
  try {
    const row = getDb().prepare('SELECT COUNT(*) AS count FROM history').get() as {
      count: number;
    };
    return row.count;
  } catch {
    return 0;
  }
}
