import { spawn } from 'node:child_process';
import path from 'node:path';
import { config } from './config.js';

// Persistent Meross garage service: spawn garage_server.py once (reuses the saved
// cloud token, holds MQTT) and talk to it over localhost. Supervise + restart.

let started = false;

export function startGarageService(): void {
  if (started || !config.garageEnabled) return;
  started = true;
  const launch = (): void => {
    const child = spawn('uv', ['run', '--no-project', config.garageServer], {
      cwd: path.dirname(config.garageServer),
      env: {
        ...process.env,
        PATH: `/usr/local/bin:${process.env.PATH ?? ''}`,
        UV_CACHE_DIR: process.env.UV_CACHE_DIR ?? '/app/data/uv-cache',
        UV_PYTHON_INSTALL_DIR: process.env.UV_PYTHON_INSTALL_DIR ?? '/app/data/uv-python',
        GARAGE_PORT: String(config.garagePort),
      },
    });
    child.stdout?.on('data', (d) => console.log(`[garage] ${String(d).trim()}`));
    child.stderr?.on('data', (d) => {
      const s = String(d).trim();
      if (s) console.log(`[garage] ${s.slice(0, 200)}`);
    });
    child.on('exit', (code) => {
      console.error(`[garage] exited (${code}); restarting in 20s`);
      setTimeout(launch, 20_000);
    });
  };
  console.log('[garage] starting Meross garage service…');
  launch();
}

async function call(pathname: string, init?: RequestInit): Promise<any | null> {
  try {
    const r = await fetch(`http://127.0.0.1:${config.garagePort}${pathname}`, {
      signal: AbortSignal.timeout(35_000),
      ...init,
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function garageStatus(): Promise<any | null> {
  return call('/status');
}
export async function garageCommand(action: 'open' | 'close'): Promise<any | null> {
  return call(`/${action}`, { method: 'POST' });
}
