import { AutoTokenizer, env, pipeline } from '@huggingface/transformers';
import type { CountTokens } from '../chunk/split.js';
import { MODEL_CACHE_DIR } from '../paths.js';

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';
export const EMBEDDING_DIM = 384;

/**
 * The model's input window. Anything past it is truncated before embedding,
 * silently — no error, no warning, just a vector that ignores the tail. This is
 * why `src/chunk/split.ts` exists, and why swapping `MODEL_NAME` means checking
 * three things and not one: the dimension above, this window, and `similarity`
 * in `src/search/tuning.ts`, which is calibrated per model.
 */
export const MODEL_MAX_TOKENS = 512;

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

/**
 * The heading context prepended to a chunk's text *before embedding only*.
 *
 * `indexChunks` used to embed `chunk.content` alone, so the vector had no idea a
 * chunk sits under `class-page` → `Methods` → `screenshot`: BM25 could see
 * `title` with a 3x boost and the vector side saw nothing. Deep API-reference
 * sections are the ones this hurts, because their body is a parameter list whose
 * prose gives no clue what class it belongs to.
 *
 * The prefix is never stored. `content` is what the agent reads and what
 * `dedupeByContent` compares, and it must not gain a synthetic prefix.
 */
export function embedPrefix(title: string, headingPath: string[]): string {
  const path = headingPath.filter((part) => part !== title).join(' > ');
  return path === '' ? `${title}: ` : `${title} > ${path}: `;
}

/**
 * `headingPrefix: false` embeds `content` alone, the way this pipeline worked
 * before the heading prefix was added. It exists so `scripts/reindex.ts` can
 * A/B the prefix against an otherwise identical index — the change is only
 * visible after a full re-embed, so there is no cheaper way to attribute it.
 */
export interface IndexOptions {
  headingPrefix?: boolean;
}

export function embedInput(title: string, headingPath: string[], content: string): string {
  return embedPrefix(title, headingPath) + content;
}

/**
 * Loads the embedding model's own tokenizer and returns a synchronous token
 * count, for `splitChunks` to budget against.
 *
 * Budgeting with the real tokenizer rather than a chars-per-token constant is
 * the whole point: prose runs about 4.3 characters per token, markdown with
 * code fences about 2.0, and the chunks that overflow worst are exactly the
 * code-heavy API-reference ones — so any constant would be wrong where it
 * matters most. Tokenizing every chunk once per sync is negligible next to the
 * embedding pass.
 *
 * `add_special_tokens: false` because `[CLS]`/`[SEP]` are added by the
 * extractor, not by the chunk; the budget's headroom under 512 covers them.
 */
export async function createTokenCounter(): Promise<CountTokens> {
  const tokenizer = await AutoTokenizer.from_pretrained(MODEL_NAME);
  return (text: string) => tokenizer.encode(text, { add_special_tokens: false }).length;
}
