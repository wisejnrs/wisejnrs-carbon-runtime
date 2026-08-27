// Temporary smoke test: exercises YOLO and the RAG pipeline without Discord.
process.env.DISCORD_TOKEN = 'smoke-test';
const { detectObjects } = await import('../src/yolo/detect.js');
const { ingestCorpus } = await import('../src/rag/ingest.js');
const { search } = await import('../src/rag/store.js');
const { embedOne } = await import('../src/rag/embeddings.js');
const fs = await import('node:fs/promises');

// --- YOLO ---
const imageResponse = await fetch('https://ultralytics.com/images/bus.jpg');
const image = Buffer.from(await imageResponse.arrayBuffer());
const { detections, annotated } = await detectObjects(image);
console.log('[yolo] detections:', detections.map((d) => `${d.label}:${d.confidence.toFixed(2)}`).join(', '));
await fs.writeFile('data/smoke-detections.jpg', annotated);
console.log('[yolo] annotated image written to data/smoke-detections.jpg');

// --- RAG ---
await fs.mkdir('corpus', { recursive: true });
await fs.writeFile(
  'corpus/smoke-test.md',
  '# Carbon Bot\n\nCarbon Bot is a Discord bot rewritten in TypeScript. ' +
    'It supports Claude and OpenAI providers.\n\n' +
    'The favourite food of the Carbon Bot maintainers is lamingtons.\n',
);
const result = await ingestCorpus();
console.log('[rag] ingested', result.documents, 'documents,', result.chunks, 'chunks');
const hits = await search(await embedOne('What food do the maintainers like?'), 3);
console.log('[rag] top hit:', hits[0]?.source, '->', hits[0]?.text.slice(0, 120));
if (!hits.length || !hits[0].text.includes('lamingtons')) throw new Error('RAG smoke test failed');
console.log('SMOKE TESTS PASSED');
process.exit(0);
