import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { summarizeStats } from './houseStats.js';

// Query the house stats CSV (weather/solar/pool/air/garage/vac/network trends).
export const statsMcpServer = createSdkMcpServer({
  name: 'housestats',
  version: '1.0.0',
  tools: [
    tool(
      'house_stats',
      'Trends/stats across all house topics (weather, solar, pool, air, garage, vacuum, network) over the last N days from the logged CSV.',
      { days: z.number().optional().describe('window in days (default 7)') },
      async (args) => ({ content: [{ type: 'text' as const, text: summarizeStats(args.days ?? 7) }] }),
    ),
  ],
});
