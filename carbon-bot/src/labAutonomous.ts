import path from 'node:path';
import { type Client, type TextChannel } from 'discord.js';
import { devChat } from './dev.js';
import { getGoal, runGate, saveGoal, type LabGoal } from './labGoal.js';
import { LAB_PROJECTS_DIR } from './projectFactory.js';

// One bounded autonomous turn for a lab project's goal. Called by the inngest
// lab-iterate function (concurrency 1 per slug). Everything is guarded on the
// goal's own state + budget, so a duplicate dispatch or a post-completion tick
// is a safe no-op.

export interface IterationResult {
  status: GoalStatus | 'none';
  note: string;
}
type GoalStatus = LabGoal['status'];

async function post(client: Client | undefined, channelId: string, content: string): Promise<void> {
  if (!client) return;
  const ch = client.channels.cache.get(channelId) as TextChannel | undefined;
  if (ch && 'send' in ch) {
    await ch.send({ content: content.slice(0, 1900), allowedMentions: { parse: [] } }).catch(() => {});
  }
}

export async function runAutonomousIteration(slug: string, client?: Client): Promise<IterationResult> {
  const goal = getGoal(slug);
  if (!goal || goal.status !== 'active') return { status: goal?.status ?? 'none', note: 'not active' };

  // Budget gate (checked before spending a turn).
  const elapsedMin = (Date.now() - goal.startedAt) / 60000;
  if (goal.iterations >= goal.maxIterations || elapsedMin >= goal.maxMinutes) {
    goal.status = 'budget';
    const note = `budget reached (${goal.iterations}/${goal.maxIterations} turns, ${elapsedMin.toFixed(0)}/${goal.maxMinutes} min)`;
    goal.history.push({ at: Date.now(), note });
    saveGoal(goal);
    await post(client, goal.channelId, `⛔ **${slug}** — ${note}. Paused. Raise the budget and re-run \`set_goal\` to continue.`);
    return { status: 'budget', note };
  }

  const repoPath = path.join(LAB_PROJECTS_DIR, slug);
  const n = goal.iterations + 1;
  const prompt =
    `AUTONOMOUS BUILD — turn ${n}/${goal.maxIterations}. No human is replying this turn; keep making real progress.\n\n` +
    `OBJECTIVE: ${goal.goal}\n\n` +
    `Work toward the objective in this repo now: write and FIX code, and actually run it. ` +
    (goal.gate ? `The quality gate is \`${goal.gate}\` and it must pass for completion. ` : '') +
    `When the objective is genuinely met${goal.gate ? ' and the gate passes' : ''}, end your reply with the token GOAL_COMPLETE on its own line. ` +
    `If you are truly blocked and need a human, end with GOAL_BLOCKED and say why. Otherwise just keep working - do not stop to ask. ` +
    `Commit your progress. Never push to remotes. Keep this reply under 1200 characters.` +
    (goal.lastSummary ? `\n\nWHERE YOU LEFT OFF:\n${goal.lastSummary}` : '');

  let reply = '';
  try {
    const res = await devChat(goal.channelId, repoPath, prompt, undefined, true);
    reply = res.text || '';
  } catch (e) {
    goal.iterations = n;
    const note = `turn ${n} errored: ${(e as Error).message?.slice(0, 160)}`;
    goal.history.push({ at: Date.now(), note });
    saveGoal(goal);
    await post(client, goal.channelId, `⚠️ **${slug}** — ${note}`);
    return { status: 'active', note };
  }

  goal.iterations = n;
  goal.lastSummary = reply.slice(0, 700);

  const claimedComplete = /(^|\n)\s*GOAL_COMPLETE\b/.test(reply);
  const blocked = /(^|\n)\s*GOAL_BLOCKED\b/.test(reply);

  // Only pay for the gate when the agent claims completion.
  let gatePass = true;
  let gateOut = '';
  if (goal.gate && claimedComplete) {
    const g = await runGate(slug, goal.gate);
    gatePass = g.ok;
    gateOut = g.out;
  }

  let status: GoalStatus = 'active';
  let note = '';
  if (blocked) { status = 'failed'; note = 'blocked - needs you'; }
  else if (claimedComplete && gatePass) { status = 'done'; note = `goal complete${goal.gate ? ` (gate \`${goal.gate}\` green)` : ''} in ${n} turns`; }
  else if (claimedComplete && !gatePass) { note = `claimed done but gate failed - continuing. gate tail: ${gateOut.slice(0, 160)}`; }
  else { note = `turn ${n}/${goal.maxIterations} done`; }

  goal.status = status;
  goal.history.push({ at: Date.now(), note });
  saveGoal(goal);

  const icon = status === 'done' ? '✅' : status === 'failed' ? '🚧' : '🤖';
  const clean = reply.replace(/GOAL_(COMPLETE|BLOCKED)/g, '').trim();
  await post(client, goal.channelId, `${icon} **${slug}** ${note}\n${clean}`.slice(0, 1900));
  return { status, note };
}
