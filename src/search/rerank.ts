/**
 * Cross-encoder reranking of the hybrid retriever's candidates.
 *
 * Aimed at one specific shape of failure, measured rather than assumed: across
 * the 102-query benchmark, recall@1 is 60% while recall@5 is 90%. Almost every
 * miss has the right answer sitting at rank 2-5, so the ranking is wrong far
 * more often than the retrieval is. Closing that 30-point gap is what a reranker
 * is for.
 *
 * The reason it can do better than the retriever it reorders: hybrid search
 * scores a query vector against document vectors computed independently, long
 * before the query existed. A cross-encoder puts the query and one document
 * through the model *together*, so every layer can attend across the pair. It is
 * far too slow to run over a whole corpus and exactly right for 25 candidates.
 *
 * Worked example, the `mask` defect from RETRIEVAL-PLAN.md: for "how do I mask
 * elements in a screenshot comparison" the cross-encoder scores the
 * `toHaveScreenshot` options at +1.19 and the `Attachments` page — which never
 * says "mask" and which hybrid search ranked #1 — at -11.41.
 */
import { AutoModelForSequenceClassification, AutoTokenizer, env } from '@huggingface/transformers';
import { MODEL_CACHE_DIR } from '../paths.js';

/**
 * ~23 MB, and it caches into `.cache/models/` alongside the embedding model
 * because `MODEL_CACHE_DIR` is set here too — the same reason `embed.ts` sets
 * it: an MCP client launches the server with the *opened project* as cwd, and a
 * cwd-relative cache silently re-downloads into whatever repo the user has open.
 */
const MODEL_NAME = 'Xenova/ms-marco-MiniLM-L-6-v2';

env.cacheDir = MODEL_CACHE_DIR;

type Tokenizer = Awaited<ReturnType<typeof AutoTokenizer.from_pretrained>>;
type Model = Awaited<ReturnType<typeof AutoModelForSequenceClassification.from_pretrained>>;

let loaded: Promise<{ tokenizer: Tokenizer; model: Model }> | undefined;

/** Loaded once per process and cached, like the embedding pipeline. */
function load(): Promise<{ tokenizer: Tokenizer; model: Model }> {
  if (!loaded) {
    loaded = (async () => ({
      tokenizer: await AutoTokenizer.from_pretrained(MODEL_NAME),
      model: await AutoModelForSequenceClassification.from_pretrained(MODEL_NAME)
    }))();
  }
  return loaded;
}

/** What a result has to carry to be rerankable. */
interface Rerankable {
  score: number;
  title: string;
  headingPath: string;
  content: string;
}

/**
 * The document side of the pair. The heading context goes in for the same reason
 * it goes into the embedded text: a deep API-reference section's body is a
 * parameter list whose prose never names the class it belongs to.
 *
 * Exported so `tests/rerank.test.ts` can assert that contract without loading a
 * 23 MB model — the model call itself is measured by `npm run benchmark`.
 */
export function pairText(result: Rerankable): string {
  const path = result.headingPath === '' || result.headingPath === result.title ? '' : ` > ${result.headingPath}`;
  return `${result.title}${path}: ${result.content}`;
}

/**
 * Reorders `candidates` most-relevant-first, replacing each `score` with the
 * cross-encoder's. Scores are raw logits, roughly -12 to +12, and are not
 * comparable with the hybrid scores they replace — only their order is meaningful.
 *
 * Returns the input untouched for 0 or 1 candidates, so a filtered query that
 * matched almost nothing does not pay for a model load.
 */
export async function rerank<T extends Rerankable>(queryText: string, candidates: T[]): Promise<T[]> {
  if (candidates.length < 2) return candidates;

  const { tokenizer, model } = await load();
  // This model's window is 512 as well, and a pair is `[CLS] query [SEP] doc
  // [SEP]`. A 440-token chunk plus its heading prefix plus a short query lands
  // within a few tokens of that, so the longest chunks lose a little of their
  // tail here. Unlike the embedding case — where 43% of a corpus was being
  // discarded — this costs the tail of one candidate in a reordering decision,
  // which is why `truncation: true` is left to handle it rather than the budget
  // being cut further for it.
  const inputs = tokenizer(new Array(candidates.length).fill(queryText), {
    text_pair: candidates.map(pairText),
    padding: true,
    truncation: true
  });
  const { logits } = await model(inputs);
  const scores = (logits.tolist() as number[][]).map((row) => row[0]);

  return candidates
    .map((candidate, idx) => ({ ...candidate, score: scores[idx] }))
    .sort((a, b) => b.score - a.score);
}
