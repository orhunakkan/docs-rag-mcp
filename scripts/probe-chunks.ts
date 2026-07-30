/**
 * Measures chunk sizes against the embedding window over the committed `docs/`
 * tree, and what `splitChunks` would do to them — without cloning anything,
 * embedding anything, or touching the indexes.
 *
 *   npm run probe                       # both, per corpus
 *   npm run probe -- --before           # current chunking only
 *   npm run probe -- --max 440 --overlap 60   # try a different budget
 *
 * The budget flags are what `DEFAULT_BUDGET` was chosen with: chunk-count growth
 * is the cost of splitting, and it falls steeply as the cap rises toward the
 * window, so the cap wants to be as high as the embed prefix allows.
 *
 * `docs/` holds exactly the normalized markdown the sync pipeline feeds to the
 * chunkers, so chunking it here reproduces what a resync would produce. That
 * technique predicted 6,357 and 1,466 chunks against actuals of 6,356 and 1,466
 * in an earlier session, which is why the plan calls for measuring this way
 * before paying for a resync.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DOCS_DIR } from '../src/paths.js';
import { chunkMarkdown as chunkPw } from '../src/chunk/chunker.js';
import { chunkMarkdown as chunkTs } from '../src/typescript/chunker.js';
import { chunkMarkdown as chunkJs } from '../src/javascript/chunker.js';
import { chunkMarkdown as chunkNode } from '../src/node/chunker.js';
import { DEFAULT_BUDGET, splitChunks, type CountTokens } from '../src/chunk/split.js';
import { createTokenCounter, embedPrefix, MODEL_MAX_TOKENS } from '../src/search/embed.js';

interface Probed {
  id: string;
  content: string;
  title: string;
  headingPath: string[];
}

async function mdFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await mdFiles(path)));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) out.push(path);
  }
  return out;
}

/**
 * Chunks one corpus's normalized markdown. The meta values are placeholders
 * except where they affect chunk *count* or *content*; only sizes are measured
 * here, and ids are made unique per file so duplicate-id noise cannot skew a
 * count.
 */
async function chunkCorpus(dir: string, chunk: (md: string, slug: string) => Probed[]): Promise<Probed[]> {
  const out: Probed[] = [];
  for (const path of await mdFiles(join(DOCS_DIR, dir))) {
    const md = await readFile(path, 'utf8');
    out.push(...chunk(md, path.slice(DOCS_DIR.length + 1).replace(/\\/g, '/')));
  }
  return out;
}

const CORPORA: Array<[string, () => Promise<Probed[]>]> = [
  [
    'playwright',
    async () => {
      const out: Probed[] = [];
      for (const dir of ['nodejs', 'python', 'java', 'dotnet']) {
        out.push(
          ...(await chunkCorpus(dir, (md, slug) =>
            chunkPw(md, {
              language: 'nodejs',
              docType: 'guides',
              fileSlug: slug,
              sourceUrl: `https://playwright.dev/${slug}`,
              sourceFile: slug,
              playwrightRef: 'probe'
            })
          ))
        );
      }
      return out;
    }
  ],
  [
    'typescript',
    () =>
      chunkCorpus('typescript', (md, slug) =>
        chunkTs(md, { section: 'reference', fileSlug: slug, sourceUrl: `https://ts/${slug}`, sourceFile: slug, sourceRef: 'probe' })
      )
  ],
  [
    'javascript',
    () =>
      chunkCorpus('javascript', (md, slug) =>
        chunkJs(md, { section: 'reference', fileSlug: slug, sourceUrl: `https://mdn/${slug}`, sourceFile: slug, sourceRef: 'probe' })
      )
  ],
  [
    'node-runtime',
    () =>
      chunkCorpus('node-runtime', (md, slug) =>
        chunkNode(md, { module: slug, sourceUrl: `https://nodejs/${slug}`, sourceFile: slug, sourceRef: 'probe' })
      )
  ]
];

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
}

interface Stats {
  n: number;
  median: number;
  p95: number;
  max: number;
  over: number;
  /** Share of all corpus tokens that the embedder never sees. */
  unseenShare: number;
}

