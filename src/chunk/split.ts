/**
 * Caps every chunk at the embedding model's input window.
 *
 * The chunkers slice at heading boundaries, which produces chunks running from
 * 8 to 52,654 characters. `Xenova/all-MiniLM-L6-v2` has `model_max_length: 512`
 * and truncates silently past it: two texts sharing a 3,480-char prefix and
 * having entirely different tails embed to cosine similarity `1.000000` —
 * bit-identical vectors. Measured over the committed corpora, 17-43% of the
 * text was never reaching the embedder, so BM25 could find it and the vector
 * half of hybrid search could not see it at all.
 *
 * Three choices worth knowing about, each resolving a tension in the rules this
 * splitter was specified with:
 *
 * **"Prefer sentence boundaries" loses to "never split mid-line."** A paragraph
 * written as one long line with ten sentences in it cannot be cut on a sentence
 * boundary without cutting mid-line. Mid-line is the stronger guarantee — it is
 * what protects table rows, list markers and lines of code from being halved. In
 * these corpora the preference costs almost nothing anyway: the TypeScript
 * handbook and MDN both write one sentence per line, so line boundaries usually
 * *are* sentence boundaries.
 *
 * **A list item outranks a paragraph, not the other way round.** The rules were
 * written as "paragraph, then list item", but in this markdown a list item spans
 * several paragraphs, and cutting on the paragraph inside it is what does the
 * damage. Playwright and Node document options as a marker line naming the
 * option and a separate indented paragraph explaining it, so a paragraph-first
 * split put `- \`quality\` number` in one chunk and "The quality of the image,
 * between 0-100" in the next — a chunk describing an option without ever naming
 * it, which is the same defect as separating `mask` from `maskColor`. So the
 * order is: whole list item, then the paragraphs inside an oversized one, then
 * line. Option lists are most of the text in two of the four corpora.
 *
 * **An oversized code fence is split and reopened, not kept whole.** Keeping it
 * whole was the alternative, and it would leave exactly the worst chunks — huge
 * API-reference examples — still truncated at embedding time, which defeats the
 * point. So a fence longer than the budget is cut at line boundaries and each
 * piece is closed and reopened with the same info string. Each piece is
 * therefore well-formed markdown that renders, at the cost of a sample that can
 * be cut mid-function. Nothing is ever cut mid-line, so no line of code is
 * corrupted.
 *
 * The one case that cannot be brought inside the budget is a *single line*
 * longer than the budget (a wide table row, a minified snippet). Those pass
 * through oversized rather than being corrupted; `splitChunks` is documented as
 * "within budget unless a single line is not", and the probe over `docs/`
 * measures how many there are.
 *
 * This module takes a `CountTokens` rather than loading a tokenizer itself, so
 * the splitting logic stays synchronous and testable with a stub, and the
 * coupling to the embedding model lives at the pipeline edge in
 * `src/search/embed.ts` next to `MODEL_NAME` and `EMBEDDING_DIM`.
 */

/** Counts tokens the way the embedding model will. See `createTokenCounter`. */
export type CountTokens = (text: string) => number;

export interface SplitBudget {
  /** Hard cap on tokens per emitted chunk. */
  maxTokens: number;
  /** How much of the previous part to repeat at the start of the next one. */
  overlapTokens: number;
}

/**
 * `maxTokens` is the cap on a whole emitted part, overlap included — overlap is
 * never additive to it, because the cap is the correctness constraint and the
 * overlap is a retrieval nicety.
 *
 * 440 leaves 72 tokens of headroom under the model's 512 window. That covers the
 * `"${title} > ${headingPath}: "` prefix `indexChunks` prepends before embedding,
 * measured over all four corpora at a median of 5-17 tokens and a maximum of 51
 * (Node's deep `module > class > event` paths), plus the extractor's two special
 * tokens.
 *
 * The cap wants to be as high as that headroom allows, because splitting costs
 * chunk count: `npm run probe` measures Playwright's growth at +84% with a
 * 400-token cap and +74% at 440, and a whole method's documentation staying in
 * one chunk is better retrieval than the same text in two. 460 was rejected —
 * it would leave 52 tokens against a 51-token observed maximum.
 */
export const DEFAULT_BUDGET: SplitBudget = { maxTokens: 440, overlapTokens: 60 };

/** The minimum a chunk must have: everything else is carried through untouched. */
interface Splittable {
  id: string;
  content: string;
}

interface Block {
  text: string;
  /** A fenced code block, which is never cut except as a last resort. */
  fenced: boolean;
}

// Deliberately unanchored at the end: lines here keep their `\n`, and in
// JavaScript `$` without the `m` flag does not match before a trailing newline,
// so a `(.*)$` info-string group silently failed to match every real fence.
//
// Any indentation, not CommonMark's 0-3, because a fence nested inside a list
// item still must not be cut — and that is where most of the examples in these
// corpora live.
const FENCE_OPEN = /^\s*(`{3,}|~{3,})/;
const FENCE_CLOSE = /^(`{3,}|~{3,})$/;
// Any indentation, not CommonMark's 0-3, because these corpora nest option
// lists several levels deep (`options` -> `mask` -> its description) and a
// nested item has to be recognisable as an item when the level above it is
// broken up.
const LIST_ITEM = /^\s*([-*+]|\d+[.)])\s/;

