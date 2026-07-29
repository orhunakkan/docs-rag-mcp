import { describe, expect, it } from 'vitest';
import { chunkMarkdown, type ChunkMeta } from '../src/chunk/chunker.js';

const meta: ChunkMeta = {
  language: 'nodejs',
  docType: 'guides',
  fileSlug: 'locators',
  sourceUrl: 'https://playwright.dev/docs/locators',
  sourceFile: 'docs/nodejs/guides/locators.md',
  playwrightRef: 'abc123'
};

describe('chunkMarkdown', () => {
  it('creates an intro chunk for content before the first ##/### heading', () => {
    const markdown = `# Locators\n\nIntro paragraph text.\n\n## Locating elements\n\nBody.\n`;
    const chunks = chunkMarkdown(markdown, meta);

    expect(chunks[0].id).toBe('nodejs/guides/locators#_intro');
    expect(chunks[0].headingPath).toEqual([]);
    expect(chunks[0].content).toContain('Intro paragraph text.');
  });

  it('does not split on a "#"-prefixed line inside a fenced code block', () => {
    const markdown = `# Locators

## Locating elements

Some text about locating.

\`\`\`bash
# this is a comment, not a heading
echo "hello"
\`\`\`

More content after the code fence.

## Next section

Next section body.
`;
    const chunks = chunkMarkdown(markdown, meta);
    const locatingChunk = chunks.find((c) => c.title === 'Locating elements');

    expect(locatingChunk).toBeDefined();
    expect(locatingChunk!.content).toContain('# this is a comment, not a heading');
    expect(locatingChunk!.content).toContain('More content after the code fence.');
    // Only two ## boundaries in the fixture -> exactly two non-intro chunks.
    const nonIntroChunks = chunks.filter((c) => c.headingPath.length > 0 || c.title !== 'Locators');
    expect(nonIntroChunks).toHaveLength(2);
  });

  it('nests H4+ content inside its parent H2/H3 chunk instead of splitting further', () => {
    const markdown = `# Locators

## Locating elements

### Get by role

Locate by role text.

#### Deep subsection

Nested content that should stay inside the "Get by role" chunk.

## Next section

Next body.
`;
    const chunks = chunkMarkdown(markdown, meta);
    const getByRole = chunks.find((c) => c.title === 'Get by role');

    expect(getByRole).toBeDefined();
    expect(getByRole!.headingPath).toEqual(['Locating elements', 'Get by role']);
    expect(getByRole!.content).toContain('#### Deep subsection');
    expect(getByRole!.content).toContain('Nested content that should stay inside the "Get by role" chunk.');
  });

  it('uses an explicit {/* #slug */} comment as the anchor and strips it from the visible title', () => {
    const markdown = `# Browser

## Methods

### bind {/* #browser-bind */}

Binds the browser to a named pipe.
`;
    const chunks = chunkMarkdown(markdown, { ...meta, docType: 'api', fileSlug: 'class-browser' });
    const bindChunk = chunks.find((c) => c.id.endsWith('#browser-bind'));

    expect(bindChunk).toBeDefined();
    expect(bindChunk!.title).toBe('bind');
    expect(bindChunk!.title).not.toContain('{/*');
    expect(bindChunk!.content).not.toContain('{/*');
    expect(bindChunk!.sourceUrl).toBe('https://playwright.dev/docs/locators#browser-bind');
  });

  it('auto-slugifies headings without an explicit comment and dedupes repeated heading text', () => {
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
    expect(new Set(slugs).size).toBe(2);
  });

  it('dedupes two different headings that share the same explicit slug comment', () => {
    // Real upstream quirk: .NET's class-browsercontext.mdx gives two distinct
    // methods the identical explicit anchor slug.
    const markdown = `# BrowserContext

## Methods

### RunAndWaitForConsoleMessageAsync {/* #browser-context-wait-for-console-message */}

First method.

### WaitForConsoleMessageAsync {/* #browser-context-wait-for-console-message */}

Second method.
`;
    const chunks = chunkMarkdown(markdown, { ...meta, docType: 'api', fileSlug: 'class-browsercontext' });
    const ids = chunks.map((c) => c.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('nodejs/api/class-browsercontext#browser-context-wait-for-console-message');
    expect(ids).toContain('nodejs/api/class-browsercontext#browser-context-wait-for-console-message-1');
  });

  it('drops a structural heading whose section body is empty (e.g. api "## Methods" above its first ###)', () => {
    const markdown = `# Page

## Methods

### locator {/* #page-locator */}

Returns a locator.
`;
    const chunks = chunkMarkdown(markdown, { ...meta, docType: 'api', fileSlug: 'class-page' });

    expect(chunks.some((c) => c.title === 'Methods')).toBe(false);
    expect(chunks.some((c) => c.title === 'locator')).toBe(true);
  });

  it('drops a heading whose body is only whitespace', () => {
    const markdown = `# Page\n\n## Events\n\n   \n\n## Real section\n\nBody text.\n`;
    const chunks = chunkMarkdown(markdown, meta);

    expect(chunks.some((c) => c.title === 'Events')).toBe(false);
    expect(chunks.some((c) => c.title === 'Real section')).toBe(true);
  });

  it('keeps a heading whose body is only a code fence, with no prose', () => {
    const markdown = `# Page

## Usage

\`\`\`js
await page.locator('#id').click();
\`\`\`
`;
    const chunks = chunkMarkdown(markdown, meta);
    const usage = chunks.find((c) => c.title === 'Usage');

    expect(usage).toBeDefined();
    expect(usage!.content).toContain("await page.locator('#id').click();");
  });

  it('keeps a heading whose body is a single short sentence', () => {
    const markdown = `# Page\n\n## Returns\n\nA Locator.\n`;
    const chunks = chunkMarkdown(markdown, meta);

    expect(chunks.some((c) => c.title === 'Returns')).toBe(true);
  });

  it('drops a section left empty once its explicit slug comment is stripped', () => {
    // stripSlugComments runs before the empty check, so a body consisting only
    // of a Docusaurus slug comment must not read as content.
    const markdown = `# Page\n\n## Methods {/* #page-methods */}\n\n{/* #stray */}\n\n## Real\n\nBody.\n`;
    const chunks = chunkMarkdown(markdown, { ...meta, docType: 'api', fileSlug: 'class-page' });

    expect(chunks.some((c) => c.title === 'Methods')).toBe(false);
    expect(chunks.some((c) => c.title === 'Real')).toBe(true);
  });

  it('produces distinct ids for the same docType/fileSlug/heading across languages', () => {
    const markdown = `# Page\n\n## Methods\n\n### locator {/* #page-locator */}\n\nReturns a locator.\n`;
    const nodejsMeta: ChunkMeta = { ...meta, language: 'nodejs', docType: 'api', fileSlug: 'class-page' };
    const pythonMeta: ChunkMeta = { ...meta, language: 'python', docType: 'api', fileSlug: 'class-page' };

    const nodejsChunk = chunkMarkdown(markdown, nodejsMeta).find((c) => c.id.endsWith('#page-locator'));
    const pythonChunk = chunkMarkdown(markdown, pythonMeta).find((c) => c.id.endsWith('#page-locator'));

    expect(nodejsChunk).toBeDefined();
    expect(pythonChunk).toBeDefined();
    expect(nodejsChunk!.id).not.toBe(pythonChunk!.id);
    expect(nodejsChunk!.id).toBe('nodejs/api/class-page#page-locator');
    expect(pythonChunk!.id).toBe('python/api/class-page#page-locator');
  });
});
