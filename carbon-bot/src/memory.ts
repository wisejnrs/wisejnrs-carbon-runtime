import crypto from 'node:crypto';
import { liteQuery } from './ai/claudeCode.js';
import { config } from './config.js';
import {
  appendDiary,
  archiveFacts,
  bumpRecalls,
  insertFact,
  kvGet,
  kvSet,
  listFacts,
  pruneStaleFacts,
  recentHistory,
  updateFact,
} from './db/history.js';
import { untrustedBlock } from './events.js';

// Two-tier memory (OpenClaw pattern):
//  - activeRecall: a cheap per-turn pass that returns either nothing or ONE
//    short memory note about the user, injected as untrusted context.
//  - dream: a nightly pass over the day's conversations that promotes durable
//    facts into SQLite, merges/archives, prunes never-recalled facts, and
//    keeps a human-readable dream diary.

const RECALL_SYSTEM = `You are a memory recall filter. Given the user's message and a numbered
list of stored facts, decide which facts (if any) genuinely help answer THIS message.
Reply ONLY with JSON: {"ids":[<fact ids>],"note":"<ONE note, max 220 chars, written as a
memory note about the user in third person>"} - or exactly NONE if no fact is relevant.
Most messages need NONE. Mutable operational facts (deploys, job status) must carry their
date in the note and be flagged as possibly stale.`;

const DREAM_SYSTEM = `You are consolidating a personal assistant's memory from one day of chat
history. Extract only DURABLE facts about the user: preferences, people, projects, tools,
recurring context. Never store secrets, credentials, one-off trivia, or anything the user did
once. Compare against the existing facts. Reply ONLY with JSON:
{"add":[{"fact":"...","category":"preference|person|project|context","confidence":0.0-1.0}],
 "update":[{"id":<existing fact id>,"fact":"<corrected wording>"}],
 "archive":[<ids of facts now wrong or obsolete>],
 "diary":"<2-3 sentence summary of the day>"}
Add only facts with confidence >= 0.7. Empty arrays are the normal case.`;

const RECALL_TIMEOUT_MS = 20_000;
const recallCache = new Map<string, { note: string | null; ts: number }>();
let consecutiveFailures = 0;
let breakerOpenUntil = 0;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('recall timeout')), ms)),
  ]);
}

export async function activeRecall(question: string): Promise<string | null> {
  if (!config.memoryEnabled || Date.now() < breakerOpenUntil) return null;
  const facts = listFacts();
  if (!facts.length) return null;

  const key = crypto.createHash('sha1').update(question).digest('hex');
  const cached = recallCache.get(key);
  if (cached && Date.now() - cached.ts < 5 * 60_000) return cached.note;

  try {
    const factList = facts.map((f) => `${f.id}: ${f.fact}`).join('\n');
    const raw = await withTimeout(
      liteQuery(`User message:\n${question.slice(0, 1000)}\n\nFacts:\n${factList}`, RECALL_SYSTEM, config.commitmentsModel),
      RECALL_TIMEOUT_MS,
    );
    consecutiveFailures = 0;
    let note: string | null = null;
    const match = raw.match(/\{[\s\S]*\}/);
    if (match && !raw.trim().startsWith('NONE')) {
      const parsed = JSON.parse(match[0]) as { ids?: number[]; note?: string };
      if (parsed.note?.trim()) {
        note = parsed.note.trim().slice(0, 300);
        bumpRecalls((parsed.ids ?? []).filter((id) => Number.isInteger(id)));
      }
    }
    recallCache.set(key, { note, ts: Date.now() });
    if (recallCache.size > 200) recallCache.delete(recallCache.keys().next().value!);
    return note;
  } catch (error) {
    if (++consecutiveFailures >= 3) {
      breakerOpenUntil = Date.now() + 10 * 60_000; // cool down 10 minutes
      consecutiveFailures = 0;
      console.warn('[memory] recall circuit breaker opened:', error);
    }
    return null;
  }
}

export function recallBlock(note: string | null): string {
  return note ? '\n\n' + untrustedBlock('memory', note) : '';
}

export async function dream(): Promise<string> {
  const since = kvGet('dream:since') ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  kvSet('dream:since', new Date().toISOString());

  const rows = recentHistory(since);
  const pruned = pruneStaleFacts();
  if (rows.length < 2) return `nothing to dream about (${rows.length} exchanges, pruned ${pruned})`;

  const transcript = rows
    .map((row) => `[${row.command}] user: ${row.input.slice(0, 300)}\nassistant: ${row.output.slice(0, 300)}`)
    .join('\n---\n')
    .slice(0, 9000);
  const existing = listFacts().map((f) => `${f.id}: ${f.fact}`).join('\n') || '(none)';

  const raw = await liteQuery(
    `Existing facts:\n${existing}\n\nToday's conversations:\n${transcript}`,
    DREAM_SYSTEM,
  );
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return 'dream produced no valid output';
  const ops = JSON.parse(match[0]) as {
    add?: Array<{ fact: string; category?: string; confidence?: number }>;
    update?: Array<{ id: number; fact: string }>;
    archive?: number[];
    diary?: string;
  };

  let added = 0;
  for (const item of ops.add ?? []) {
    if (item.fact && (item.confidence ?? 0) >= 0.7) {
      if (insertFact(item.fact, item.category ?? 'general', item.confidence ?? 0.7)) added++;
    }
  }
  for (const item of ops.update ?? []) if (item.id && item.fact) updateFact(item.id, item.fact);
  archiveFacts((ops.archive ?? []).filter((id) => Number.isInteger(id)));
  const today = new Date().toISOString().slice(0, 10);
  if (ops.diary) appendDiary(today, ops.diary);

  const summary = `dreamed over ${rows.length} exchanges: +${added} facts, ~${ops.update?.length ?? 0} updated, ${ops.archive?.length ?? 0} archived, ${pruned} pruned`;
  console.log(`[memory] ${summary}`);
  return summary;
}