function indentOf(line: string): number {
  return (line.match(/^ */) as RegExpMatchArray)[0].length;
}

/** Lines keep their terminators, so joining a run of them reproduces the source byte for byte. */
function toLines(content: string): string[] {
  return content.split(/(?<=\n)/);
}

function isBlank(line: string): boolean {
  return line.trim() === '';
}

/**
 * Segments content into fenced blocks, whole list items, and paragraphs. A blank
 * line belongs to the block it follows, so concatenating every block's text
 * reproduces the input exactly.
 *
 * `groupListItems` keeps a list item together with its indented continuation —
 * including continuation *paragraphs*, which is the point. Playwright's and
 * Node's API pages document options as a marker line naming the option and a
 * separate indented paragraph explaining it:
 *
 *     - `quality` number *(optional)*
 *
 *       The quality of the image, between 0-100. …
 *
 * Treating the blank line as a boundary put the option's name in one part and
 * its meaning in the next, which is the same defect as separating `mask` from
 * `maskColor` — a chunk describing an option without naming it. Option lists are
 * most of the text in two of the four corpora, so this is the common case.
 *
 * It is turned off when subdividing an item that is itself over budget: that
 * pass needs the finer paragraph boundaries, and leaving it on would return the
 * same single block forever.
 */
function toBlocks(content: string, groupListItems = true): Block[] {
  const lines = toLines(content);
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const open = lines[i].match(FENCE_OPEN);
    if (open) {
      const marker = open[1];
      const run: string[] = [lines[i]];
      i++;
      // A fence closes on a line of the same character, at least as long, with
      // nothing else on it. An unclosed fence runs to the end of the chunk.
      while (i < lines.length) {
        const line = lines[i];
        run.push(line);
        i++;
        const trimmed = line.trim();
        if (trimmed.startsWith(marker[0]) && trimmed.length >= marker.length && FENCE_CLOSE.test(trimmed)) break;
      }
      while (i < lines.length && isBlank(lines[i])) run.push(lines[i++]);
      blocks.push({ text: run.join(''), fenced: true });
      continue;
    }

    if (groupListItems && LIST_ITEM.test(lines[i])) {
      const indent = indentOf(lines[i]);
      const run: string[] = [lines[i++]];
      while (i < lines.length) {
        if (isBlank(lines[i])) {
          // A blank line continues the item only if what comes after it is
          // indented past the marker; otherwise the item ended here.
          let next = i;
          while (next < lines.length && isBlank(lines[next])) next++;
          if (next >= lines.length || indentOf(lines[next]) <= indent) break;
          while (i < next) run.push(lines[i++]);
          continue;
        }
        if (indentOf(lines[i]) <= indent) break;
        run.push(lines[i++]);
      }
      while (i < lines.length && isBlank(lines[i])) run.push(lines[i++]);
      blocks.push({ text: run.join(''), fenced: false });
      continue;
    }

    const run: string[] = [];
    while (i < lines.length && !isBlank(lines[i]) && !FENCE_OPEN.test(lines[i])) {
      // Stop before a list item so the item starts its own block, rather than
      // being absorbed into the paragraph that introduces it.
      if (groupListItems && run.length > 0 && LIST_ITEM.test(lines[i])) break;
      run.push(lines[i++]);
    }
    while (i < lines.length && isBlank(lines[i])) run.push(lines[i++]);
    // A blank line with no preceding content still has to be consumed, or the
    // loop cannot advance.
    if (run.length === 0) run.push(lines[i++]);
    blocks.push({ text: run.join(''), fenced: false });
  }

  return blocks;
}

/** Packs already-atomic pieces into runs that fit, without reordering them. */
function packToFit(pieces: string[], count: CountTokens, maxTokens: number): string[] {
  const out: string[] = [];
  let current = '';

  for (const piece of pieces) {
    // Whitespace-only pieces cost nothing and must never start a run, or a
    // paragraph's trailing blank line becomes a part of its own with no content.
    if (current === '' || isBlank(piece)) {
      current += piece;
      continue;
    }
    if (count(current + piece) <= maxTokens) {
      current += piece;
      continue;
    }
    out.push(current);
    current = piece;
  }
  if (current !== '') out.push(current);
  return out;
}

/**
 * Cuts an oversized fence at line boundaries, closing and reopening it around
 * each piece so every piece is a complete, renderable fence.
 */
