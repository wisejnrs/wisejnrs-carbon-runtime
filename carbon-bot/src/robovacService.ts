import { spawn } from 'node:child_process';
import path from 'node:path';
import { config } from './config.js';

// Persistent Ecovacs Deebot ("Cinderella") service: spawn robovac_server.py once
// (holds the MQTT connection + reuses the saved ~7-day credentials) and talk to
// it over localhost. Same supervise-and-restart pattern as the YOLO detector.

let started = false;

export function startRobovacService(): void {
  if (started || !config.robovacEnabled) return;
  started = true;
  const launch = (): void => {
    const child = spawn('uv', ['run', '--no-project', config.robovacServer], {
      cwd: path.dirname(config.robovacServer),
      env: {
        ...process.env,
        PATH: `/usr/local/bin:${process.env.PATH ?? ''}`,
        UV_CACHE_DIR: process.env.UV_CACHE_DIR ?? '/app/data/uv-cache',
        UV_PYTHON_INSTALL_DIR: process.env.UV_PYTHON_INSTALL_DIR ?? '/app/data/uv-python',
        ROBOVAC_PORT: String(config.robovacPort),
      },
    });
    child.stdout?.on('data', (d) => console.log(`[robovac] ${String(d).trim()}`));
    child.stderr?.on('data', (d) => {
      const s = String(d).trim();
      if (s) console.log(`[robovac] ${s.slice(0, 200)}`);
    });
    child.on('exit', (code) => {
      console.error(`[robovac] exited (${code}); restarting in 15s`);
      setTimeout(launch, 15_000);
    });
  };
  console.log('[robovac] starting Deebot service…');
  launch();
}

async function call(pathname: string, init?: RequestInit): Promise<any | null> {
  try {
    const r = await fetch(`http://127.0.0.1:${config.robovacPort}${pathname}`, {
      signal: AbortSignal.timeout(50_000),
      ...init,
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function robovacStatus(): Promise<any | null> {
  return call('/status');
}

export async function robovacCommand(body: Record<string, unknown>): Promise<any | null> {
  return call('/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
