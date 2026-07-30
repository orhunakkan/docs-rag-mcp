import { describe, expect, it } from 'vitest';
import { DEFAULT_BUDGET, splitChunk, splitChunks, type CountTokens, type SplitBudget } from '../src/chunk/split.js';

/**
 * A whitespace-word counter stands in for the real tokenizer. The splitting
 * logic only ever asks "how many tokens is this text", so a stub keeps these
 * tests fast, offline and deterministic — the real tokenizer's agreement with
 * the budget is asserted separately by `scripts/probe-chunks.ts`, which runs it
 * over the whole committed corpus.
 */
const countWords: CountTokens = (text) => (text.trim() === '' ? 0 : text.trim().split(/\s+/).length);

const budget: SplitBudget = { maxTokens: 20, overlapTokens: 5 };

function chunk(content: string, id = 'pw/api/class-page#page-screenshot') {
  return { id, title: 'screenshot', content, sourceUrl: 'https://playwright.dev/docs/api/class-page#page-screenshot' };
}

/** Words repeated so a paragraph's length is predictable in stub tokens. */
function words(n: number, word = 'alpha'): string {
  return Array.from({ length: n }, () => word).join(' ');
}

describe('splitChunk', () => {
  it('passes a chunk under budget through byte-identical', () => {
    const content = `## screenshot\n\n${words(10)}\n`;
    const input = chunk(content);
    const out = splitChunk(input, countWords, budget);

    expect(out).toHaveLength(1);
    expect(out[0]).toBe(input);
    expect(out[0].content).toBe(content);
    expect(out[0].id).toBe('pw/api/class-page#page-screenshot');
  });

  it('splits an oversized prose chunk on paragraph boundaries, with overlap', () => {
    // A wider overlap allowance than the shared `budget`: the overlap can only
    // ever carry whole units, so with 8-token paragraphs a 5-token allowance
    // buys nothing. That is the intended behaviour — overlap never causes a
    // part to exceed the budget — but it makes for a poor test of overlap.
    const overlapping: SplitBudget = { maxTokens: 20, overlapTokens: 10 };
    const content = [`## screenshot`, words(8, 'aa'), words(8, 'bb'), words(8, 'cc')].join('\n\n');
    const out = splitChunk(chunk(content), countWords, overlapping);

    expect(out.length).toBeGreaterThan(1);
    for (const part of out) expect(countWords(part.content)).toBeLessThanOrEqual(overlapping.maxTokens);
    // Whole paragraphs, never a fragment of one.
    for (const part of out) {
      for (const word of ['aa', 'bb', 'cc']) {
        const occurrences = part.content.split(word).length - 1;
        expect(occurrences === 0 || occurrences === 8).toBe(true);
      }
    }
    // Overlap means adjacent parts share text.
    const shared = out.slice(1).some((part, i) => {
      const previous = out[i].content;
      return part.content.split('\n\n').some((para) => para.trim() !== '' && previous.includes(para.trim()));
    });
    expect(shared).toBe(true);
  });

  it('never splits a fenced code block that fits the budget', () => {
    const fence = ['```js', 'const a = 1;', 'const b = 2;', 'const c = 3;', '```'].join('\n');
    const content = [`## screenshot`, words(15, 'pre'), fence, words(15, 'post')].join('\n\n');
    const out = splitChunk(chunk(content), countWords, budget);

    expect(out.length).toBeGreaterThan(1);
    const holdingFence = out.filter((part) => part.content.includes('const a = 1;'));
    expect(holdingFence.length).toBeGreaterThan(0);
    // Wherever the fence landed it arrived whole, opener through closer.
    for (const part of holdingFence) {
      expect(part.content).toContain(fence);
    }
    // And no part carries an unbalanced fence.
    for (const part of out) {
      expect((part.content.match(/^```/gm) ?? []).length % 2).toBe(0);
    }
  });

  it('splits a single fence larger than the budget by reopening it', () => {
    const body = Array.from({ length: 30 }, (_, i) => `const v${i} = ${i};`);
    const content = [`## screenshot`, '```ts', ...body, '```'].join('\n');
    const out = splitChunk(chunk(content), countWords, budget);

    expect(out.length).toBeGreaterThan(1);
    for (const part of out) {
      const fences = part.content.match(/^```/gm) ?? [];
      // Every piece is a complete fence, and the info string is preserved.
      expect(fences.length % 2).toBe(0);
      if (part.content.includes('const v')) expect(part.content).toContain('```ts');
      expect(countWords(part.content)).toBeLessThanOrEqual(budget.maxTokens);
    }
    // Every line of code survives somewhere, and none is cut in half.
    for (const line of body) {
      expect(out.some((part) => part.content.includes(line))).toBe(true);
    }
  });

  it('splits a long list on item boundaries', () => {
    const items = Array.from({ length: 12 }, (_, i) => `- option ${i} does ${words(3, 'thing')}`);
    const content = [`## screenshot`, items.join('\n')].join('\n\n');
    const out = splitChunk(chunk(content), countWords, budget);

    expect(out.length).toBeGreaterThan(1);
    for (const item of items) {
      expect(out.some((part) => part.content.includes(item))).toBe(true);
    }
  });

  it('keeps an option list item together with its indented description', () => {
    // The shape of most of the Playwright and Node API reference text: a marker
    // line naming the option, then a blank line, then an indented paragraph
    // explaining it. Splitting between them yields a chunk that describes an
    // option without naming it.
    const item = (name: string) => `- \`${name}\` number *(optional)*\n\n  ${words(6, name)} explained here.\n`;
    const content = [`## screenshot`, item('quality'), item('scale'), item('timeout')].join('\n');
    const out = splitChunk(chunk(content), countWords, budget);

    expect(out.length).toBeGreaterThan(1);
    for (const name of ['quality', 'scale', 'timeout']) {
      const naming = out.filter((part) => part.content.includes(`\`${name}\``));
      const describing = out.filter((part) => part.content.includes(`${name} explained here.`));
      expect(naming.length).toBeGreaterThan(0);
      // Whichever part explains the option also names it.
      for (const part of describing) expect(naming).toContain(part);
    }
  });

  it('keeps a fence nested inside a list item intact', () => {
    const item = ['- run it like this:', '', '  ```js', '  await page.screenshot();', '  ```', ''].join('\n');
    const content = [`## screenshot`, words(15, 'pre'), item, words(15, 'post')].join('\n\n');
    const out = splitChunk(chunk(content), countWords, budget);

    for (const part of out) {
      expect((part.content.match(/^\s*```/gm) ?? []).length % 2).toBe(0);
    }
    expect(out.some((part) => part.content.includes('await page.screenshot();'))).toBe(true);
  });

  it('gives sub-chunks unique, stable, order-derived ids', () => {
    const content = [`## screenshot`, words(8, 'aa'), words(8, 'bb'), words(8, 'cc')].join('\n\n');
    const out = splitChunk(chunk(content), countWords, budget);

    expect(out.map((part) => part.id)).toEqual(out.map((_, i) => `pw/api/class-page#page-screenshot~${i + 1}`));
    expect(new Set(out.map((part) => part.id)).size).toBe(out.length);
    // Same input, same ids.
    expect(splitChunk(chunk(content), countWords, budget).map((part) => part.id)).toEqual(out.map((part) => part.id));
  });

  it('leaves sourceUrl and the other fields alone on every part', () => {
    const content = [`## screenshot`, words(8, 'aa'), words(8, 'bb'), words(8, 'cc')].join('\n\n');
    const out = splitChunk(chunk(content), countWords, budget);

    expect(out.length).toBeGreaterThan(1);
    for (const part of out) {
      expect(part.sourceUrl).toBe('https://playwright.dev/docs/api/class-page#page-screenshot');
      expect(part.title).toBe('screenshot');
    }
  });

  it('handles CRLF content, which a clone with core.autocrlf=true produces', () => {
    const fence = ['```js', 'const a = 1;', 'const b = 2;', '```'].join('\r\n');
    const content = [`## screenshot`, words(15, 'pre'), fence, words(15, 'post')].join('\r\n\r\n');
    const out = splitChunk(chunk(content), countWords, budget);

    expect(out.length).toBeGreaterThan(1);
    for (const part of out) {
      expect((part.content.match(/^```/gm) ?? []).length % 2).toBe(0);
      // No stray bare CR left where a line was joined or trimmed.
      expect(part.content).not.toMatch(/\r(?!\n)/);
    }
    expect(out.some((part) => part.content.includes('const a = 1;'))).toBe(true);
  });

  it('emits a single over-budget line rather than cutting mid-line', () => {
    const longLine = `| ${words(40, 'cell')} |`;
    const out = splitChunk(chunk(`## screenshot\n\n${longLine}\n`), countWords, budget);

    expect(out).toHaveLength(2);
    expect(out[1].content).toBe(longLine);
    expect(countWords(out[1].content)).toBeGreaterThan(budget.maxTokens);
  });

  it('does not loop forever when a part is one oversized unit', () => {
    const longLine = `${words(40, 'cell')}`;
    const content = [`## screenshot`, longLine, longLine, words(5, 'tail')].join('\n\n');
    const out = splitChunk(chunk(content), countWords, budget);

    expect(out.length).toBeLessThanOrEqual(4);
    expect(out.some((part) => part.content.includes('tail'))).toBe(true);
  });
});

describe('splitChunks', () => {
  it('keeps every chunk within budget unless a single line is not', () => {
    const inputs = [
      chunk(`## a\n\n${words(5)}\n`, 'a'),
      chunk([`## b`, words(8, 'bb'), words(8, 'cc'), words(8, 'dd')].join('\n\n'), 'b'),
      chunk(['```py', ...Array.from({ length: 25 }, (_, i) => `x${i} = ${i}`), '```'].join('\n'), 'c')
    ];
    const out = splitChunks(inputs, countWords, budget);

    expect(out.length).toBeGreaterThan(inputs.length);
    for (const part of out) {
      const lines = part.content.split('\n');
      const oversizedLine = lines.some((line) => countWords(line) > budget.maxTokens);
      if (!oversizedLine) expect(countWords(part.content)).toBeLessThanOrEqual(budget.maxTokens);
    }
    expect(new Set(out.map((part) => part.id)).size).toBe(out.length);
  });

  it('leaves ids untouched for chunks that did not need splitting', () => {
    const out = splitChunks([chunk(`## a\n\n${words(5)}\n`, 'a')], countWords, budget);
    expect(out.map((part) => part.id)).toEqual(['a']);
  });
});

describe('DEFAULT_BUDGET', () => {
  it('leaves headroom under the model window for the embedded heading prefix', () => {
    // 512 is `MODEL_MAX_TOKENS`, inlined so this test needs no model download.
    // 51 is the longest embed prefix measured across all four corpora by
    // `npm run probe`, and 2 covers the extractor's [CLS]/[SEP]. Raising the cap
    // past this point silently truncates the tail of the largest chunks again,
    // which is the defect the whole module exists to fix.
    const LONGEST_PREFIX = 51;
    expect(DEFAULT_BUDGET.maxTokens + LONGEST_PREFIX + 2).toBeLessThanOrEqual(512);
  });

  it('treats overlap as part of the cap, not an addition to it', () => {
    const content = [`## a`, words(8, 'aa'), words(8, 'bb'), words(8, 'cc'), words(8, 'dd')].join('\n\n');
    const wide: SplitBudget = { maxTokens: 20, overlapTokens: 18 };
    for (const part of splitChunk(chunk(content), countWords, wide)) {
      expect(countWords(part.content)).toBeLessThanOrEqual(wide.maxTokens);
    }
  });
});
