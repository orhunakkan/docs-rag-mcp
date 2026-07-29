import { describe, expect, it } from 'vitest';
import { chunkMarkdown, type TsChunkMeta } from '../src/typescript/chunker.js';

const meta: TsChunkMeta = {
  section: 'handbook-v2',
  fileSlug: 'basics',
  sourceUrl: 'https://www.typescriptlang.org/docs/handbook/2/basic-types.html',
  sourceFile: 'docs/typescript/handbook-v2/basics.md',
  sourceRef: 'abc123'
};

describe('typescript chunkMarkdown', () => {
  it('drops a heading with no body of its own but keeps one holding only a code fence', () => {
    const markdown = `# Generics

## Overview

### Type parameters

Body text about type parameters.

## Example

\`\`\`ts
function identity<T>(arg: T): T { return arg; }
\`\`\`
`;
    const chunks = chunkMarkdown(markdown, meta);

    expect(chunks.some((c) => c.title === 'Overview')).toBe(false);
    expect(chunks.some((c) => c.title === 'Type parameters')).toBe(true);
    const example = chunks.find((c) => c.title === 'Example');
    expect(example).toBeDefined();
    expect(example!.content).toContain('function identity<T>');
  });

  it('creates an intro chunk for content before the first ##/### heading', () => {
    const markdown = `# The Basics\n\nIntro paragraph text.\n\n## Static type-checking\n\nBody.\n`;
    const chunks = chunkMarkdown(markdown, meta);

    expect(chunks[0].id).toBe('typescript/handbook-v2/basics#_intro');
    expect(chunks[0].headingPath).toEqual([]);
    expect(chunks[0].content).toContain('Intro paragraph text.');
  });

  it('does not split on a "#"-prefixed line inside a fenced code block', () => {
    const markdown = `# The Basics

## Static type-checking

Some text about type-checking.

\`\`\`js
# this is not a real heading
const x = 1;
\`\`\`

More content after the code fence.

## Next section

Next section body.
`;
    const chunks = chunkMarkdown(markdown, meta);
    const section = chunks.find((c) => c.title === 'Static type-checking');

    expect(section).toBeDefined();
    expect(section!.content).toContain('# this is not a real heading');
    expect(section!.content).toContain('More content after the code fence.');
  });

  it('nests H4+ content inside its parent H2/H3 chunk instead of splitting further', () => {
    const markdown = `# Generics

## Working with Generic Type Variables

### Generic Constraints

Explains constraints.

#### An example

Nested content that should stay inside the "Generic Constraints" chunk.

## Next section

Next body.
`;
    const chunks = chunkMarkdown(markdown, meta);
    const constraints = chunks.find((c) => c.title === 'Generic Constraints');

    expect(constraints).toBeDefined();
    expect(constraints!.headingPath).toEqual(['Working with Generic Type Variables', 'Generic Constraints']);
    expect(constraints!.content).toContain('#### An example');
  });

  it('auto-slugifies every heading (no explicit-slug comments in this corpus) and dedupes repeats', () => {
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
    const markdown = `# Enums\n\n## Numeric enums\n\nBody.\n`;
    const byTitle = (chunks: ReturnType<typeof chunkMarkdown>) => chunks.find((c) => c.title === 'Numeric enums')!;
    const handbookChunk = byTitle(chunkMarkdown(markdown, { ...meta, section: 'handbook-v2', fileSlug: 'enums' }));
    const referenceChunk = byTitle(chunkMarkdown(markdown, { ...meta, section: 'reference', fileSlug: 'enums' }));

    expect(handbookChunk.id).toBe('typescript/handbook-v2/enums#numeric-enums');
    expect(referenceChunk.id).toBe('typescript/reference/enums#numeric-enums');
    expect(handbookChunk.id).not.toBe(referenceChunk.id);
  });
});
