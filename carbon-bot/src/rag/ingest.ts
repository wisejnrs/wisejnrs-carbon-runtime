import fs from 'node:fs/promises';
import path from 'node:path';
import { google } from 'googleapis';
import { extractText, getDocumentProxy } from 'unpdf';
import { config } from '../config.js';
import { embed } from './embeddings.js';
import { replaceCorpus, type CorpusChunk } from './store.js';

const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.markdown', '.html', '.htm', '.csv', '.json']);

export interface IngestResult {
  documents: number;
  chunks: number;
  sources: string[];
}

interface Doc {
  source: string;
  text: string;
}

// ~1200-char chunks with 200-char overlap, split on paragraph boundaries where possible.
function chunkText(text: string, size = 1200, overlap = 200): string[] {
  const clean = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!clean) return [];
  if (clean.length <= size) return [clean];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);
    if (end < clean.length) {
      const paragraphBreak = clean.lastIndexOf('\n\n', end);
      if (paragraphBreak > start + size / 2) end = paragraphBreak;
    }
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = end - overlap;
  }
  return chunks.filter((chunk) => chunk.length > 0);
}

async function pdfToText(buffer: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(buffer);
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

async function loadLocalDocs(): Promise<Doc[]> {
  const docs: Doc[] = [];
  let entries: string[];
  try {
    entries = await fs.readdir(config.corpusDir, { recursive: true });
  } catch {
    return docs; // corpus dir missing
  }
  for (const entry of entries) {
    const fullPath = path.join(config.corpusDir, entry);
    const stat = await fs.stat(fullPath).catch(() => null);
    if (!stat?.isFile()) continue;
    const ext = path.extname(entry).toLowerCase();
    try {
      if (TEXT_EXTENSIONS.has(ext)) {
        docs.push({ source: entry, text: await fs.readFile(fullPath, 'utf8') });
      } else if (ext === '.pdf') {
        docs.push({ source: entry, text: await pdfToText(await fs.readFile(fullPath)) });
      }
    } catch (error) {
      console.warn(`[ingest] Skipping ${entry}:`, error);
    }
  }
  return docs;
}

async function loadDriveDocs(): Promise<Doc[]> {
  const { googleDriveFolderId, googleClientEmail, googlePrivateKey } = config;
  if (!googleDriveFolderId || !googleClientEmail || !googlePrivateKey) return [];

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: googleClientEmail, private_key: googlePrivateKey },
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  const drive = google.drive({ version: 'v3', auth });

  const docs: Doc[] = [];
  let pageToken: string | undefined;
  do {
    const { data } = await drive.files.list({
      q: `'${googleDriveFolderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType)',
      pageToken,
    });
    for (const file of data.files ?? []) {
      if (!file.id || !file.name) continue;
      try {
        if (file.mimeType === 'application/vnd.google-apps.document') {
          const res = await drive.files.export(
            { fileId: file.id, mimeType: 'text/plain' },
            { responseType: 'text' },
          );
          docs.push({ source: `drive:${file.name}`, text: String(res.data) });
        } else if (file.mimeType === 'application/pdf') {
          const res = await drive.files.get(
            { fileId: file.id, alt: 'media' },
            { responseType: 'arraybuffer' },
          );
          docs.push({
            source: `drive:${file.name}`,
            text: await pdfToText(new Uint8Array(res.data as ArrayBuffer)),
          });
        } else if (file.mimeType?.startsWith('text/')) {
          const res = await drive.files.get(
            { fileId: file.id, alt: 'media' },
            { responseType: 'text' },
          );
          docs.push({ source: `drive:${file.name}`, text: String(res.data) });
        }
      } catch (error) {
        console.warn(`[ingest] Skipping Drive file ${file.name}:`, error);
      }
    }
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);
  return docs;
}

let running = false;

export async function ingestCorpus(): Promise<IngestResult> {
  if (running) throw new Error('An ingest is already running');
  running = true;
  try {
    const docs = [...(await loadLocalDocs()), ...(await loadDriveDocs())];
    const chunks: CorpusChunk[] = [];
    for (const doc of docs) {
      const parts = chunkText(doc.text);
      if (!parts.length) continue;
      // bge models embed passages as-is; batch per document to bound memory.
      const vectors = await embed(parts);
      parts.forEach((text, i) => {
        chunks.push({ vector: vectors[i], text, source: doc.source, chunk: i });
      });
    }
    if (chunks.length) await replaceCorpus(chunks);
    return {
      documents: docs.length,
      chunks: chunks.length,
      sources: docs.map((doc) => doc.source),
    };
  } finally {
    running = false;
  }
}
