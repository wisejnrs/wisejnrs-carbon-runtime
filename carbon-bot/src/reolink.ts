import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { AttachmentBuilder, type Client, type TextChannel } from 'discord.js';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { config } from './config.js';
import { detectViaService } from './reolinkDetector.js';

const pexec = promisify(execFile);

// Reolink detection loop: cameras push a snapshot (+clip) on AI/motion detection
// via FTP into a NAS drop folder (mounted here as config.reolinkDropDir). Once a
// minute we pick up any NEW snapshot, ask Claude (vision) what's in it, and post
// the image + one-line "what" to #project-house. No polling of the cameras, no
// archive management — just the detection loop.

const IMG = new Set(['.jpg', '.jpeg', '.png']);
const MAX_ATTACH = 9 * 1024 * 1024; // Discord non-boost limit
const SETTLE_MS = 15_000; // skip files still being uploaded (mtime too fresh)
const SEEN_KEEP = 500; // bounded de-dupe memory

interface State {
  lastTs: number;
  seen: string[];
  cooldown: Record<string, number>; // per-camera last-post epoch ms (debounce)
}

function stateFile(): string {
  return path.join(config.dataDir, 'reolink-state.json');
}

function loadState(): State {
  try {
    const s = JSON.parse(fs.readFileSync(stateFile(), 'utf8')) as State;
    return {
      lastTs: s.lastTs ?? 0,
      seen: Array.isArray(s.seen) ? s.seen : [],
      cooldown: s.cooldown && typeof s.cooldown === 'object' ? s.cooldown : {},
    };
  } catch {
    // First run: start from "now" so we don't backfill a pile of old snapshots.
    return { lastTs: Date.now(), seen: [], cooldown: {} };
  }
}

function saveState(s: State): void {
  try {
    fs.mkdirSync(config.dataDir, { recursive: true });
    fs.writeFileSync(
      stateFile(),
      JSON.stringify({ lastTs: s.lastTs, seen: s.seen.slice(-SEEN_KEEP), cooldown: s.cooldown }),
    );
  } catch {
    // non-fatal
  }
}

function walkImages(dir: string, out: string[] = [], depth = 0): string[] {
  if (depth > 6 || out.length >= 200) return out;
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith('@') || e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkImages(full, out, depth + 1);
    else if (IMG.has(path.extname(e.name).toLowerCase())) out.push(full);
  }
  return out;
}

interface Source {
  dir: string;
  mode: 'folder' | 'ss';
}

// Camera name per source:
//  - 'folder' (Reolink FTP): first path segment under the drop dir (folder-per-camera).
//  - 'ss' (Surveillance Station @PushServ): parse camId from ss_push_<ts>_<camId>_<ts>_1.jpg
//    and map it to a friendly name.
function cameraName(src: Source, file: string): string {
  if (src.mode === 'ss') {
    // ss_push_<ts>_<camId>_<ts>_<n>.jpg  → camId is field index 3
    const parts = path.basename(file).split('_');
    const camId = parts[0] === 'ss' && parts[1] === 'push' ? parts[3] : undefined;
    return (camId && config.reolinkSsCameraMap[camId]) || (camId ? `SS cam ${camId}` : 'SS camera');
  }
  const rel = path.relative(src.dir, file);
  const seg = rel.split(path.sep)[0];
  if (seg && seg !== path.basename(file)) return seg;
  const base = path.basename(file, path.extname(file));
  return base.split('_')[0] || 'camera';
}

async function caption(imagePath: string): Promise<string> {
  const prompt =
    `A home-security camera just captured this snapshot: ${imagePath}\n` +
    'View it with the Read tool, then reply with ONE short sentence describing who or ' +
    'what is visible and any notable activity (e.g. "A person in dark clothing is at the ' +
    'front door", "A car is reversing out of the driveway", "Empty driveway, tree moving ' +
    'in wind"). No preamble, no markdown, just the sentence.';
  let out = '';
  try {
    for await (const m of query({
      prompt,
      options: {
        model: config.reolinkVisionModel === 'default' ? undefined : config.reolinkVisionModel,
        cwd: path.dirname(imagePath),
        permissionMode: 'bypassPermissions',
        settingSources: [],
        tools: ['Read'],
        maxTurns: 3,
      },
    })) {
      if (m.type === 'result') out = m.subtype === 'success' ? m.result : '';
    }
  } catch {
    return 'Motion detected (couldn’t auto-describe the snapshot).';
  }
  return out.trim().replace(/\s+/g, ' ').slice(0, 400) || 'Motion detected (no description).';
}

