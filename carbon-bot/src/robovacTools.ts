import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { getDiscordRequestContext } from './discordTools.js';
import { robovacCommand, robovacStatus } from './robovacService.js';

// Deebot "Cinderella" (N30 PRO OMNI) control for #project-house. Status is open;
// anything that actuates the vac (clean/dock/pause/…) is owner-gated.

function ok(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}
function fail(text: string) {
  return { content: [{ type: 'text' as const, text }], isError: true };
}
function ownerBlocked(what: string) {
  const ctx = getDiscordRequestContext();
  if (ctx.requesterId && !ctx.isOwner) return fail(`Only Mike can ${what}.`);
  return null;
}

function fmtStatus(s: any): string {
  if (!s) return 'Cinderella is unreachable right now (service starting or creds need re-verification).';
  const avail = s.available === false ? ' · 🔴 offline' : s.available ? ' · 🟢 online' : '';
  const lines = [
    `🧹 **${s.nick ?? 'Cinderella'}** — 🔋 ${s.battery ?? '?'}% · state: **${s.state ?? '?'}** · fan: ${s.fan ?? '?'}${avail}`,
  ];
  if (s.stats) lines.push(`🧭 last clean: ${s.stats}`);
  if (s.error) lines.push(`⚠️ ${s.error}`);
  const rooms = (s.rooms ?? []).map((r: any) => r.name).filter(Boolean);
  if (rooms.length) lines.push(`🚪 rooms: ${rooms.join(', ')}`);
  return lines.join('\n');
}

export const robovacMcpServer = createSdkMcpServer({
  name: 'robovac',
  version: '1.0.0',
  tools: [
    tool(
      'robovac_status',
      "Cinderella the Deebot's status: battery, state (cleaning/docked/…), fan speed, last-clean stats, and the list of mapped rooms.",
      {},
      async () => {
        try {
          return ok(fmtStatus(await robovacStatus()));
        } catch (e) {
          return fail(`Robovac status failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      },
    ),
    tool(
      'robovac_clean',
      "Start Cinderella cleaning. Omit rooms for a whole-house clean, or name one or more mapped rooms (e.g. Kitchen, Sarah's bedroom, Hallway). Optional fan speed. Owner-only.",
      {
        rooms: z.array(z.string()).optional().describe("room names to clean; omit for whole house"),
        fan: z.enum(['QUIET', 'NORMAL', 'MAX', 'MAX_PLUS']).optional(),
      },
      async (args) => {
        const blocked = ownerBlocked('run the vacuum');
        if (blocked) return blocked;
        const r = await robovacCommand({ action: 'clean', rooms: args.rooms, fan: args.fan });
        if (!r) return fail('No response from the robovac service.');
        if (!r.ok) return fail(`Couldn't start clean: ${r.error}`);
        const where = args.rooms?.length ? args.rooms.join(', ') : 'the whole house';
        return ok(`🧹 Cinderella is off to clean **${where}**${args.fan ? ` (fan ${args.fan})` : ''}.`);
      },
    ),
    tool(
      'robovac_control',
      'Control Cinderella: dock (return home), pause, resume, or stop the current job. Owner-only.',
      { action: z.enum(['dock', 'pause', 'resume', 'stop']) },
      async (args) => {
        const blocked = ownerBlocked('control the vacuum');
        if (blocked) return blocked;
        const r = await robovacCommand({ action: args.action });
        if (!r) return fail('No response from the robovac service.');
        if (!r.ok) return fail(`Couldn't ${args.action}: ${r.error}`);
        const verb = { dock: 'heading back to the dock', pause: 'paused', resume: 'resuming', stop: 'stopped' }[args.action];
        return ok(`🧹 Cinderella ${verb}.`);
      },
    ),
    tool(
      'robovac_fan',
      'Set Cinderella\'s suction/fan level (QUIET, NORMAL, MAX, MAX_PLUS). Owner-only.',
      { fan: z.enum(['QUIET', 'NORMAL', 'MAX', 'MAX_PLUS']) },
      async (args) => {
        const blocked = ownerBlocked('change the vacuum settings');
        if (blocked) return blocked;
        const r = await robovacCommand({ action: 'fan', fan: args.fan });
        if (!r) return fail('No response from the robovac service.');
        if (!r.ok) return fail(`Couldn't set fan: ${r.error}`);
        return ok(`🌀 Fan set to ${args.fan}.`);
      },
    ),
  ],
});
