/**
 * Hybrid-search tuning, in one place for all four corpora.
 *
 * Previously these numbers were copy-pasted into each of the four query modules
 * with a comment in each pointing at the others. Centralising them is what makes
 * `scripts/benchmark.ts --sweep` possible: the sweep varies a Tuning and
 * re-scores, instead of editing source between runs.
 *
 * On the values themselves: Orama's default vector-similarity cutoff (0.8) is
 * tuned for larger embedding models and silently drops nearly every result for
 * MiniLM's short-text embeddings, degenerating "hybrid" search into plain
 * keyword search. That is why `similarity` is far lower than the default.
 *
 * Nothing here should be changed without a sweep behind it, and a sweep expires:
 * these weights balance what the retriever *sees*, so any change to chunking or
 * to the embedding model invalidates them. That is not hypothetical — the
 * previous optimum was 0.3/0.7, measured when 43% of one corpus was never
 * reaching the embedder, and capping chunk size moved it.
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
  // Was 0.3/0.7. The argument for leaning on the vector side was made against
  // truncated embeddings — 43% of the Playwright corpus was never reaching the
  // embedder — so capping chunk size, embedding the heading path and reranking
  // all changed what these weights are balancing. Re-sweeping afterwards moved
  // the optimum to an even split: recall@1 70% -> 71%, MRR 0.789 -> 0.799, and
  // verbose-identifier recall@1 54% -> 58%, with natural-language recall
  // unchanged. See the sweep findings in the README's design notes.
  text: 0.5,
  vector: 0.5,
  similarity: 0.1,
  titleBoost: 3,
  rerank: true,
  rerankCandidates: 25
};
