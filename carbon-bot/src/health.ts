import http from 'node:http';
import type { Client } from 'discord.js';
import { config } from './config.js';
import { corpusCount } from './rag/index.js';
import { historyCount } from './db/history.js';

// Minimal web surface replacing the old Carbon.Bot.Web portal: /ping and /status.
export function startHealthServer(client: Client): http.Server {
  const startedAt = Date.now();
  const server = http.createServer(async (req, res) => {
    if (req.url === '/ping' || req.url === '/') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('pong');
      return;
    }
    if (req.url === '/status') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify(
          {
            bot: client.user?.tag ?? 'connecting',
            uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
            guilds: client.guilds.cache.size,
            provider: config.provider,
            model:
              config.provider === 'openai'
                ? config.openaiModel
                : config.provider === 'claude-code'
                  ? config.claudeCodeModel
                  : config.anthropicModel,
            corpusChunks: await corpusCount(),
            historyEntries: historyCount(),
          },
          null,
          2,
        ),
      );
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  });
  server.listen(config.healthPort, () => {
    console.log(`Health server on http://0.0.0.0:${config.healthPort} (/ping, /status)`);
  });
  return server;
}
