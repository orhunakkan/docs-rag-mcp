/**
 * True when a heading-delimited slice carries something beyond its own heading
 * line. Used by all four chunkers to skip content-free sections rather than
 * indexing a heading with nothing under it.
 *
 * Structural rather than a length threshold on purpose: an upstream heading
 * whose section body is genuinely empty (Playwright's `## Methods` before its
 * first `###`, MDN's macro-only `## Specifications`) is exactly its heading and
 * nothing else, whereas a short-but-real section is not. A `content.length < N`
 * guess would discard terse real content — the Playwright corpus's chunk
 * lengths run from 8 to 19,755 chars with no gap to put N in.
 *
 * Callers must strip comment artifacts (e.g. Docusaurus `{/* #slug *\/}`) before
 * calling, or a section holding only a stripped comment will look non-empty.
 */
export function hasBodyAfterHeading(content: string): boolean {
  const headingLineEnd = content.indexOf('\n');
  if (headingLineEnd === -1) return false;
  return content.slice(headingLineEnd + 1).trim().length > 0;
}