function splitFence(text: string, count: CountTokens, maxTokens: number): string[] {
  const lines = toLines(text);
  const opener = lines[0];
  const marker = (opener.match(FENCE_OPEN) as RegExpMatchArray)[1];

  // Trailing blank lines and the closing fence, if the fence was ever closed.
  let end = lines.length;
  while (end > 1 && isBlank(lines[end - 1])) end--;
  const closed = end > 1 && FENCE_CLOSE.test(lines[end - 1].trim());
  // The closer must end in a newline even when the source fence was the last
  // line of the chunk with no trailing newline — otherwise a following piece's
  // opener concatenates onto it and produces ` ``````ts `, one line that is
  // neither a valid closer nor a valid opener.
  const rawCloser = closed ? lines[end - 1] : marker;
  const closer = rawCloser.endsWith('\n') ? rawCloser : `${rawCloser}\n`;
  const body = lines.slice(1, closed ? end - 1 : end);

  const overhead = count(opener + closer);
  const groups = packToFit(body, count, Math.max(maxTokens - overhead, 1));
  return groups.map((group) => opener + (group.endsWith('\n') ? group : `${group}\n`) + closer);
}

/**
 * Reduces content to units that each fit the budget where that is possible at
 * all, preferring the coarsest structural boundary that works: whole list item
 * or paragraph, then the paragraphs inside an oversized item, then line, and for
 * a fence, reopened fence pieces.
 */
function toUnits(content: string, count: CountTokens, maxTokens: number, groupListItems = true): string[] {
  const units: string[] = [];

  for (const block of toBlocks(content, groupListItems)) {
    if (count(block.text) <= maxTokens) {
      units.push(block.text);
      continue;
    }
    if (block.fenced) {
      units.push(...splitFence(block.text, count, maxTokens));
      continue;
    }
    if (groupListItems) {
      // An item too long to keep whole. Peel its marker line off as a lead-in
      // and re-group what it contained, so that a nested option list — which is
      // how `options` -> `mask` -> description is written — keeps each of its own
      // items with its own description. Without this the outer item swallows the
      // whole list and the fallback sees only paragraphs.
      const [head, ...rest] = toLines(block.text);
      const body = rest.join('');
      if (body.trim() !== '') {
        units.push(head);
        units.push(...toUnits(body, count, maxTokens, true));
        continue;
      }
      // A single marker line with nothing under it: nothing left to regroup.
      units.push(...toUnits(block.text, count, maxTokens, false));
      continue;
    }
    // Last resort short of cutting mid-line, which this never does: a single
    // line over budget is emitted oversized rather than corrupted.
    units.push(...packToFit(toLines(block.text), count, maxTokens));
  }

  return units;
}

/** The trailing units of a part that fit the overlap allowance, in order. */
function overlapFor(units: string[], count: CountTokens, overlapTokens: number): string[] {
  if (overlapTokens <= 0) return [];
  const taken: string[] = [];
  for (let i = units.length - 1; i >= 0; i--) {
    const candidate = [units[i], ...taken];
    if (count(candidate.join('')) > overlapTokens) break;
    taken.unshift(units[i]);
  }
  // Never let the overlap be the whole part, or a part that is one oversized
  // unit would repeat itself forever.
  return taken.length === units.length ? taken.slice(1) : taken;
}

/**
 * Splits one chunk into as many parts as the budget requires. A chunk already
 * within budget is returned as-is — same object, same `id`, byte-identical
 * `content` — so the common case is untouched and only oversized chunks gain a
 * `~n` id suffix.
 *
 * `sourceUrl` is deliberately left alone: every part cites the same upstream
 * section, and inventing sub-anchors would produce links that 404.
 */
export function splitChunk<T extends Splittable>(chunk: T, count: CountTokens, budget: SplitBudget = DEFAULT_BUDGET): T[] {
  if (count(chunk.content) <= budget.maxTokens) return [chunk];

  const units = toUnits(chunk.content, count, budget.maxTokens);
  const parts: string[][] = [];
  let current: string[] = [];

  for (const unit of units) {
    if (current.length === 0 || isBlank(unit)) {
      current.push(unit);
      continue;
    }
    if (count([...current, unit].join('')) <= budget.maxTokens) {
      current.push(unit);
      continue;
    }
    parts.push(current);
    const overlap = overlapFor(current, count, budget.overlapTokens);
    // Drop the overlap rather than exceed the budget for it: the overlap is a
    // retrieval nicety, the budget is the correctness constraint.
    current = count([...overlap, unit].join('')) <= budget.maxTokens ? [...overlap, unit] : [unit];
  }
  if (current.length > 0) parts.push(current);

  return parts
    .map((part) => part.join('').trim())
    .filter((text) => text !== '')
    .map((content, idx) => ({ ...chunk, id: `${chunk.id}~${idx + 1}`, content }));
}

/**
 * Applies `splitChunk` across a corpus. Every emitted chunk is within
 * `budget.maxTokens`, except one that is a single line longer than the budget —
 * splitting that would mean cutting mid-line.
 */
export function splitChunks<T extends Splittable>(chunks: T[], count: CountTokens, budget: SplitBudget = DEFAULT_BUDGET): T[] {
  return chunks.flatMap((chunk) => splitChunk(chunk, count, budget));
}
