import GithubSlugger from 'github-slugger';
import { toString as mdastToString } from 'mdast-util-to-string';
import { remark } from 'remark';
import type { Chunk, DocType, Language } from '../types.js';
import { hasBodyAfterHeading, hasContentBeyondAttribution } from './emptySection.js';
import { resolveHeading, stripSlugComments } from './slugify.js';

export interface ChunkMeta {
  language: Language;
  docType: DocType;
  fileSlug: string;
  sourceUrl: string;
  sourceFile: string;
  playwrightRef: string;
}

interface HeadingBoundary {
  depth: number;
  offset: number;
  headingPath: string[];
  title: string;
  slug: string;
}

/**
 * Chunk boundary = every heading at depth 2 or 3; content before the first
 * such heading becomes an `_intro` chunk. Slices the original markdown
 * string at heading byte offsets (never re-serializes the AST) so code
 * fences/tables survive exactly and a `#`-looking line inside a fenced code
 * block can never be mistaken for a heading.
 */
export function chunkMarkdown(markdown: string, meta: ChunkMeta): Chunk[] {
  const tree = remark().parse(markdown);
  const slugger = new GithubSlugger();
  const boundaries: HeadingBoundary[] = [];
  const stack: Array<string | undefined> = [];

  let docTitle = meta.fileSlug;

  for (const node of tree.children) {
    if (node.type !== 'heading') continue;
    const rawText = mdastToString(node);

    if (node.depth === 1) {
      docTitle = rawText.trim();
      continue;
    }
    if (node.depth > 3) continue;

    const { text, slug } = resolveHeading(rawText, slugger);
    stack[node.depth] = text;
    for (let d = node.depth + 1; d <= 3; d++) stack[d] = undefined;
    const headingPath = [2, 3]
      .filter((d) => d <= node.depth)
      .map((d) => stack[d])
      .filter((v): v is string => Boolean(v));

    boundaries.push({
      depth: node.depth,
      offset: node.position?.start.offset ?? 0,
      headingPath,
      title: text,
      slug
    });
  }

  const chunks: Chunk[] = [];
  const introEnd = boundaries.length > 0 ? boundaries[0].offset : markdown.length;
  const introContent = stripSlugComments(markdown.slice(0, introEnd)).trim();
  if (hasContentBeyondAttribution(introContent)) {
    chunks.push({
      id: `${meta.language}/${meta.docType}/${meta.fileSlug}#_intro`,
      title: docTitle,
      headingPath: [],
      content: introContent,
      language: meta.language,
      docType: meta.docType,
      sourceUrl: meta.sourceUrl,
      sourceFile: meta.sourceFile,
      playwrightRef: meta.playwrightRef
    });
  }

  for (let i = 0; i < boundaries.length; i++) {
    const boundary = boundaries[i];
    const end = i + 1 < boundaries.length ? boundaries[i + 1].offset : markdown.length;
    const content = stripSlugComments(markdown.slice(boundary.offset, end)).trim();
    // Structural headings like `## Methods`, which sit directly above their
    // first `###` with no prose of their own, carry no retrievable content.
    if (!hasBodyAfterHeading(content)) continue;

    chunks.push({
      id: `${meta.language}/${meta.docType}/${meta.fileSlug}#${boundary.slug}`,
      title: boundary.title,
      headingPath: boundary.headingPath,
      content,
      language: meta.language,
      docType: meta.docType,
      sourceUrl: `${meta.sourceUrl}#${boundary.slug}`,
      sourceFile: meta.sourceFile,
      playwrightRef: meta.playwrightRef
    });
  }

  return chunks;
}
