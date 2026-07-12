import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { config } from './config.js';

// In-process MCP server giving MrRoboto access to the WORK Microsoft 365
// account (config.workEmail) via the Azure AD app (client-credentials flow).
// Distinct from the personal Gmail/Calendar MCP — this is the work account.

let cached: { token: string; exp: number } | null = null;

async function graphToken(): Promise<string> {
  if (cached && Date.now() < cached.exp) return cached.token;
  const r = await fetch(`https://login.microsoftonline.com/${config.azureTenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.azureClientId ?? '',
      client_secret: config.azureClientSecret ?? '',
      grant_type: 'client_credentials',
      scope: 'https://graph.microsoft.com/.default',
    }),
  });
  const j = (await r.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!j.access_token) throw new Error(j.error_description ?? 'graph token failed');
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 - 60_000 };
  return j.access_token;
}

async function graphGet(pathAndQuery: string): Promise<any> {
  const tok = await graphToken();
  const r = await fetch(`https://graph.microsoft.com/v1.0${pathAndQuery}`, {
    headers: { Authorization: `Bearer ${tok}`, Prefer: 'outlook.timezone="E. Australia Standard Time"' },
  });
  const j = (await r.json()) as any;
  if (j.error) throw new Error(j.error.message ?? j.error.code ?? 'graph error');
  return j;
}

export const graphMcpServer = createSdkMcpServer({
  name: 'work',
  version: '1.0.0',
  tools: [
    tool(
      'work_calendar',
      `Read ${config.workEmail}'s WORK calendar (Microsoft 365). Use this for anything about the user's work meetings or schedule — it is a different account from the personal calendar.`,
      { days: z.number().optional().describe('days ahead from today to include; default 2 (today + tomorrow)') },
      async (args) => {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date(start.getTime() + (args.days ?? 2) * 86_400_000);
        const j = await graphGet(
          `/users/${config.workEmail}/calendarView?startDateTime=${start.toISOString()}&endDateTime=${end.toISOString()}&$select=subject,start,end,isAllDay,location&$orderby=start/dateTime&$top=40`,
        );
        const rows = (j.value ?? []).map((e: any) => {
          const d = (e.start?.dateTime ?? '').slice(0, 10);
          const when = e.isAllDay
            ? 'all day'
            : `${(e.start?.dateTime ?? '').slice(11, 16)}–${(e.end?.dateTime ?? '').slice(11, 16)}`;
          const loc = e.location?.displayName ? ` @ ${e.location.displayName}` : '';
          return `${d} ${when} — ${e.subject ?? '(no subject)'}${loc}`;
        });
        return { content: [{ type: 'text', text: rows.join('\n') || '(no work events in that window)' }] };
      },
    ),
    tool(
      'work_email',
      `Read recent email from ${config.workEmail}'s WORK inbox (Microsoft 365).`,
      {
        unread_only: z.boolean().optional().describe('only unread messages, default false'),
        count: z.number().optional().describe('how many to return, default 15'),
      },
      async (args) => {
        const filter = args.unread_only ? '&$filter=isRead eq false' : '';
        const j = await graphGet(
          `/users/${config.workEmail}/mailFolders/inbox/messages?$select=subject,from,receivedDateTime,importance,isRead${filter}&$orderby=receivedDateTime desc&$top=${args.count ?? 15}`,
        );
        const rows = (j.value ?? []).map((m: any) => {
          const when = (m.receivedDateTime ?? '').slice(0, 16).replace('T', ' ');
          const flag = m.importance === 'high' ? '🔴 ' : '';
          const unread = m.isRead ? '' : '• ';
          return `[${when}] ${flag}${unread}${m.from?.emailAddress?.name ?? '?'}: ${m.subject ?? '(no subject)'}`;
        });
        return { content: [{ type: 'text', text: rows.join('\n') || '(no messages)' }] };
      },
    ),
    tool(
      'work_send_email',
      `Send an email as ${config.workEmail} (work account). Confirm recipient and wording with the user first unless they gave exact text.`,
      { to: z.string().describe('recipient email address'), subject: z.string(), body: z.string() },
      async (args) => {
        const tok = await graphToken();
        const r = await fetch(`https://graph.microsoft.com/v1.0/users/${config.workEmail}/sendMail`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: {
              subject: args.subject,
              body: { contentType: 'Text', content: args.body },
              toRecipients: [{ emailAddress: { address: args.to } }],
            },
          }),
        });
        if (!r.ok) {
          const t = await r.text();
          return { content: [{ type: 'text', text: `send failed: ${t.slice(0, 200)}` }], isError: true };
        }
        return { content: [{ type: 'text', text: `sent to ${args.to}` }] };
      },
    ),
  ],
});