function stats(counts: number[], limit: number): Stats {
  const sorted = [...counts].sort((a, b) => a - b);
  const total = counts.reduce((a, b) => a + b, 0);
  const unseen = counts.reduce((a, b) => a + Math.max(b - limit, 0), 0);
  return {
    n: counts.length,
    median: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    max: sorted[sorted.length - 1] ?? 0,
    over: counts.filter((c) => c > limit).length,
    unseenShare: total === 0 ? 0 : unseen / total
  };
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

function row(label: string, s: Stats): string {
  return `  ${label.padEnd(14)} ${String(s.n).padStart(6)} ${String(s.median).padStart(7)} ${String(s.p95).padStart(6)} ${String(s.max).padStart(7)} ${String(s.over).padStart(6)} ${pct(s.unseenShare).padStart(7)}`;
}

/**
 * Cost of the `"${title} > ${headingPath}: "` prefix that step 3 prepends before
 * embedding. It is what the budget's headroom under the model window has to
 * cover, so it is measured rather than assumed.
 */
function prefixCost(chunks: Probed[], count: CountTokens): { median: number; p99: number; max: number } {
  const counts = chunks
    .map((c) => count(embedPrefix(c.title, c.headingPath)))
    .sort((a, b) => a - b);
  return { median: percentile(counts, 0.5), p99: percentile(counts, 0.99), max: counts[counts.length - 1] ?? 0 };
}

/** Lines that no splitter can bring inside the budget without cutting mid-line. */
function oversizedLines(chunks: Probed[], count: CountTokens, limit: number): number {
  let n = 0;
  for (const chunk of chunks) {
    for (const line of chunk.content.split('\n')) if (count(line) > limit) n++;
  }
  return n;
}

function flag(name: string, fallback: number): number {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? fallback : Number(process.argv[at + 1]);
}

async function main(): Promise<void> {
  const beforeOnly = process.argv.includes('--before');
  const budget = {
    maxTokens: flag('max', DEFAULT_BUDGET.maxTokens),
    overlapTokens: flag('overlap', DEFAULT_BUDGET.overlapTokens)
  };
  const count = await createTokenCounter();

  console.log(`Embedding window: ${MODEL_MAX_TOKENS} tokens. Budget: ${budget.maxTokens} cap, ${budget.overlapTokens} overlap.`);
  console.log('\nBEFORE — heading-sliced chunks, measured against the window');
  console.log('  corpus         chunks  median    p95     max   over  unseen');

  const collected: Array<[string, Probed[]]> = [];
  for (const [name, load] of CORPORA) {
    const chunks = await load();
    collected.push([name, chunks]);
    console.log(row(name, stats(chunks.map((c) => count(c.content)), MODEL_MAX_TOKENS)));
  }
  if (beforeOnly) return;

  console.log('\nEMBED PREFIX — what the budget headroom under the window has to cover');
  console.log('  corpus         median    p99     max');
  for (const [name, chunks] of collected) {
    const p = prefixCost(chunks, count);
    console.log(`  ${name.padEnd(14)} ${String(p.median).padStart(6)} ${String(p.p99).padStart(6)} ${String(p.max).padStart(7)}`);
  }

  console.log(`\nAFTER — splitChunks at ${budget.maxTokens} tokens, measured against the budget`);
  console.log('  corpus         chunks  median    p95     max   over  unseen   growth  long lines');
  for (const [name, chunks] of collected) {
    const split = splitChunks(chunks, count, budget);
    const s = stats(split.map((c) => count(c.content)), budget.maxTokens);
    const growth = chunks.length === 0 ? 0 : split.length / chunks.length - 1;
    const long = oversizedLines(split, count, budget.maxTokens);
    console.log(`${row(name, s)}  ${`+${(growth * 100).toFixed(1)}%`.padStart(7)}  ${String(long).padStart(10)}`);

    const duplicateIds = split.length - new Set(split.map((c) => c.id)).size;
    if (duplicateIds > 0) console.log(`    !! ${duplicateIds} duplicate id(s)`);
  }
  console.log('\n"over" after splitting should equal "long lines": the only chunk that can');
  console.log('exceed the budget is one whose single line already does.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
