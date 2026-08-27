import { ActivityType, type Client, type Message } from 'discord.js';

// MrRoboto's "brain" (the Claude Code backend) can be unavailable for reasons a
// Discord restart won't fix — the shared login expired, or the account hit its
// usage/session limit. This module turns those failures into a visible signal:
//   - the bot's Discord PRESENCE (the status dot + activity text next to its name)
//   - a clear, specific reply instead of "Dev session failed. Check the logs."
// so you can tell at a glance whether it can actually think, and why not.

export type ClaudeHealth =
  | { kind: 'ok' }
  | { kind: 'session_limit'; resetsAt?: string }
  | { kind: 'not_logged_in' }
  | { kind: 'overloaded' }
  | { kind: 'other'; detail: string };

let current: ClaudeHealth = { kind: 'ok' };
let client: Client | undefined;

export function bindHealthClient(c: Client): void {
  client = c;
}

/** Map a raw Claude/SDK error into a health state. */
export function classifyClaudeError(error: unknown): ClaudeHealth {
  const msg = (error instanceof Error ? error.message : String(error ?? '')).toLowerCase();
  if (msg.includes('session limit') || msg.includes('usage limit') || msg.includes('rate limit')) {
    const m = /resets?\s+([0-9]{1,2}(:[0-9]{2})?\s*(am|pm)?[^.\n]*)/i.exec(
      error instanceof Error ? error.message : String(error),
    );
    return { kind: 'session_limit', resetsAt: m?.[1]?.trim() };
  }
  if (msg.includes('not logged in') || msg.includes('please run /login') || msg.includes('unauthorized') || msg.includes('invalid api key')) {
    return { kind: 'not_logged_in' };
  }
  if (msg.includes('overloaded') || msg.includes('529')) return { kind: 'overloaded' };
  return { kind: 'other', detail: (error instanceof Error ? error.message : String(error)).slice(0, 140) };
}

function presenceFor(h: ClaudeHealth): { status: 'online' | 'dnd' | 'idle'; text: string; type: ActivityType } {
  switch (h.kind) {
    case 'ok':
      return { status: 'online', text: 'your life 🤖', type: ActivityType.Watching };
    case 'session_limit':
      return { status: 'dnd', text: `⛔ Claude limit — resets ${h.resetsAt ?? 'soon'}`, type: ActivityType.Playing };
    case 'not_logged_in':
      return { status: 'dnd', text: '⛔ Claude login expired — needs /login', type: ActivityType.Playing };
    case 'overloaded':
      return { status: 'idle', text: '⏳ Claude overloaded — retrying', type: ActivityType.Playing };
    default:
      return { status: 'idle', text: '⚠️ brain error — see logs', type: ActivityType.Playing };
  }
}

/** Update the bot's Discord presence to reflect Claude health (no-op if unchanged). */
export function setClaudeHealth(h: ClaudeHealth): void {
  const changed = JSON.stringify(h) !== JSON.stringify(current);
  current = h;
  if (!client?.user) return;
  const p = presenceFor(h);
  client.user.setPresence({ status: p.status, activities: [{ name: p.text, type: p.type }] });
  if (changed && h.kind !== 'ok') console.warn(`[health] Claude unavailable: ${h.kind}`);
  if (changed && h.kind === 'ok') console.log('[health] Claude back to healthy');
}

/** Call after any successful Claude call — flips the indicator back to green. */
export function markClaudeOk(): void {
  if (current.kind !== 'ok') setClaudeHealth({ kind: 'ok' });
}

export function getClaudeHealth(): ClaudeHealth {
  return current;
}

/** A user-facing, specific explanation for a failed Claude call. */
export function healthReply(h: ClaudeHealth): string {
  switch (h.kind) {
    case 'session_limit':
      return `⛔ **Claude usage limit reached** — I'm back to full power when it resets${h.resetsAt ? ` **${h.resetsAt}**` : ' shortly'}. (My Discord side is still up; I just can't run tasks until then.)`;
    case 'not_logged_in':
      return `⛔ **Claude login expired** — Mike needs to re-run \`/login\` on the host, then restart me. (Discord side is fine.)`;
    case 'overloaded':
      return `⏳ **Claude is overloaded right now** — give it a moment and try again.`;
    default:
      return `⚠️ **That failed** — ${h.kind === 'other' ? h.detail : 'unknown error'}. Send \`!reset\` or check the logs.`;
  }
}

/** Post a one-off notice to a channel about the current health issue (best effort). */
export async function notifyHealthIssue(message: Message, h: ClaudeHealth): Promise<void> {
  await message.reply(healthReply(h)).catch(() => {});
}
