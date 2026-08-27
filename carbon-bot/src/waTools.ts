import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { waMessagesFor, waRecentChats, waSearch } from './db/history.js';
import { sendWhatsApp, whatsappConnected } from './whatsapp.js';

// In-process MCP server giving MrRoboto's sessions real WhatsApp powers over
// the linked personal account: browse recent chats, read a conversation,
// full-text search, and send. Data comes from the local SQLite message store
// (populated live + from link-time history sync) - nothing leaves the host.

function fmt(rows: Array<{ jid: string; chat_name: string | null; sender: string | null; from_me: number; text: string; ts: number }>): string {
  if (!rows.length) return '(no messages stored yet - history builds up as messages arrive)';
  return rows
    .map((row) => {
      const when = new Date(row.ts).toISOString().replace('T', ' ').slice(0, 16);
      const who = row.from_me ? 'me' : (row.sender ?? row.chat_name ?? row.jid.split('@')[0]);
      const chat = row.chat_name ?? row.jid.split('@')[0];
      return `[${when}] (${chat}) ${who}: ${row.text}`;
    })
    .join('\n');
}

export const whatsappMcpServer = createSdkMcpServer({
  name: 'whatsapp',
  version: '1.0.0',
  tools: [
    tool(
      'wa_recent_chats',
      'List recent WhatsApp chats (most recent message per chat). Use to see what conversations are active or what the user may have missed.',
      { limit: z.number().optional().describe('max chats, default 20') },
      async (args) => {
        const rows = waRecentChats(args.limit ?? 20);
        const text = rows.length
          ? rows
              .map((row) => {
                const when = new Date(row.ts).toISOString().replace('T', ' ').slice(0, 16);
                const chat = row.chat_name ?? row.jid.split('@')[0];
                return `${chat} (${row.messages} msgs, last ${when}): ${row.from_me ? 'me: ' : ''}${row.text.slice(0, 120)}`;
              })
              .join('\n')
          : '(no chats stored yet)';
        return { content: [{ type: 'text', text }] };
      },
    ),
    tool(
      'wa_messages',
      'Read recent messages in one WhatsApp chat. chat = phone number, name, or jid.',
      {
        chat: z.string().describe('phone number, contact/group name, or jid'),
        limit: z.number().optional().describe('max messages, default 40'),
      },
      async (args) => ({
        content: [{ type: 'text', text: fmt(waMessagesFor(args.chat, args.limit ?? 40).reverse()) }],
      }),
    ),
    tool(
      'wa_search',
      'Full-text search across all stored WhatsApp messages.',
      { query: z.string().describe('text to search for') },
      async (args) => ({
        content: [{ type: 'text', text: fmt(waSearch(args.query).reverse()) }],
      }),
    ),
    tool(
      'wa_send',
      'Send a WhatsApp message from the user\'s account, to a person OR a group. Confirm wording with the user before sending unless they gave the exact text.',
      {
        to: z.string().describe('phone number (+61... or 04...), a group name (e.g. "Blade AI"), or a jid (...@g.us / ...@s.whatsapp.net)'),
        text: z.string().describe('the message'),
      },
      async (args) => {
        if (!whatsappConnected()) {
          return { content: [{ type: 'text', text: 'WhatsApp is not connected.' }], isError: true };
        }
        try {
          const recipient = await sendWhatsApp(args.to, args.text);
          return { content: [{ type: 'text', text: `sent to ${recipient}` }] };
        } catch (error) {
          return {
            content: [{ type: 'text', text: `send failed: ${error instanceof Error ? error.message : error}` }],
            isError: true,
          };
        }
      },
    ),
  ],
});
