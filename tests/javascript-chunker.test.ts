import { describe, expect, it } from 'vitest';
import { chunkMarkdown, type JsChunkMeta } from '../src/javascript/chunker.js';

const meta: JsChunkMeta = {
  section: 'reference',
  fileSlug: 'global_objects-array',
  sourceUrl: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array',
  sourceFile: 'docs/javascript/reference/global_objects-array.md',
  sourceRef: 'abc123'
};

describe('javascript chunkMarkdown', () => {
  it('creates an intro chunk for content before the first ##/### heading', () => {
    const markdown = `# Array\n\nIntro paragraph text.\n\n## Description\n\nBody.\n`;
    const chunks = chunkMarkdown(markdown, meta);

    expect(chunks[0].id).toBe('javascript/reference/global_objects-array#_intro');
    expect(chunks[0].headingPath).toEqual([]);
    expect(chunks[0].content).toContain('Intro paragraph text.');
  });

  it('does not split on a "#"-prefixed line inside a fenced code block', () => {
    const markdown = `# Array

## Description

Some text about arrays.

\`\`\`js
# this is not a real heading
const x = 1;
\`\`\`

More content after the code fence.

## Next section

Next section body.
`;
    const chunks = chunkMarkdown(markdown, meta);
    const section = chunks.find((c) => c.title === 'Description');

    expect(section).toBeDefined();
    expect(section!.content).toContain('# this is not a real heading');
    expect(section!.content).toContain('More content after the code fence.');
  });

  it('nests H4+ content inside its parent H2/H3 chunk instead of splitting further', () => {
    const markdown = `# Array

## Instance methods

### at()

Explains at().

#### Examples

Nested content that should stay inside the "at()" chunk.

## Next section

Next body.
`;
    const chunks = chunkMarkdown(markdown, meta);
    const at = chunks.find((c) => c.title === 'at()');

    expect(at).toBeDefined();
    expect(at!.headingPath).toEqual(['Instance methods', 'at()']);
    expect(at!.content).toContain('#### Examples');
  });

  it('auto-slugifies every heading and dedupes repeats', () => {
    const markdown = `# Page

## Overview

First overview section.

## Overview

Second overview section with the same heading text.
`;
    const chunks = chunkMarkdown(markdown, meta);
    const overviewChunks = chunks.filter((c) => c.title === 'Overview');

    expect(overviewChunks).toHaveLength(2);
    const slugs = overviewChunks.map((c) => c.id.split('#')[1]);
    expect(slugs).toEqual(['overview', 'overview-1']);
  });

  it('namespaces ids by section so the same fileSlug in different sections never collides', () => {
    const markdown = `# Closures\n\n## Lexical scoping\n\nBody.\n`;
    const byTitle = (chunks: ReturnType<typeof chunkMarkdown>) => chunks.find((c) => c.title === 'Lexical scoping')!;
    const guideChunk = byTitle(chunkMarkdown(markdown, { ...meta, section: 'guide', fileSlug: 'closures' }));
    const referenceChunk = byTitle(chunkMarkdown(markdown, { ...meta, section: 'reference', fileSlug: 'closures' }));

    expect(guideChunk.id).toBe('javascript/guide/closures#lexical-scoping');
    expect(referenceChunk.id).toBe('javascript/reference/closures#lexical-scoping');
    expect(guideChunk.id).not.toBe(referenceChunk.id);
  });

  it('skips a heading section left empty by macro stripping (e.g. MDN\'s Specifications/Browser compatibility widgets)', () => {
    const markdown = `# Array

## Description

Real prose here.

## Specifications

## Browser compatibility

## See also

- A real related link.
`;
    const chunks = chunkMarkdown(markdown, meta);

    expect(chunks.some((c) => c.title === 'Specifications')).toBe(false);
    expect(chunks.some((c) => c.title === 'Browser compatibility')).toBe(false);
    expect(chunks.some((c) => c.title === 'See also')).toBe(true);
  });
});
