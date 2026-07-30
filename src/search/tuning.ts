/**
 * Hybrid-search tuning, in one place for all four corpora.
 *
 * Previously these three numbers were copy-pasted into each of the four
 * query modules with a comment in each pointing at the others. Centralising
 * them is what makes `scripts/benchmark.ts --sweep` possible: the sweep varies
 * a Tuning and re-scores, instead of editing source between runs.
 *
 * On the values themselves: Orama's default vector-similarity cutoff (0.8) is
 * tuned for larger embedding models and silently drops nearly every result for
 * MiniLM's short-text embeddings, degenerating "hybrid" search into plain
 * keyword search. That is why `similarity` is far lower than the default.
 */
export interface Tuning {
  /** Weight of the BM25 text score in the hybrid blend. */
  text: number;
  /** Weight of the vector score. Should sum to 1 with `text`. */
  vector: number;
  /** Minimum vector similarity for a document to be considered a match. */
  similarity: number;
  /** Multiplier on text matches in the `title` property. */
  titleBoost: number;
  /**
   * Reorder the candidates with a cross-encoder before returning them. A switch
   * rather than a hardcoded step so `scripts/benchmark.ts` can A/B it, and so it
   * can be turned off if the added latency is ever unacceptable.
   */
  rerank: boolean;
  /**
   * How many deduped candidates to hand the reranker, independent of `limit` —
   * a reranker given 5 candidates can only reorder 5. Ignored when `rerank` is
   * false. Raising it costs one forward pass per extra candidate.
   */
  rerankCandidates: number;
}

export const DEFAULT_TUNING: Tuning = {
  text: 0.3,
  vector: 0.7,
  similarity: 0.1,
  titleBoost: 3,
  rerank: true,
  rerankCandidates: 25
};
