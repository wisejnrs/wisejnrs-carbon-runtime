import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';

// bge-small-en-v1.5 embeddings, run locally via transformers.js.
// Downloads once to the HF cache (set HF_HOME to persist it in Docker).
const MODEL = process.env.EMBEDDING_MODEL ?? 'Xenova/bge-small-en-v1.5';

let extractorPromise: Promise<FeatureExtractionPipeline> | undefined;

function getExtractor(): Promise<FeatureExtractionPipeline> {
  extractorPromise ??= pipeline('feature-extraction', MODEL);
  return extractorPromise;
}

export async function embed(texts: string[]): Promise<number[][]> {
  const extractor = await getExtractor();
  const output = await extractor(texts, { pooling: 'mean', normalize: true });
  return output.tolist() as number[][];
}

export async function embedOne(text: string): Promise<number[]> {
  const [vector] = await embed([text]);
  return vector;
}
