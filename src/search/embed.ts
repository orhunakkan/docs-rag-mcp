import { env, pipeline } from '@huggingface/transformers';
import { MODEL_CACHE_DIR } from '../paths.js';

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';
export const EMBEDDING_DIM = 384;

env.cacheDir = MODEL_CACHE_DIR;

type FeatureExtractor = Awaited<ReturnType<typeof pipeline<'feature-extraction'>>>;

let extractorPromise: Promise<FeatureExtractor> | undefined;

function getExtractor(): Promise<FeatureExtractor> {
  if (!extractorPromise) {
    extractorPromise = pipeline('feature-extraction', MODEL_NAME);
  }
  return extractorPromise;
}

export async function embedText(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return (output.tolist() as number[][])[0];
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const extractor = await getExtractor();
  const output = await extractor(texts, { pooling: 'mean', normalize: true });
  return output.tolist() as number[][];
}
