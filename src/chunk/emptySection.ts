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

/**
 * True when an `_intro` chunk carries prose of its own, rather than only the
 * attribution boilerplate `buildFileContent()` prepends to every page.
 *
 * The intro chunk spans from the start of the file to the first H2/H3, so on a
 * page that goes straight from its H1 into a section heading it holds exactly
 * the H1, the `> **Source:** …` line and the `---` rule — a result whose body
 * is a title and a link, which can only displace a real content chunk from the
 * same page. `hasBodyAfterHeading` does not catch these: they arrive by the
 * intro path, not the heading-boundary path, and run 100–152 chars rather than
 * looking short.
 *
 * Only a level-1 heading is treated as boilerplate, matching the `startsWith('# ')`
 * that `buildFileContent()` uses to find its insertion point, so a page opening
 * on a deeper heading keeps it.
 */
export function hasContentBeyondAttribution(content: string): boolean {
  return (
    content
      .split('\n')
      .filter((line) => {
        const trimmed = line.trim();
        if (trimmed === '' || trimmed === '---') return false;
        if (/^#\s/.test(trimmed)) return false;
        if (/^>\s*\*\*Source:\*\*/.test(trimmed)) return false;
        return true;
      })
      .join('')
      .trim().length > 0
  );
}