interface YoloResult {
  ok: boolean;
  annotated?: string;
  summary?: string;
  labels?: string[];
  error?: string;
}

// Run YOLO (ultralytics) via the self-contained uv script: draws labelled boxes
// on an annotated copy and returns the object summary. uv provisions its own env
// (cached in /app/data). Best-effort — returns null on any failure.
async function runYolo(imagePath: string): Promise<YoloResult | null> {
  // Write the annotated (boxed) copy to a writable temp dir — the source folder
  // may be read-only (e.g. the Surveillance Station mount), which would silently
  // drop the boxes and post the raw frame.
  const ext = path.extname(imagePath) || '.jpg';
  const out = path.join(os.tmpdir(), `${path.basename(imagePath, ext)}_yolo${ext}`);
  // Fast path: the persistent GPU service (falls through to the CLI if it's down).
  const viaSvc = await detectViaService(imagePath, out, config.reolinkYoloConf);
  if (viaSvc?.ok) return viaSvc;
  try {
    const { stdout } = await pexec(
      'uv',
      ['run', '--no-project', config.reolinkYoloScript, imagePath, out, `--conf=${config.reolinkYoloConf}`],
      {
        cwd: path.dirname(config.reolinkYoloScript),
        timeout: 180_000,
        maxBuffer: 8 * 1024 * 1024,
        env: {
          ...process.env,
          PATH: `/usr/local/bin:${process.env.PATH ?? ''}`,
          UV_CACHE_DIR: process.env.UV_CACHE_DIR ?? '/app/data/uv-cache',
          UV_PYTHON_INSTALL_DIR: process.env.UV_PYTHON_INSTALL_DIR ?? '/app/data/uv-python',
          YOLO_WEIGHTS: config.reolinkYoloWeights,
          YOLO_CONFIG_DIR: '/app/data/ultralytics', // writable settings dir
        },
      },
    );
    const line = stdout.trim().split('\n').filter(Boolean).pop() ?? '{}';
    return JSON.parse(line) as YoloResult;
  } catch {
    return null;
  }
}

function siblingClip(imagePath: string): string | undefined {
  const mp4 = imagePath.replace(/\.(jpg|jpeg|png)$/i, '.mp4');
  try {
    if (mp4 !== imagePath && fs.statSync(mp4).size <= MAX_ATTACH) return mp4;
  } catch {
    /* no clip */
  }
  return undefined;
}

