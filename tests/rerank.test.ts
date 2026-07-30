import { describe, expect, it } from 'vitest';
import { pairText, rerank } from '../src/search/rerank.js';
import { embedPrefix } from '../src/search/embed.js';

const result = (over: Partial<Parameters<typeof pairText>[0]> = {}) => ({
  score: 1,
  title: 'screenshot',
  headingPath: 'Methods',
  content: 'Returns the buffer with the captured screenshot.',
  ...over
});

describe('pairText', () => {
  it('puts the heading context in front of the body', () => {
    expect(pairText(result())).toBe('screenshot > Methods: Returns the buffer with the captured screenshot.');
  });

  it('omits an empty heading path rather than emitting a dangling separator', () => {
    expect(pairText(result({ headingPath: '' }))).toBe('screenshot: Returns the buffer with the captured screenshot.');
  });

  it('does not repeat the title when the heading path is just the title', () => {
    expect(pairText(result({ headingPath: 'screenshot' }))).toBe('screenshot: Returns the buffer with the captured screenshot.');
  });

  it('composes the pair the same way the embedded text is composed', () => {
    // Not required to match, but a divergence would mean the reranker judges
    // documents by a different description than the one they were indexed under.
    const chunk = { title: 'screenshot', headingPath: ['Methods'], content: 'Body.' };
    expect(pairText({ score: 0, title: chunk.title, headingPath: chunk.headingPath.join(' > '), content: chunk.content })).toBe(
      embedPrefix(chunk.title, chunk.headingPath) + chunk.content
    );
  });
});

describe('rerank', () => {
  // These two cases return before touching the model, which is what makes them
  // runnable in CI with no download.
  it('returns a single candidate untouched, without loading the model', async () => {
    const one = [result()];
    await expect(rerank('anything', one)).resolves.toBe(one);
  });

  it('returns an empty candidate list untouched', async () => {
    const none: ReturnType<typeof result>[] = [];
    await expect(rerank('anything', none)).resolves.toBe(none);
  });
});
