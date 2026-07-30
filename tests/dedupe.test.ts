import { describe, expect, it } from 'vitest';
import { collapseSiblingParts, dedupeByContent, overfetchLimit } from '../src/search/dedupe.js';

const hit = (content: string, sourceUrl: string, score: number) => ({ content, sourceUrl, score });

describe('overfetchLimit', () => {
  it('over-fetches a multiple of the requested limit', () => {
    expect(overfetchLimit(5)).toBe(20);
    expect(overfetchLimit(1)).toBe(4);
  });

  it('caps the over-fetch so a large limit cannot request an unbounded scan', () => {
    expect(overfetchLimit(20)).toBe(80);
    expect(overfetchLimit(100)).toBe(100);
  });
});

describe('dedupeByContent', () => {
  it('collapses identical content and records the folded-in URLs on alsoAt', () => {
    // The real shape: getByText documented on four Playwright classes.
    const body = 'Allows locating elements that contain given text.';
    const results = dedupeByContent(
      [
        hit(body, 'https://playwright.dev/docs/api/class-page#page-get-by-text', 9),
        hit(body, 'https://playwright.dev/docs/api/class-frame#frame-get-by-text', 8),
        hit(body, 'https://playwright.dev/docs/api/class-locator#locator-get-by-text', 7),
        hit(body, 'https://playwright.dev/docs/api/class-framelocator#frame-locator-get-by-text', 6)
      ],
      5
    );

    expect(results).toHaveLength(1);
    expect(results[0].sourceUrl).toContain('class-page');
    expect(results[0].alsoAt).toHaveLength(3);
    expect(results[0].alsoAt).toContain('https://playwright.dev/docs/api/class-frame#frame-get-by-text');
  });

  it('keeps the highest-scoring member as the representative', () => {
    const body = 'same text';
    const results = dedupeByContent([hit(body, 'url-top', 9), hit(body, 'url-lower', 2)], 5);

    expect(results[0].sourceUrl).toBe('url-top');
    expect(results[0].alsoAt).toEqual(['url-lower']);
  });

  it('leaves alsoAt undefined when nothing was collapsed', () => {
    const results = dedupeByContent([hit('a', 'url-a', 9), hit('b', 'url-b', 8)], 5);

    expect(results).toHaveLength(2);
    expect(results[0].alsoAt).toBeUndefined();
    expect(results[1].alsoAt).toBeUndefined();
  });

  it('preserves descending score order', () => {
    const results = dedupeByContent([hit('a', 'u1', 9), hit('b', 'u2', 5), hit('c', 'u3', 1)], 5);

    expect(results.map((r) => r.sourceUrl)).toEqual(['u1', 'u2', 'u3']);
  });

  it('still fills the requested limit when duplicates are present', () => {
    // 3 copies of one body + 3 distinct bodies; a naive post-trim would yield 3.
    const hits = [
      hit('dupe', 'd1', 10),
      hit('dupe', 'd2', 9),
      hit('dupe', 'd3', 8),
      hit('x', 'x1', 7),
      hit('y', 'y1', 6),
      hit('z', 'z1', 5)
    ];

    expect(dedupeByContent(hits, 3).map((r) => r.sourceUrl)).toEqual(['d1', 'x1', 'y1']);
  });

  it('trims whitespace when comparing, so indentation drift still collapses', () => {
    const results = dedupeByContent([hit('body text', 'u1', 9), hit('  body text\n', 'u2', 8)], 5);

    expect(results).toHaveLength(1);
    expect(results[0].alsoAt).toEqual(['u2']);
  });

  it('does not list the representative own URL as a sibling when a URL repeats', () => {
    const results = dedupeByContent([hit('body', 'same-url', 9), hit('body', 'same-url', 8)], 5);

    expect(results).toHaveLength(1);
    expect(results[0].alsoAt).toBeUndefined();
  });

  it('leaves sibling parts of one section alone — that is collapseSiblingParts job', () => {
    // These reach the reranker as separate candidates on purpose: narrowing the
    // pool to one chunk per section before reranking measurably cost recall.
    const results = dedupeByContent(
      [hit('part one', 'class-page#page-screenshot', 9), hit('part two', 'class-page#page-screenshot', 8)],
      5
    );

    expect(results).toHaveLength(2);
  });
});

describe('collapseSiblingParts', () => {
  it('keeps one result per section, in the order it was given', () => {
    // What the embedding-window cap produces: one heading section as several
    // overlapping chunks, all citing the same anchor.
    const results = collapseSiblingParts(
      [
        hit('part two of the screenshot options', 'docs/api/class-page#page-screenshot', 9),
        hit('part one of the screenshot options', 'docs/api/class-page#page-screenshot', 8),
        hit('the emulation guide', 'docs/emulation#viewport', 7)
      ],
      5
    );

    expect(results.map((r) => r.sourceUrl)).toEqual(['docs/api/class-page#page-screenshot', 'docs/emulation#viewport']);
    // The caller's ordering decides which part represents the section, so after
    // reranking that is the best-matching part rather than the earliest one.
    expect(results[0].content).toBe('part two of the screenshot options');
  });

  it('fills the requested limit with distinct sections rather than one section parts', () => {
    const hits = [
      hit('a1', 'section-a', 10),
      hit('a2', 'section-a', 9),
      hit('a3', 'section-a', 8),
      hit('b1', 'section-b', 7),
      hit('c1', 'section-c', 6)
    ];

    expect(collapseSiblingParts(hits, 3).map((r) => r.sourceUrl)).toEqual(['section-a', 'section-b', 'section-c']);
  });

  it('preserves alsoAt annotations added by the content pass', () => {
    const withSiblings = { ...hit('body', 'class-page#x', 9), alsoAt: ['class-frame#x'] };
    expect(collapseSiblingParts([withSiblings], 5)[0].alsoAt).toEqual(['class-frame#x']);
  });
});
