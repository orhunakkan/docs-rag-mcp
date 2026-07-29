import GithubSlugger from 'github-slugger';
import { toString as mdastToString } from 'mdast-util-to-string';
import { remark } from 'remark';
import { hasBodyAfterHeading } from '../chunk/emptySection.js';
import type { TsChunk, TsSection } from './types.js';

export interface TsChunkMeta {
  section: TsSection;
  fileSlug: string;
  sourceUrl: string;
  sourceFile: string;
  sourceRef: string;
}

interface HeadingBoundary {
  depth: number;
  offset: number;
  headingPath: string[];
  title: string;
  slug: string;
}

/**
 * Same heading-offset-slicing approach as src/chunk/chunker.ts (chunk
 * boundary = every heading at depth 2 or 3, sliced from the original string
 * so code fences/tables survive exactly). Simpler than the Playwright
 * version: TypeScript's docs have no Docusaurus explicit-slug comments, so
 * every heading is auto-slugified via github-slugger.
 */
export function chunkMarkdown(markdown: string, meta: TsChunkMeta): TsChunk[] {
  const tree = remark().parse(markdown);
  const slugger = new GithubSlugger();
  const boundaries: HeadingBoundary[] = [];
  const stack: Array<string | undefined> = [];

  let docTitle = meta.fileSlug;

  for (const node of tree.children) {
    if (node.type !== 'heading') continue;
    const rawText = mdastToString(node).trim();

    if (node.depth === 1) {
      docTitle = rawText;
      continue;
    }
    if (node.depth > 3) continue;

    const slug = slugger.slug(rawText);
    stack[node.depth] = rawText;
    for (let d = node.depth + 1; d <= 3; d++) stack[d] = undefined;
    const headingPath = [2, 3]
      .filter((d) => d <= node.depth)
      .map((d) => stack[d])
      .filter((v): v is string => Boolean(v));

    boundaries.push({
      depth: node.depth,
      offset: node.position?.start.offset ?? 0,
      headingPath,
      title: rawText,
      slug
    });
  }

  const chunks: TsChunk[] = [];
  const introEnd = boundaries.length > 0 ? boundaries[0].offset : markdown.length;
  const introContent = markdown.slice(0, introEnd).trim();
  if (introContent.length > 0) {
    chunks.push({
      id: `typescript/${meta.section}/${meta.fileSlug}#_intro`,
      title: docTitle,
      headingPath: [],
      content: introContent,
      section: meta.section,
      sourceUrl: meta.sourceUrl,
      sourceFile: meta.sourceFile,
      sourceRef: meta.sourceRef
    });
  }

  for (let i = 0; i < boundaries.length; i++) {
    const boundary = boundaries[i];
    const end = i + 1 < boundaries.length ? boundaries[i + 1].offset : markdown.length;
    const content = markdown.slice(boundary.offset, end).trim();
    if (!hasBodyAfterHeading(content)) continue;

    chunks.push({
      id: `typescript/${meta.section}/${meta.fileSlug}#${boundary.slug}`,
      title: boundary.title,
      headingPath: boundary.headingPath,
      content,
      section: meta.section,
      sourceUrl: `${meta.sourceUrl}#${boundary.slug}`,
      sourceFile: meta.sourceFile,
      sourceRef: meta.sourceRef
    });
  }

  return chunks;
}
