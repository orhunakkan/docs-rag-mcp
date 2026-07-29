/**
 * Retrieval benchmark. Reports recall@1/@3/@5 and MRR per corpus, split by
 * query kind so a regression on verbose identifier queries can't hide behind
 * strong terse ones.
 *
 *   npm run benchmark              # score the committed tuning
 *   npm run benchmark -- --sweep   # grid over hybridWeights x similarity
 *
 * The sweep exists because the committed `hybridWeights` / `similarity` were
 * set by spot-checking, and this is the measurement that should justify any
 * change to them.
 */
import { loadIndex as loadPw } from '../src/search/buildIndex.js';
import { hybridSearch as pwSearch } from '../src/search/query.js';
import { loadIndex as loadTs } from '../src/typescript/buildIndex.js';
import { hybridSearch as tsSearch } from '../src/typescript/query.js';
import { loadIndex as loadJs } from '../src/javascript/buildIndex.js';
import { hybridSearch as jsSearch } from '../src/javascript/query.js';
import { loadIndex as loadNode } from '../src/node/buildIndex.js';
import { hybridSearch as nodeSearch } from '../src/node/query.js';
import type { Tuning } from '../src/search/tuning.js';
import { DEFAULT_TUNING } from '../src/search/tuning.js';
import {
  javascriptQueries,
  nodeQueries,
  playwrightQueries,
  typescriptQueries,
  type BenchmarkQuery
} from '../tests/fixtures/benchmark-queries.js';

const LIMIT = 5;

interface Scored {
  query: BenchmarkQuery;
  /** 1-based rank of the first correct hit, or 0 if absent from the top LIMIT. */
  rank: number;
  top: string;
}

interface Metrics {
  n: number;
  recall1: number;
  recall3: number;
  recall5: number;
  mrr: number;
}

function score(rows: Scored[]): Metrics {
  const n = rows.length;
  if (n === 0) return { n: 0, recall1: 0, recall3: 0, recall5: 0, mrr: 0 };
  const within = (k: number) => rows.filter((r) => r.rank > 0 && r.rank <= k).length / n;
  return {
    n,
    recall1: within(1),
    recall3: within(3),
    recall5: within(5),
    mrr: rows.reduce((a, r) => a + (r.rank > 0 ? 1 / r.rank : 0), 0) / n
  };
}

const pct = (v: number) => `${(v * 100).toFixed(0)}%`.padStart(4);

type Runner = (query: string, opts: Record<string, unknown>, tuning: Tuning) => Promise<Array<{ sourceUrl: string; title: string }>>;

async function runCorpus(name: string, queries: BenchmarkQuery[], run: Runner, tuning: Tuning): Promise<Scored[]> {
  const rows: Scored[] = [];
  for (const q of queries) {
    const results = await run(q.query, { limit: LIMIT, language: q.language, docType: q.docType }, tuning);
    const wanted = (Array.isArray(q.expect) ? q.expect : [q.expect]).map((e) => e.toLowerCase());
    const idx = results.findIndex((r) => wanted.some((w) => r.sourceUrl.toLowerCase().includes(w)));
    rows.push({ query: q, rank: idx === -1 ? 0 : idx + 1, top: results[0]?.title ?? '(none)' });
  }
  return rows;
}

function reportCorpus(name: string, rows: Scored[]): void {
  const terse = rows.filter((r) => !r.query.pairOf && !r.query.id.includes('-nl-'));
  const verbose = rows.filter((r) => r.query.pairOf);
  const natural = rows.filter((r) => r.query.id.includes('-nl-'));

  console.log(`\n${name}`);
  console.log('  group              n   r@1   r@3   r@5    MRR');
  for (const [label, group] of [
    ['all', rows],
    ['identifier (terse)', terse],
    ['identifier (verbose)', verbose],
    ['natural language', natural]
  ] as const) {
    if (group.length === 0) continue;
    const m = score(group);
    console.log(
      `  ${label.padEnd(20)} ${String(m.n).padStart(2)}  ${pct(m.recall1)}  ${pct(m.recall3)}  ${pct(m.recall5)}  ${m.mrr.toFixed(3)}`
    );
  }

  const misses = rows.filter((r) => r.rank === 0);
  if (misses.length > 0) {
    console.log(`  misses (not in top ${LIMIT}):`);
    for (const m of misses) console.log(`    ${m.query.id.padEnd(30)} "${m.query.query}"  -> got "${m.top}"`);
  }
}

