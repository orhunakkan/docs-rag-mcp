import { describe, expect, it } from 'vitest';
import { chunkMarkdown, type NodeChunkMeta } from '../src/node/chunker.js';

const meta: NodeChunkMeta = {
  module: 'fs',
  sourceUrl: 'https://nodejs.org/docs/v24.18.0/api/fs.html',
  sourceFile: 'docs/node-runtime/api/fs.md',
  sourceRef: 'abc123'
};

describe('node chunkMarkdown', () => {
  it('creates an intro chunk for content before the first heading', () => {
    const markdown = `# File system\n\n> Stability: 2 - Stable\n\n## Promise example\n\nBody.\n`;
    const chunks = chunkMarkdown(markdown, meta);

    expect(chunks[0].id).toBe('node/fs#_intro');
    expect(chunks[0].headingPath).toEqual([]);
    expect(chunks[0].content).toContain('Stability: 2 - Stable');
  });

  it('does not split on a "#"-prefixed line inside a fenced code block', () => {
    const markdown = `# File system

## Promise example

Some text.

\`\`\`js
# this is not a real heading
const x = 1;
\`\`\`

More content after the code fence.

## Callback example

Next section body.
`;
    const chunks = chunkMarkdown(markdown, meta);
    const section = chunks.find((c) => c.title === 'Promise example');

    expect(section).toBeDefined();
    expect(section!.content).toContain('# this is not a real heading');
    expect(section!.content).toContain('More content after the code fence.');
  });

  it('tracks headingPath through H2-H5 (module -> class -> event)', () => {
    const markdown = `# Stream

## API for stream consumers

#### Class: \`stream.Writable\`

##### Event: 'close'

The close event body.
`;
    const chunks = chunkMarkdown(markdown, meta);
    const closeEvent = chunks.find((c) => c.title === "Event: 'close'");

    expect(closeEvent).toBeDefined();
    expect(closeEvent!.headingPath).toEqual(['API for stream consumers', 'Class: stream.Writable', "Event: 'close'"]);
  });

  it('skips headings past depth 5', () => {
    const markdown = `# Module\n\n## Section\n\n###### Too deep\n\nShould not appear as its own chunk.\n`;
    const chunks = chunkMarkdown(markdown, meta);

    expect(chunks.some((c) => c.title === 'Too deep')).toBe(false);
  });

  it('auto-slugifies every heading and dedupes repeats', () => {
    const markdown = `# fs

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

  it('namespaces ids and source URLs by module', () => {
    const markdown = `# Module\n\n## Section\n\nBody.\n`;
    const byTitle = (chunks: ReturnType<typeof chunkMarkdown>) => chunks.find((c) => c.title === 'Section')!;
    const fsChunk = byTitle(chunkMarkdown(markdown, { ...meta, module: 'fs' }));
    const httpChunk = byTitle(
      chunkMarkdown(markdown, { ...meta, module: 'http', sourceUrl: 'https://nodejs.org/docs/v24.18.0/api/http.html' })
    );

    expect(fsChunk.id).toBe('node/fs#section');
    expect(httpChunk.id).toBe('node/http#section');
    expect(fsChunk.sourceUrl).toBe('https://nodejs.org/docs/v24.18.0/api/fs.html#section');
    expect(httpChunk.sourceUrl).toBe('https://nodejs.org/docs/v24.18.0/api/http.html#section');
  });

  it('skips a heading section left empty (e.g. a YAML-only block stripped down to nothing)', () => {
    const markdown = `# fs

## Real section

Real prose here.

## Empty section

## Next section

More content.
`;
    const chunks = chunkMarkdown(markdown, meta);

    expect(chunks.some((c) => c.title === 'Empty section')).toBe(false);
    expect(chunks.some((c) => c.title === 'Next section')).toBe(true);
  });
});
