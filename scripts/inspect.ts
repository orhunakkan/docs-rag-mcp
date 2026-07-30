/**
 * Dumps the top-N results for benchmark queries, or for an ad-hoc query, so a
 * label can be judged against what the corpus actually contains.
 *
 * This exists because `scripts/benchmark.ts` only reports whether a label
 * matched. When a label is *wrong* — the right page under a URL the label
 * doesn't name — the benchmark reports a failure indistinguishable from a
 * retrieval failure, and the only way to tell them apart is to look at the
 * results and read the pages.
 *
 *   npm run inspect                       # every benchmark query
 *   npm run inspect -- typescript         # one corpus
 *   npm run inspect -- --q pw 'a query'   # ad-hoc; corpus is pw|ts|js|nd
 *
 * `TOPN` (default 6) sets how deep to print; `LANG` sets the Playwright
 * language filter for ad-hoc queries.
 */
import { loadIndex as loadPw } from '../src/search/buildIndex.js';
import { hybridSearch as pwSearch } from '../src/search/query.js';
import { loadIndex as loadTs } from '../src/typescript/buildIndex.js';
import { hybridSearch as tsSearch } from '../src/typescript/query.js';
import { loadIndex as loadJs } from '../src/javascript/buildIndex.js';
import { hybridSearch as jsSearch } from '../src/javascript/query.js';
import { loadIndex as loadNode } from '../src/node/buildIndex.js';
import { hybridSearch as nodeSearch } from '../src/node/query.js';
import type { Language } from '../src/types.js';
import {
  javascriptQueries,
  matchesLabel,
  nodeQueries,
  playwrightQueries,
  typescriptQueries,
  type BenchmarkQuery
} from '../tests/fixtures/benchmark-queries.js';

const N = Number(process.env.TOPN ?? 6);

interface Row {
  sourceUrl: string;
  title: string;
  headingPath: string;
  score: number;
}

async function adhoc(corpus: string, query: string): Promise<void> {
  const language = (process.env.LANG as Language | undefined) ?? 'nodejs';
  const rows: Row[] =
    corpus === 'pw'
      ? await pwSearch(await loadPw(), query, { limit: N, language })
      : corpus === 'ts'
        ? await tsSearch(await loadTs(), query, { limit: N })
        : corpus === 'js'
          ? await jsSearch(await loadJs(), query, { limit: N })
          : await nodeSearch(await loadNode(), query, { limit: N });

  console.log(`\n"${query}" [${corpus}]`);
  rows.forEach((r, i) => console.log(`  ${i + 1}. ${r.score.toFixed(3)}  ${r.sourceUrl}\n       ${r.title} | ${r.headingPath}`));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const adhocAt = args.indexOf('--q');
  if (adhocAt !== -1) {
    await adhoc(args[adhocAt + 1], args.slice(adhocAt + 2).join(' '));
    return;
  }

  const only = args[0];
  const corpora: Array<[string, BenchmarkQuery[], (q: BenchmarkQuery) => Promise<Row[]>]> = [];

  if (!only || only === 'playwright') {
    const db = await loadPw();
    corpora.push([
      'playwright',
      playwrightQueries,
      (q) => pwSearch(db, q.query, { limit: N, language: q.language, docType: q.docType })
    ]);
  }
  if (!only || only === 'typescript') {
    const db = await loadTs();
    corpora.push(['typescript', typescriptQueries, (q) => tsSearch(db, q.query, { limit: N })]);
  }
  if (!only || only === 'javascript') {
    const db = await loadJs();
    corpora.push(['javascript', javascriptQueries, (q) => jsSearch(db, q.query, { limit: N })]);
  }
  if (!only || only === 'node') {
    const db = await loadNode();
    corpora.push(['node-runtime', nodeQueries, (q) => nodeSearch(db, q.query, { limit: N })]);
  }

  for (const [name, queries, run] of corpora) {
    console.log(`\n\n======== ${name} ========`);
    for (const q of queries) {
      const rows = await run(q);
      const rank = rows.findIndex((r) => matchesLabel(r.sourceUrl, q.expect)) + 1;
      console.log(`\n[${q.id}] "${q.query}"  expect=${JSON.stringify(q.expect)}  rank=${rank || 'MISS'}`);
      rows.forEach((r, i) => console.log(`  ${matchesLabel(r.sourceUrl, q.expect) ? '*' : ' '}${i + 1}. ${r.sourceUrl}`));
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
