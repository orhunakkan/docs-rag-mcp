import { search } from '@orama/orama';
import type { Db } from './buildIndex.js';
import { embedText } from './embed.js';
import { dedupeByContent, overfetchLimit } from './dedupe.js';
import type { DocType, Language } from '../types.js';

export interface SearchOptions {
  limit?: number;
  docType?: DocType;
  language?: Language;
}

export interface SearchResult {
  id: string;
  score: number;
  title: string;
  headingPath: string;
  content: string;
  language: Language;
  docType: DocType;
  sourceUrl: string;
  /** Other URLs carrying byte-identical content, collapsed by dedupeByContent. */
  alsoAt?: string[];
}

export async function hybridSearch(db: Db, queryText: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  const limit = options.limit ?? 5;
  const vector = await embedText(queryText);
  const where: Record<string, { eq: string }> = {};
  if (options.docType) where.docType = { eq: options.docType };
  if (options.language) where.language = { eq: options.language };

  const results = await search(db, {
    mode: 'hybrid',
    term: queryText,
    vector: { value: vector, property: 'embedding' },
    properties: ['title', 'content'],
    boost: { title: 3 },
    // Orama's default vector similarity cutoff (0.8) is tuned for larger
    // embedding models and silently drops every result for short-text
    // MiniLM embeddings, degenerating "hybrid" into plain keyword search.
    // Lowered + rebalanced toward vector after empirically checking real
    // queries against this corpus (see docs/ideas/playwright-rag-docs-mvp.md).
    similarity: 0.1,
    hybridWeights: { text: 0.3, vector: 0.7 },
    where: Object.keys(where).length > 0 ? where : undefined,
    // Over-fetch so collapsing identical content can't return fewer than `limit`.
    limit: overfetchLimit(limit)
  });

  const hits = results.hits.map((hit) => ({
    id: hit.document.id,
    score: hit.score,
    title: hit.document.title,
    headingPath: hit.document.headingPath,
    content: hit.document.content,
    language: hit.document.language as Language,
    docType: hit.document.docType as DocType,
    sourceUrl: hit.document.sourceUrl
  }));

  return dedupeByContent(hits, limit);
}