// One tick of the detection loop. Safe no-op if disabled / drop dir missing /
// channel not ready. Returns how many detections it posted.
export async function scanReolink(client: Client): Promise<{ posted: number; skipped?: string }> {
  if (!config.reolinkEnabled) return { posted: 0, skipped: 'disabled' };
  const sources: Source[] = [];
  if (config.reolinkDropDir) sources.push({ dir: config.reolinkDropDir, mode: 'folder' });
  if (config.reolinkSsDir) sources.push({ dir: config.reolinkSsDir, mode: 'ss' });
  const live = sources.filter((s) => fs.existsSync(s.dir));
  if (live.length === 0) return { posted: 0, skipped: 'no source dir' };
  const channel = client.channels.cache.get(config.reolinkChannelId) as TextChannel | undefined;
  if (!channel || !('send' in channel)) return { posted: 0, skipped: 'channel not ready' };

  const state = loadState();
  const seen = new Set(state.seen);
  const cooldown = state.cooldown;
  const cooldownMs = config.reolinkCooldownSec * 1000;
  const now = Date.now();

  // Collect new frames across all sources, each tagged with its camera name.
  const fresh: { f: string; mtime: number; cam: string }[] = [];
  for (const src of live) {
    for (const f of walkImages(src.dir)) {
      let mtime = 0;
      try {
        mtime = fs.statSync(f).mtimeMs;
      } catch {
        continue;
      }
      if (mtime > state.lastTs && now - mtime > SETTLE_MS && !seen.has(f)) {
        fresh.push({ f, mtime, cam: cameraName(src, f) });
      }
    }
  }
  fresh.sort((a, b) => a.mtime - b.mtime);

  // Debounce: a motion event produces a burst of frames (+continued motion).
  // Group the tick's new frames per camera and act on just one per camera, and
  // only if that camera is past its cooldown — so we don't spam the channel or
  // waste a YOLO+Claude run on every frame of the same event.
  const byCam = new Map<string, { f: string; mtime: number }[]>();
  for (const item of fresh) {
    const arr = byCam.get(item.cam);
    if (arr) arr.push(item);
    else byCam.set(item.cam, [item]);
  }

  let posted = 0;
  let maxTs = state.lastTs;
  const markSeen = (items: { f: string; mtime: number }[]) => {
    for (const it of items) {
      seen.add(it.f);
      if (it.mtime > maxTs) maxTs = it.mtime;
    }
  };

  for (const [cam, items] of byCam) {
    items.sort((a, b) => a.mtime - b.mtime);
    // Within cooldown → collapse the whole burst silently (mark seen, no work).
    if (now - (cooldown[cam] ?? 0) < cooldownMs) {
      markSeen(items);
      continue;
    }
    if (posted >= config.reolinkMaxPerTick) break; // safety cap per tick
    const chosen = items[items.length - 1]; // newest frame of the burst
    const when = new Date(chosen.mtime).toLocaleString('en-AU', {
      timeZone: process.env.TZ || 'Australia/Brisbane',
    });

    // YOLO: draw labelled boxes + object summary; post the annotated frame.
    const yolo = config.reolinkYolo ? await runYolo(chosen.f) : null;

    // Suppress false triggers (auto white-balance / exposure / lighting shifts
    // that trip the camera's motion but contain no real object). Only post when
    // YOLO actually found a security-relevant object. Fail-open if YOLO couldn't
    // run, so we never silently drop events during a YOLO outage.
    if (config.reolinkRequireDetection && config.reolinkYolo && yolo?.ok && !(yolo.labels && yolo.labels.length)) {
      markSeen(items); // mark seen but DON'T start cooldown — a real detection moments later still alerts
      continue;
    }

    const imageToPost =
      yolo?.ok && yolo.annotated && fs.existsSync(yolo.annotated) ? yolo.annotated : chosen.f;
    // Optional Claude one-line natural description.
    const cap = config.reolinkCaption ? await caption(chosen.f) : '';

    const lines = [`📸 **${cam}** · ${when}`];
    if (yolo?.ok) lines.push(`🎯 ${yolo.summary || 'nothing recognised'}`);
    if (cap) lines.push(cap);
    if (items.length > 1) lines.push(`_(+${items.length - 1} more frame(s) this event)_`);

    const files = [new AttachmentBuilder(imageToPost, { name: path.basename(chosen.f) })];
    const clip = siblingClip(chosen.f);
    if (clip) files.push(new AttachmentBuilder(clip, { name: path.basename(clip) }));
    try {
      await channel.send({ content: lines.join('\n').slice(0, 2000), files });
    } catch {
      // posting failed; don't mark seen or start cooldown → retry next tick
      continue;
    }
    cooldown[cam] = now;
    markSeen(items);
    posted += 1;
    if (imageToPost !== chosen.f) {
      try {
        fs.rmSync(imageToPost, { force: true }); // tidy the temp annotated copy
      } catch {
        /* non-fatal */
      }
    }
  }

  // Always persist — on a fresh state the first (empty) scan must save the
  // baseline lastTs, otherwise it re-baselines to "now" every tick and no new
  // snapshot ever looks newer than the baseline.
  saveState({ lastTs: maxTs, seen: [...seen], cooldown });
  return { posted };
}
