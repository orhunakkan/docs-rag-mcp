import { search } from '@orama/orama';
import { embedText } from '../search/embed.js';
import { dedupeByContent, overfetchLimit } from '../search/dedupe.js';
import type { NodeDb } from './buildIndex.js';

export interface NodeSearchOptions {
  limit?: number;
  module?: string;
}

export interface NodeSearchResult {
  id: string;
  score: number;
  title: string;
  headingPath: string;
  content: string;
  module: string;
  sourceUrl: string;
  /** Other URLs carrying byte-identical content, collapsed by dedupeByContent. */
  alsoAt?: string[];
}

export async function hybridSearch(db: NodeDb, queryText: string, options: NodeSearchOptions = {}): Promise<NodeSearchResult[]> {
  const limit = options.limit ?? 5;
  const vector = await embedText(queryText);
  const results = await search(db, {
    mode: 'hybrid',
    term: queryText,
    vector: { value: vector, property: 'embedding' },
    properties: ['title', 'content'],
    boost: { title: 3 },
    // Same tuning validated for this embedding model against the other three corpora
    // in src/search/query.ts, src/typescript/query.ts, and src/javascript/query.ts.
    similarity: 0.1,
    hybridWeights: { text: 0.3, vector: 0.7 },
    where: options.module ? { module: { eq: options.module } } : undefined,
    limit: overfetchLimit(limit)
  });

  const hits = results.hits.map((hit) => ({
    id: hit.document.id,
    score: hit.score,
    title: hit.document.title,
    headingPath: hit.document.headingPath,
    content: hit.document.content,
    module: hit.document.module as string,
    sourceUrl: hit.document.sourceUrl
  }));

  return dedupeByContent(hits, limit);
}
