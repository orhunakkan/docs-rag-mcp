import { search } from '@orama/orama';
import { embedText } from '../search/embed.js';
import { dedupeByContent, overfetchLimit } from '../search/dedupe.js';
import type { TsDb } from './buildIndex.js';
import type { TsSection } from './types.js';

export interface TsSearchOptions {
  limit?: number;
  section?: TsSection;
}

export interface TsSearchResult {
  id: string;
  score: number;
  title: string;
  headingPath: string;
  content: string;
  section: TsSection;
  sourceUrl: string;
  /** Other URLs carrying byte-identical content, collapsed by dedupeByContent. */
  alsoAt?: string[];
}

export async function hybridSearch(db: TsDb, queryText: string, options: TsSearchOptions = {}): Promise<TsSearchResult[]> {
  const limit = options.limit ?? 5;
  const vector = await embedText(queryText);
  const results = await search(db, {
    mode: 'hybrid',
    term: queryText,
    vector: { value: vector, property: 'embedding' },
    properties: ['title', 'content'],
    boost: { title: 3 },
    // Same tuning validated for this embedding model against Playwright's
    // corpus in src/search/query.ts — Orama's default similarity cutoff
    // (0.8) is too strict for MiniLM's short-text embeddings.
    similarity: 0.1,
    hybridWeights: { text: 0.3, vector: 0.7 },
    where: options.section ? { section: { eq: options.section } } : undefined,
    limit: overfetchLimit(limit)
  });

  const hits = results.hits.map((hit) => ({
    id: hit.document.id,
    score: hit.score,
    title: hit.document.title,
    headingPath: hit.document.headingPath,
    content: hit.document.content,
    section: hit.document.section as TsSection,
    sourceUrl: hit.document.sourceUrl
  }));

  return dedupeByContent(hits, limit);
}
