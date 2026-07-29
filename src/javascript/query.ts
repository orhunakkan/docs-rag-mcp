import { search } from '@orama/orama';
import { embedText } from '../search/embed.js';
import { dedupeByContent, overfetchLimit } from '../search/dedupe.js';
import { DEFAULT_TUNING, type Tuning } from '../search/tuning.js';
import type { JsDb } from './buildIndex.js';
import type { JsSection } from './types.js';

export interface JsSearchOptions {
  limit?: number;
  section?: JsSection;
  /** Override the committed tuning. Used by scripts/benchmark.ts --sweep. */
  tuning?: Tuning;
}

export interface JsSearchResult {
  id: string;
  score: number;
  title: string;
  headingPath: string;
  content: string;
  section: JsSection;
  sourceUrl: string;
  /** Other URLs carrying byte-identical content, collapsed by dedupeByContent. */
  alsoAt?: string[];
}

export async function hybridSearch(db: JsDb, queryText: string, options: JsSearchOptions = {}): Promise<JsSearchResult[]> {
  const limit = options.limit ?? 5;
  const tuning = options.tuning ?? DEFAULT_TUNING;
  const vector = await embedText(queryText);
  const results = await search(db, {
    mode: 'hybrid',
    term: queryText,
    vector: { value: vector, property: 'embedding' },
    properties: ['title', 'content'],
    boost: { title: tuning.titleBoost },
    // See src/search/tuning.ts for these values and their rationale.
    similarity: tuning.similarity,
    hybridWeights: { text: tuning.text, vector: tuning.vector },
    where: options.section ? { section: { eq: options.section } } : undefined,
    limit: overfetchLimit(limit)
  });

  const hits = results.hits.map((hit) => ({
    id: hit.document.id,
    score: hit.score,
    title: hit.document.title,
    headingPath: hit.document.headingPath,
    content: hit.document.content,
    section: hit.document.section as JsSection,
    sourceUrl: hit.document.sourceUrl
  }));

  return dedupeByContent(hits, limit);
}
