import { liteQuery } from './ai/claudeCode.js';
import { config } from './config.js';
import { insertCommitment } from './db/history.js';

// Inferred-commitments ledger (OpenClaw pattern): after a chat turn, a cheap
// hidden model pass extracts implied follow-ups ("interview Tuesday", "waiting
// on the quote") into SQLite. Exact reminders belong to explicit asks; this is
// the low-confidence ledger delivered later by the proactive tick.

const EXTRACTION_SYSTEM = `You extract implied follow-up commitments from a chat exchange.
Return ONLY a JSON array (no prose, no fences). Each item:
{"kind":"event_check_in"|"deadline_check"|"care_check_in"|"open_loop",
 "dueEarliest":"<ISO datetime>","dueLatest":"<ISO datetime>",
 "confidence":0.0-1.0,"dedupeKey":"<stable-slug e.g. interview:2026-07-10>",
 "suggestedText":"<one short natural check-in question>"}
Rules:
- Only include follow-ups a thoughtful assistant would genuinely check in about later:
  events happening at a known time (event_check_in), deadlines (deadline_check),
  wellbeing situations like illness or stress (care_check_in), or things the user is
  waiting on (open_loop).
- Skip small talk, completed items, hypotheticals, and anything the user asked to be
  reminded about explicitly (that is a reminder, not an inferred commitment).
- due windows: after the event/deadline has likely happened; timezone ${process.env.TZ ?? 'UTC'}.
- Return [] when there is nothing. Most exchanges have nothing.`;

const CONFIDENCE_THRESHOLD = 0.6;
const CARE_CONFIDENCE_THRESHOLD = 0.75;
const MIN_LEAD_MS = 10 * 60 * 1000; // never due in the same moment it was inferred

interface Extracted {
  kind: string;
  dueEarliest: string;
  dueLatest: string;
  confidence: number;
  dedupeKey: string;
  suggestedText: string;
}

const pending = new Map<string, { user: string; assistant: string }>();
const timers = new Map<string, NodeJS.Timeout>();

/** Debounced per-channel: only the latest exchange in a burst gets extracted. */
export function scheduleExtraction(channelId: string, user: string, assistant: string): void {
  if (!config.commitmentsEnabled) return;
  pending.set(channelId, { user: user.slice(0, 2000), assistant: assistant.slice(0, 2000) });
  clearTimeout(timers.get(channelId));
  timers.set(
    channelId,
    setTimeout(() => {
      const exchange = pending.get(channelId);
      pending.delete(channelId);
      timers.delete(channelId);
      if (exchange) void extract(channelId, exchange).catch((error) => {
        console.warn('[commitments] extraction failed:', error);
      });
    }, 8000),
  );
}

async function extract(channelId: string, exchange: { user: string; assistant: string }): Promise<void> {
  const raw = await liteQuery(
    `Current time: ${new Date().toISOString()}\n\nUser: ${exchange.user}\n\nAssistant: ${exchange.assistant}`,
    EXTRACTION_SYSTEM,
    config.commitmentsModel,
  );
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return;
  let items: Extracted[];
  try {
    items = JSON.parse(match[0]) as Extracted[];
  } catch {
    return;
  }
  const now = Date.now();
  for (const item of items) {
    if (!item?.dedupeKey || !item.suggestedText) continue;
    const threshold = item.kind === 'care_check_in' ? CARE_CONFIDENCE_THRESHOLD : CONFIDENCE_THRESHOLD;
    if (!(item.confidence >= threshold)) continue;
    const earliest = Math.max(Date.parse(item.dueEarliest) || 0, now + MIN_LEAD_MS);
    const latest = Math.max(Date.parse(item.dueLatest) || 0, earliest + 60 * 60 * 1000);
    const inserted = insertCommitment({
      channel_id: channelId,
      kind: item.kind,
      dedupe_key: item.dedupeKey.slice(0, 200),
      due_earliest: earliest,
      due_latest: latest,
      confidence: item.confidence,
      suggested_text: item.suggestedText.slice(0, 500),
    });
    if (inserted) {
      console.log(`[commitments] noted ${item.kind} "${item.dedupeKey}" due ${new Date(earliest).toISOString()}`);
    }
  }
}
