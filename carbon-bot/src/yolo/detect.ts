import fs from 'node:fs';
import * as ort from 'onnxruntime-node';
import sharp from 'sharp';
import { config } from '../config.js';
import { COCO_CLASSES } from './classes.js';

const INPUT_SIZE = 640;
const CONFIDENCE_THRESHOLD = 0.25;
const IOU_THRESHOLD = 0.45;

export interface Detection {
  label: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectionResult {
  detections: Detection[];
  annotated: Buffer;
}

let sessionPromise: Promise<ort.InferenceSession> | undefined;

export function yoloAvailable(): boolean {
  return fs.existsSync(config.yoloModelPath);
}

function getSession(): Promise<ort.InferenceSession> {
  sessionPromise ??= ort.InferenceSession.create(config.yoloModelPath);
  return sessionPromise;
}

function iou(a: Detection, b: Detection): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.width * a.height + b.width * b.height - intersection;
  return union > 0 ? intersection / union : 0;
}

function nms(detections: Detection[]): Detection[] {
  const sorted = [...detections].sort((a, b) => b.confidence - a.confidence);
  const kept: Detection[] = [];
  for (const candidate of sorted) {
    if (kept.every((existing) => iou(candidate, existing) < IOU_THRESHOLD)) {
      kept.push(candidate);
    }
  }
  return kept;
}

function escapeXml(text: string): string {
  return text.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export async function detectObjects(imageBuffer: Buffer): Promise<DetectionResult> {
  const session = await getSession();

  const meta = await sharp(imageBuffer).metadata();
  const originalWidth = meta.width ?? INPUT_SIZE;
  const originalHeight = meta.height ?? INPUT_SIZE;

  // Letterbox to 640x640 like Ultralytics: scale to fit, pad with black.
  const scale = Math.min(INPUT_SIZE / originalWidth, INPUT_SIZE / originalHeight);
  const padX = (INPUT_SIZE - originalWidth * scale) / 2;
  const padY = (INPUT_SIZE - originalHeight * scale) / 2;

  const rgb = await sharp(imageBuffer)
    .resize(INPUT_SIZE, INPUT_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0 } })
    .removeAlpha()
    .raw()
    .toBuffer();

  // HWC uint8 -> CHW float32 normalized to [0,1]
  const pixelCount = INPUT_SIZE * INPUT_SIZE;
  const input = new Float32Array(3 * pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    input[i] = rgb[i * 3] / 255;
    input[pixelCount + i] = rgb[i * 3 + 1] / 255;
    input[2 * pixelCount + i] = rgb[i * 3 + 2] / 255;
  }

  const tensor = new ort.Tensor('float32', input, [1, 3, INPUT_SIZE, INPUT_SIZE]);
  const results = await session.run({ [session.inputNames[0]]: tensor });
  const output = results[session.outputNames[0]];
  const data = output.data as Float32Array;
  const dims = output.dims as number[];

  const clampBox = (x: number, y: number, w: number, h: number): Omit<Detection, 'label' | 'confidence'> => ({
    x: Math.max(0, x),
    y: Math.max(0, y),
    width: Math.min(w, originalWidth - Math.max(0, x)),
    height: Math.min(h, originalHeight - Math.max(0, y)),
  });

  const raw: Detection[] = [];
  let detections: Detection[];
  if (dims[2] === 6) {
    // End-to-end format (YOLO26/YOLOv10): [1, N, 6] = x1,y1,x2,y2,score,class. NMS-free.
    for (let i = 0; i < dims[1]; i++) {
      const offset = i * 6;
      const score = data[offset + 4];
      if (score < CONFIDENCE_THRESHOLD) continue;
      const x = (data[offset] - padX) / scale;
      const y = (data[offset + 1] - padY) / scale;
      raw.push({
        label: COCO_CLASSES[data[offset + 5]] ?? `class_${data[offset + 5]}`,
        confidence: score,
        ...clampBox(x, y, (data[offset + 2] - data[offset]) / scale, (data[offset + 3] - data[offset + 1]) / scale),
      });
    }
    detections = raw;
  } else {
    // Anchor format (YOLOv8/11): [1, 84, 8400] - 4 box coords + 80 class scores per anchor.
    const [, channels, anchors] = dims;
    const classCount = channels - 4;
    for (let a = 0; a < anchors; a++) {
      let best = 0;
      let bestClass = -1;
      for (let c = 0; c < classCount; c++) {
        const score = data[(4 + c) * anchors + a];
        if (score > best) {
          best = score;
          bestClass = c;
        }
      }
      if (best < CONFIDENCE_THRESHOLD) continue;

      const cx = data[a];
      const cy = data[anchors + a];
      const w = data[2 * anchors + a];
      const h = data[3 * anchors + a];

      // Map from letterboxed 640-space back to original image coordinates.
      const x = (cx - w / 2 - padX) / scale;
      const y = (cy - h / 2 - padY) / scale;
      raw.push({
        label: COCO_CLASSES[bestClass] ?? `class_${bestClass}`,
        confidence: best,
        ...clampBox(x, y, w / scale, h / scale),
      });
    }
    detections = nms(raw);
  }

  const boxes = detections
    .map((detection) => {
      const label = `${detection.label} ${(detection.confidence * 100).toFixed(0)}%`;
      const textY = Math.max(detection.y - 6, 14);
      return (
        `<rect x="${detection.x}" y="${detection.y}" width="${detection.width}" height="${detection.height}" ` +
        'fill="none" stroke="#00ff88" stroke-width="3"/>' +
        `<text x="${detection.x + 2}" y="${textY}" font-family="sans-serif" font-size="18" ` +
        `fill="#00ff88" stroke="black" stroke-width="0.5">${escapeXml(label)}</text>`
      );
    })
    .join('');
  const overlay = Buffer.from(
    `<svg width="${originalWidth}" height="${originalHeight}" xmlns="http://www.w3.org/2000/svg">${boxes}</svg>`,
  );

  const annotated = await sharp(imageBuffer)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg({ quality: 90 })
    .toBuffer();

  return { detections, annotated };
}
