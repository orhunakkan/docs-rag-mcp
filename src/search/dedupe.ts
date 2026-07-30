/**
 * Collapses two different kinds of redundant hit, both of which could otherwise
 * let one piece of documentation occupy most of the result slots.
 *
 * **Same content, different URL.** Playwright documents the same method on every
 * class exposing it, so `getByText` exists four times within `nodejs` alone — on
 * Page, Frame, Locator, and FrameLocator — with identical bodies. At the default
 * limit of 5 that let one method consume four of five slots. The MDN corpus has
 * the same shape for ~10% of its chunks. This cannot be fixed at index time: the
 * copies differ in `sourceUrl`, and which class you reached a method from is real
 * information. So they stay indexed and are collapsed per query, with the dropped
 * siblings' URLs preserved on `alsoAt` — one result saying "also on Frame,
 * Locator, Page" beats both four identical results and one result that hides the
 * other three.
 *
 * **Same URL, different content**, which arrived with the embedding-window cap in
 * `src/chunk/split.ts`: one heading section can now be several chunks, and
 * because they overlap, a query that matches the section tends to match several
 * of its parts. Measured on "difference between an interface and a type alias",
 * five of six slots were parts of just two sections. Unlike the case above there
 * is nothing to preserve on `alsoAt`: sibling parts share a `sourceUrl`, a
 * `title` and a `headingPath`, so an agent receiving two of them cannot tell them
 * apart and gains nothing over receiving the best-matching one plus a different
 * section. `collapseSiblingParts` drops all but the best-scoring part, with no
 * annotation.
 *
 * The two run at different points, which was measured rather than assumed.
 * Collapsing siblings *before* reranking narrows the cross-encoder's candidate
 * pool to one chunk per section and cost 1 point of recall@1 and 3 of recall@3;
 * collapsing *after* leaves the pool as wide as it was and returns distinct
 * sections anyway. So the content pass feeds the reranker, and the sibling pass
 * runs last, on its output.
 */

/** Fetch this many times `limit` before collapsing, so dedupe can't under-deliver. */
const OVERFETCH_FACTOR = 4;

/** Ceiling on the over-fetch. Well above any real `limit` (max 20 at the tool boundary). */
const MAX_OVERFETCH = 100;

/**
 * `wanted` is how many *collapsed* results the caller needs — `limit` normally,
 * but `rerankCandidates` when reranking, since a reranker can only reorder what
 * it is given.
 */
export function overfetchLimit(wanted: number): number {
  return Math.min(wanted * OVERFETCH_FACTOR, MAX_OVERFETCH);
}

interface Dedupable {
  content: string;
  sourceUrl: string;
}

/**
 * Keeps the highest-scoring member of each identical-content group. Relies on
 * `hits` arriving in descending score order (Orama guarantees this) and on Map
 * preserving insertion order, so the returned array stays score-ordered.
 */
export function dedupeByContent<T extends Dedupable>(hits: T[], limit: number): Array<T & { alsoAt?: string[] }> {
  const groups = new Map<string, { best: T; siblings: string[] }>();
  for (const hit of hits) {
    const key = hit.content.trim();
    const group = groups.get(key);
    if (!group) {
      groups.set(key, { best: hit, siblings: [] });
      continue;
    }
    if (hit.sourceUrl !== group.best.sourceUrl && !group.siblings.includes(hit.sourceUrl)) {
      group.siblings.push(hit.sourceUrl);
    }
  }

  return [...groups.values()]
    .slice(0, limit)
    .map(({ best, siblings }) => (siblings.length > 0 ? { ...best, alsoAt: siblings } : { ...best }));
}

/**
 * Keeps one result per `sourceUrl` — the first, so the caller's ordering decides
 * which part of a section represents it. Runs last in the query pipeline, after
 * any reranking, and does the final slice to `limit`.
 */
export function collapseSiblingParts<T extends { sourceUrl: string }>(results: T[], limit: number): T[] {
  const bySection = new Map<string, T>();
  for (const result of results) {
    if (!bySection.has(result.sourceUrl)) bySection.set(result.sourceUrl, result);
  }
  return [...bySection.values()].slice(0, limit);
}
