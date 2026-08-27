import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { getDiscordRequestContext } from './discordTools.js';
import { garageCommand, garageStatus } from './garageService.js';

// Meross garage door control for #project-house. Status open; open/close are
// owner-gated (it's a physical security device).

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

export const garageMcpServer = createSdkMcpServer({
  name: 'garage',
  version: '1.0.0',
  tools: [
    tool(
      'garage_status',
      'Is the garage door open or closed? (Meross Smart Garage Door Opener.)',
      {},
      async () => {
        const s = await garageStatus();
        if (!s) return fail('Garage unreachable (service starting or offline).');
        if (!s.ok) return fail(`Garage error: ${s.error}`);
        return ok(`🚪 Garage is **${s.open ? 'OPEN' : 'closed'}** (${s.online})`);
      },
    ),
    tool(
      'garage_open',
      'Open the garage door. Owner-only (physical security device).',
      {},
      async () => {
        const blocked = ownerBlocked('open the garage');
        if (blocked) return blocked;
        const r = await garageCommand('open');
        if (!r) return fail('No response from the garage service.');
        if (!r.ok) return fail(`Couldn't open: ${r.error}`);
        return ok('🚪 Opening the garage…');
      },
    ),
    tool(
      'garage_close',
      'Close the garage door. Owner-only.',
      {},
      async () => {
        const blocked = ownerBlocked('close the garage');
        if (blocked) return blocked;
        const r = await garageCommand('close');
        if (!r) return fail('No response from the garage service.');
        if (!r.ok) return fail(`Couldn't close: ${r.error}`);
        return ok('🚪 Closing the garage…');
      },
    ),
  ],
});
