/**
 * Collapses hits that carry byte-identical content but arrived under different
 * source URLs.
 *
 * Playwright documents the same method on every class exposing it, so
 * `getByText` exists four times within `nodejs` alone — on Page, Frame,
 * Locator, and FrameLocator — with identical bodies. At the default limit of 5
 * that let one method consume four of five result slots. The MDN corpus has the
 * same shape for ~10% of its chunks.
 *
 * This cannot be fixed at index time: the copies differ in `sourceUrl`, and
 * which class you reached a method from is real information. So the duplicates
 * stay indexed and are collapsed per-query, with the dropped siblings' URLs
 * preserved on `alsoAt` — one result saying "also on Frame, Locator, Page"
 * beats both four identical results and one result that hides the other three.
 */

/** Fetch this many times `limit` before collapsing, so dedupe can't under-deliver. */
const OVERFETCH_FACTOR = 4;

/** Ceiling on the over-fetch. Well above any real `limit` (max 20 at the tool boundary). */
const MAX_OVERFETCH = 100;

export function overfetchLimit(limit: number): number {
  return Math.min(limit * OVERFETCH_FACTOR, MAX_OVERFETCH);
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
