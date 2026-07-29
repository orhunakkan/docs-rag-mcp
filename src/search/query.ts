import { search } from '@orama/orama';
import type { Db } from './buildIndex.js';
import { embedText } from './embed.js';
import { dedupeByContent, overfetchLimit } from './dedupe.js';
import { DEFAULT_TUNING, type Tuning } from './tuning.js';
import type { DocType, Language } from '../types.js';

export interface SearchOptions {
  limit?: number;
  docType?: DocType;
  language?: Language;
  /** Override the committed tuning. Used by scripts/benchmark.ts --sweep. */
  tuning?: Tuning;
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
  const tuning = options.tuning ?? DEFAULT_TUNING;
  const vector = await embedText(queryText);
  const where: Record<string, { eq: string }> = {};
  if (options.docType) where.docType = { eq: options.docType };
  if (options.language) where.language = { eq: options.language };

  const results = await search(db, {
    mode: 'hybrid',
    term: queryText,
    vector: { value: vector, property: 'embedding' },
    properties: ['title', 'content'],
    boost: { title: tuning.titleBoost },
    // See src/search/tuning.ts for what these are and why they differ so far
    // from Orama's defaults; scripts/benchmark.ts is what justifies changing them.
    similarity: tuning.similarity,
    hybridWeights: { text: tuning.text, vector: tuning.vector },
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
