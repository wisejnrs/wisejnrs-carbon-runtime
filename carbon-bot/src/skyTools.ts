import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { config } from './config.js';
import { formatSky, getSkyData } from './sky.js';

// Sky tool: weather + sun times + moon phase (astronomical). Solar (Fronius PV)
// will be merged into this report once the inverter is wired in.
export const skyMcpServer = createSdkMcpServer({
  name: 'sky',
  version: '1.0.0',
  tools: [
    tool(
      'sky_status',
      'Current sky + solar: weather (temp, wind, humidity), sun times (sunrise/sunset, daylight hours, UV, expected sunshine), moon phase, and live Fronius solar (PV now + energy today/year/lifetime). Defaults to the configured home location.',
      { location: z.string().optional().describe('place name; defaults to home') },
      async (args) => {
        try {
          const d = await getSkyData(args.location ?? config.skyLocation);
          if (!d) return { content: [{ type: 'text', text: `Couldn't find "${args.location}".` }], isError: true };
          return { content: [{ type: 'text', text: formatSky(d) }] };
        } catch (e) {
          return { content: [{ type: 'text', text: `Sky lookup failed: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
        }
      },
    ),
  ],
});
