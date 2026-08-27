import { spawn } from 'node:child_process';
import path from 'node:path';
import { config } from './config.js';

// Persistent YOLO detector: spawn detect_server.py once (model loaded on the GPU)
// and talk to it over localhost, so detections are inference-only (~tens of ms)
// instead of paying process+torch+model startup (~3s) per frame. If the service
// isn't up yet (still loading) or dies, callers fall back to the CLI detect.py.

interface DetectResult {
  ok: boolean;
  annotated?: string;
  summary?: string;
  labels?: string[];
  device?: string;
  error?: string;
}

let started = false;

export function startDetectorService(): void {
  if (started) return;
  if (!config.reolinkEnabled || !config.reolinkYolo || !config.reolinkDetectService) return;
  started = true;

  const launch = (): void => {
    const child = spawn('uv', ['run', '--no-project', config.reolinkDetectServer], {
      cwd: path.dirname(config.reolinkDetectServer),
      env: {
        ...process.env,
        PATH: `/usr/local/bin:${process.env.PATH ?? ''}`,
        UV_CACHE_DIR: process.env.UV_CACHE_DIR ?? '/app/data/uv-cache',
        UV_PYTHON_INSTALL_DIR: process.env.UV_PYTHON_INSTALL_DIR ?? '/app/data/uv-python',
        YOLO_CONFIG_DIR: '/app/data/ultralytics',
        YOLO_WEIGHTS: config.reolinkYoloWeights,
        DETECT_PORT: String(config.reolinkDetectPort),
      },
    });
    child.stdout?.on('data', (d) => console.log(`[reolink-detector] ${String(d).trim()}`));
    child.stderr?.on('data', (d) => {
      const s = String(d).trim();
      if (s) console.log(`[reolink-detector] ${s.slice(0, 200)}`);
    });
    child.on('exit', (code) => {
      console.error(`[reolink-detector] exited (${code}); restarting in 15s`);
      setTimeout(launch, 15_000);
    });
  };

  console.log('[reolink-detector] starting persistent GPU detector…');
  launch();
}

// POST an image path to the running detector. Returns null on any failure so the
// caller can fall back to the one-shot CLI.
export async function detectViaService(
  image: string,
  out: string,
  conf: string,
): Promise<DetectResult | null> {
  if (!config.reolinkDetectService) return null;
  try {
    const r = await fetch(`http://127.0.0.1:${config.reolinkDetectPort}/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, out, conf: Number(conf) }), // classes: server applies its env default
      signal: AbortSignal.timeout(60_000),
    });
    if (!r.ok) return null;
    return (await r.json()) as DetectResult;
  } catch {
    return null;
  }
}