async function main() {
  const sweep = process.argv.includes('--sweep');

  const [pwDb, tsDb, jsDb, ndDb] = [await loadPw(), await loadTs(), await loadJs(), await loadNode()];

  const corpora: Array<[string, BenchmarkQuery[], Runner]> = [
    ['playwright', playwrightQueries, (q, o, t) => pwSearch(pwDb, q, { ...o, tuning: t } as any)],
    ['typescript', typescriptQueries, (q, o, t) => tsSearch(tsDb, q, { limit: o.limit as number, tuning: t } as any)],
    ['javascript', javascriptQueries, (q, o, t) => jsSearch(jsDb, q, { limit: o.limit as number, tuning: t } as any)],
    ['node-runtime', nodeQueries, (q, o, t) => nodeSearch(ndDb, q, { limit: o.limit as number, tuning: t } as any)]
  ];

  if (!sweep) {
    console.log(`Committed tuning: text ${DEFAULT_TUNING.text} / vector ${DEFAULT_TUNING.vector}, similarity ${DEFAULT_TUNING.similarity}`);
    const all: Scored[] = [];
    for (const [name, queries, run] of corpora) {
      const rows = await runCorpus(name, queries, run, DEFAULT_TUNING);
      reportCorpus(name, rows);
      all.push(...rows);
    }
    const overall = score(all);
    console.log(
      `\nOVERALL  n=${overall.n}  r@1 ${pct(overall.recall1)}  r@3 ${pct(overall.recall3)}  r@5 ${pct(overall.recall5)}  MRR ${overall.mrr.toFixed(3)}`
    );
    return;
  }

  const grid: Tuning[] = [];
  for (const text of [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]) {
    for (const similarity of [0.05, 0.1, 0.2]) {
      grid.push({ text, vector: Number((1 - text).toFixed(2)), similarity, titleBoost: DEFAULT_TUNING.titleBoost });
    }
  }
  for (const titleBoost of [1, 3, 6]) {
    grid.push({ text: 0.5, vector: 0.5, similarity: 0.1, titleBoost });
  }

  console.log('text/vec  sim  tb |  all r@1  verbose r@1  verbose MRR  natural r@1 |  overall MRR');
  const results: Array<{ t: Tuning; overallMrr: number; verboseR1: number; line: string }> = [];

  for (const tuning of grid) {
    const all: Scored[] = [];
    for (const [name, queries, run] of corpora) all.push(...(await runCorpus(name, queries, run, tuning)));

    const verbose = all.filter((r) => r.query.pairOf);
    const natural = all.filter((r) => r.query.id.includes('-nl-'));
    const o = score(all);
    const v = score(verbose);
    const nat = score(natural);
    const line = `${tuning.text}/${tuning.vector}  ${String(tuning.similarity).padEnd(4)} ${String(tuning.titleBoost).padStart(2)} |    ${pct(o.recall1)}       ${pct(v.recall1)}       ${v.mrr.toFixed(3)}        ${pct(nat.recall1)}  |     ${o.mrr.toFixed(3)}`;
    console.log(line);
    results.push({ t: tuning, overallMrr: o.mrr, verboseR1: v.recall1, line });
  }

  console.log('\nbest by overall MRR:');
  for (const r of [...results].sort((a, b) => b.overallMrr - a.overallMrr).slice(0, 5)) console.log('  ' + r.line);
  console.log('\nbest by verbose-identifier recall@1 (the observed defect):');
  for (const r of [...results].sort((a, b) => b.verboseR1 - a.verboseR1 || b.overallMrr - a.overallMrr).slice(0, 5)) console.log('  ' + r.line);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
