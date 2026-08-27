import type { HookCallback } from '@anthropic-ai/claude-agent-sdk';
import { config } from './config.js';

// Bypass-resistant command guard for dev sessions / full-mode chat.
//
// MrRoboto runs the Agent SDK with `permissionMode: 'bypassPermissions'` and the
// built-in Bash tool, driven by whoever is in the Discord channel. This guard
// (inspired by Desktop Commander's command-manager) blocks a small set of
// genuinely destructive operations for NON-owners, while leaving normal dev work
// (git, npm, builds, editing/removing project files) completely untouched so
// non-owner collaborators aren't disrupted. Owners bypass it entirely.
//
// It defeats naive `split(' ')[0]` bypasses by extracting the base command out of
// every chained/substituted/subshelled segment, and also matches the raw string
// against destructive patterns (defence in depth).

// Base commands blocked outright for non-owners (privilege, disk, system, users, net).
const BLOCKED_BASE = new Set([
  'sudo', 'su', 'doas', 'pkexec',
  'shutdown', 'reboot', 'halt', 'poweroff', 'init', 'telinit', 'systemctl',
  'mkfs', 'fdisk', 'parted', 'wipefs', 'shred', 'blkdiscard', 'format', 'diskpart',
  'useradd', 'userdel', 'usermod', 'groupadd', 'passwd', 'visudo', 'chpasswd',
  'iptables', 'ip6tables', 'nft', 'ufw',
  'reg', 'bcdedit', 'mount', 'umount',
]);

// Destructive patterns matched against the whole command string.
const DANGER_PATTERNS: Array<{ re: RegExp; why: string }> = [
  { re: /\brm\s+(?:-\S+\s+)*-\S*[rf]\S*\s+(?:-\S+\s+)*(?:\/|~|\$HOME|\/\*|\*\s*$|\.\s*$)/i, why: 'rm -rf on / ~ or *' },
  { re: /\bdd\b[^|;&]*\bof=\/dev\//i, why: 'dd onto a block device' },
  { re: /\bchmod\s+-\S*R\S*\s+[0-7]{3,4}\s+\/(?!\S*(work|app|home|tmp))/i, why: 'recursive chmod on system root' },
  { re: /\bchown\s+-\S*R\S*\s+\S+\s+\/(?!\S*(work|app|home|tmp))/i, why: 'recursive chown on system root' },
  { re: /:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/, why: 'fork bomb' },
  { re: /\b(?:curl|wget)\b[^|;&]*\|\s*(?:sudo\s+)?(?:sh|bash|zsh|dash)\b/i, why: 'piping a remote script straight into a shell' },
  { re: /\bdocker\s+(?:system\s+prune|volume\s+rm|volume\s+prune|network\s+prune)\b/i, why: 'destructive docker cleanup' },
  { re: />\s*\/dev\/(?:sd|nvme|vd|hd|mmcblk)/i, why: 'writing to a raw block device' },
  { re: /\bgit\s+push\b[^;&|]*--force(?!-with-lease)/i, why: 'force-push (use --force-with-lease, or ask an owner)' },
];

// Split a command line into base commands, recursing into $(...), `...`, and
// (...) so chaining/substitution can't smuggle a blocked command past the check.
export function extractBaseCommands(commandString: string, depth = 0): string[] {
  if (depth > 5 || !commandString) return [];
  const results: string[] = [];
  let s = commandString;
  const subs: string[] = [];
  s = s.replace(/\$\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g, (_m, inner) => (subs.push(inner), ' '));
  s = s.replace(/`([^`]*)`/g, (_m, inner) => (subs.push(inner), ' '));
  s = s.replace(/\(([^()]+)\)/g, (_m, inner) => (subs.push(inner), ' '));
  for (const sub of subs) results.push(...extractBaseCommands(sub, depth + 1));

  for (let seg of s.split(/\|\||&&|[;\n|&]/)) {
    seg = seg.trim();
    if (!seg) continue;
    const tokens = seg.split(/\s+/);
    let i = 0;
    while (i < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[i])) i++; // skip VAR=val prefixes
    const raw = tokens[i];
    if (!raw) continue;
    results.push(raw.replace(/^.*[\\/]/, '').toLowerCase()); // strip any path prefix -> base name
  }
  return results;
}

/** Returns null if the command is allowed, or a human-readable reason if blocked. */
export function checkCommand(commandString: string): string | null {
  for (const base of extractBaseCommands(commandString)) {
    if (BLOCKED_BASE.has(base) || base.startsWith('mkfs')) return `"${base}" is a restricted command`;
  }
  for (const { re, why } of DANGER_PATTERNS) {
    if (re.test(commandString)) return why;
  }
  return null;
}

export function isOwner(userId: string | undefined | null): boolean {
  return !!userId && config.ownerUserIds.includes(userId);
}

// A PreToolUse hook that denies destructive Bash commands for non-owners. Runs
// even under bypassPermissions (that's why it's a hook, not canUseTool).
export function commandGuardHook(owner: boolean): HookCallback {
  return async (input) => {
    if (owner || input.hook_event_name !== 'PreToolUse') return { continue: true };
    const name = input.tool_name?.toLowerCase();
    if (name !== 'bash' && name !== 'shell') return { continue: true };
    const command = (input.tool_input as { command?: string } | undefined)?.command ?? '';
    const reason = checkCommand(command);
    if (!reason) return { continue: true };
    console.warn(`[guard] blocked command from non-owner (${reason}): ${command.slice(0, 140)}`);
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason:
          `Blocked by MrRoboto's safety guard: ${reason}. Normal dev commands are fine; ` +
          `if this is genuinely needed, ask Mike to run it.`,
      },
    };
  };
}
