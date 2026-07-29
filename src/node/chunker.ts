import GithubSlugger from 'github-slugger';
import { toString as mdastToString } from 'mdast-util-to-string';
import { remark } from 'remark';
import { hasBodyAfterHeading } from '../chunk/emptySection.js';
import type { NodeChunk } from './types.js';

export interface NodeChunkMeta {
  module: string;
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

const MAX_DEPTH = 5;
const HEADING_DEPTHS = [2, 3, 4, 5];

/**
 * Same heading-offset-slicing approach as src/typescript/chunker.ts and
 * src/javascript/chunker.ts. One difference: doc/api/*.md nests up to H5
 * (module -> "Class: stream.Writable" -> "Event: 'close'"), not just H2/H3,
 * so every heading through depth 5 is a chunk boundary and headingPath tracks
 * all four levels instead of two.
 */
export function chunkMarkdown(markdown: string, meta: NodeChunkMeta): NodeChunk[] {
  const tree = remark().parse(markdown);
  const slugger = new GithubSlugger();
  const boundaries: HeadingBoundary[] = [];
  const stack: Array<string | undefined> = [];

  let docTitle = meta.module;

  for (const node of tree.children) {
    if (node.type !== 'heading') continue;
    const rawText = mdastToString(node).trim();

    if (node.depth === 1) {
      docTitle = rawText;
      continue;
    }
    if (node.depth > MAX_DEPTH) continue;

    const slug = slugger.slug(rawText);
    stack[node.depth] = rawText;
    for (let d = node.depth + 1; d <= MAX_DEPTH; d++) stack[d] = undefined;
    const headingPath = HEADING_DEPTHS.filter((d) => d <= node.depth)
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

  const chunks: NodeChunk[] = [];
  const introEnd = boundaries.length > 0 ? boundaries[0].offset : markdown.length;
  const introContent = markdown.slice(0, introEnd).trim();
  if (introContent.length > 0) {
    chunks.push({
      id: `node/${meta.module}#_intro`,
      title: docTitle,
      headingPath: [],
      content: introContent,
      module: meta.module,
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
      id: `node/${meta.module}#${boundary.slug}`,
      title: boundary.title,
      headingPath: boundary.headingPath,
      content,
      module: meta.module,
      sourceUrl: `${meta.sourceUrl}#${boundary.slug}`,
      sourceFile: meta.sourceFile,
      sourceRef: meta.sourceRef
    });
  }

  return chunks;
}
