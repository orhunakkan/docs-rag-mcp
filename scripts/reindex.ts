/**
 * Rebuilds a search index from the already-normalized markdown in `docs/`,
 * without cloning anything upstream.
 *
 *   npm run reindex                      # all four corpora
 *   npm run reindex -- typescript node   # just those
 *   npm run reindex -- --no-split        # skip the chunk-size cap
 *   npm run reindex -- --no-prefix       # embed content without heading context
 *
 * Set `INDEX_SUBDIR` (see src/paths.ts) to build somewhere other than the index
 * the MCP server is serving; `npm run benchmark` honours the same variable, so
 * an A/B is two commands with the same prefix.
 *
 * Why this exists rather than just re-running `npm run sync:*`: a sync re-clones
 * upstream, so it can change the *corpus* at the same time as the pipeline. That
 * mixes documentation drift into a retrieval measurement and makes a before/after
 * comparison unattributable. `docs/` is committed and is exactly what the
 * chunkers consume, so rebuilding from it changes only the thing under test.
 *
 * The `--no-split` / `--no-prefix` flags are how the two halves of the same
 * resync get attributed separately. Both changes are only visible after a full
 * re-embed, so there is no cheaper way to tell which one moved a number.
 *
 * `sourceUrl` is recovered from each file's own `> **Source:**` line — the line
 * the sync wrote from the URL it chunked with — and `fileSlug` from the
 * filename, which the sync derived with `flattenRelPath`. So ids and URLs come
 * out identical to a sync's; `npm run probe` cross-checks the chunk counts.
 *
 * This deliberately does not touch `data/sync-meta*.json`. Those record which
 * upstream commit the *corpus* came from, which a reindex does not change — but
 * it does mean their `chunkCount` goes stale after a chunker change until the
 * next real sync. `npm run probe` is the live answer for chunk counts.
 */
import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { DOCS_DIR, INDEX_DIR, toRepoRelative } from '../src/paths.js';
import { chunkMarkdown as chunkPw } from '../src/chunk/chunker.js';
import { chunkMarkdown as chunkTs } from '../src/typescript/chunker.js';
import { chunkMarkdown as chunkJs } from '../src/javascript/chunker.js';
import { chunkMarkdown as chunkNode } from '../src/node/chunker.js';
import { splitChunks } from '../src/chunk/split.js';
import { createTokenCounter, type IndexOptions } from '../src/search/embed.js';
import * as pw from '../src/search/buildIndex.js';
import * as ts from '../src/typescript/buildIndex.js';
import * as js from '../src/javascript/buildIndex.js';
import * as nd from '../src/node/buildIndex.js';
import type { DocType, Language } from '../src/types.js';
import type { TsSection } from '../src/typescript/types.js';
import type { JsSection } from '../src/javascript/types.js';

const SOURCE_LINE = /^>\s*\*\*Source:\*\*\s*\[[^\]]*\]\(([^)]+)\)/m;

function sourceUrlOf(markdown: string, path: string): string {
  const match = markdown.match(SOURCE_LINE);
  if (!match) throw new Error(`No "> **Source:**" attribution line in ${path}; cannot recover its sourceUrl.`);
  return match[1];
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

interface Corpus {
  name: string;
  file: string;
  load: () => Promise<Array<{ id: string; title: string; headingPath: string[]; content: string }>>;
  index: (chunks: never[], options: IndexOptions, path: string) => Promise<void>;
}

/** The Playwright corpus spans four language dirs, each with its own docTypes. */
const PW_DIRS: Array<[Language, DocType]> = [
  ['nodejs', 'agent-cli'],
  ['nodejs', 'mcp'],
  ['nodejs', 'api'],
  ['nodejs', 'guides'],
  ['python', 'api'],
  ['python', 'guides'],
  ['java', 'api'],
  ['java', 'guides'],
  ['dotnet', 'api'],
  ['dotnet', 'guides']
];

const CORPORA: Corpus[] = [
  {
    name: 'playwright',
    file: 'playwright-nodejs.msp',
    load: async () => {
      const out = [];
      for (const [language, docType] of PW_DIRS) {
        const dir = join(DOCS_DIR, language, docType);
        for (const path of await mdFiles(dir)) {
          const md = await readFile(path, 'utf8');
          out.push(
            ...chunkPw(md, {
              language,
              docType,
              fileSlug: basename(path, '.md'),
              sourceUrl: sourceUrlOf(md, path),
              sourceFile: toRepoRelative(path),
              playwrightRef: 'reindex'
            })
          );
        }
      }
      return out;
    },
    index: (chunks, options, path) =>
      (async () => {
        const db = pw.createDb();
        await pw.indexChunks(db, chunks, options);
        await pw.persistIndex(db, path);
      })()
  },
  {
    name: 'typescript',
    file: 'typescript.msp',
    load: () => loadSectioned(join(DOCS_DIR, 'typescript'), (md, path, section) =>
      chunkTs(md, {
        section: section as TsSection,
        fileSlug: basename(path, '.md'),
        sourceUrl: sourceUrlOf(md, path),
        sourceFile: toRepoRelative(path),
        sourceRef: 'reindex'
      })
    ),
    index: (chunks, options, path) =>
      (async () => {
        const db = ts.createDb();
        await ts.indexChunks(db, chunks, options);
        await ts.persistIndex(db, path);
      })()
  },
  {
    name: 'javascript',
    file: 'javascript.msp',
    load: () => loadSectioned(join(DOCS_DIR, 'javascript'), (md, path, section) =>
      chunkJs(md, {
        section: section as JsSection,
        fileSlug: basename(path, '.md'),
        sourceUrl: sourceUrlOf(md, path),
        sourceFile: toRepoRelative(path),
        sourceRef: 'reindex'
      })
    ),
    index: (chunks, options, path) =>
      (async () => {
        const db = js.createDb();
        await js.indexChunks(db, chunks, options);
        await js.persistIndex(db, path);
      })()
  },
  {
    name: 'node',
    file: 'node-runtime.msp',
    load: async () => {
      const out = [];
      for (const path of await mdFiles(join(DOCS_DIR, 'node-runtime'))) {
        const md = await readFile(path, 'utf8');
        out.push(
          ...chunkNode(md, {
            module: basename(path, '.md'),
            sourceUrl: sourceUrlOf(md, path),
            sourceFile: toRepoRelative(path),
            sourceRef: 'reindex'
          })
        );
      }
      return out;
    },
    index: (chunks, options, path) =>
      (async () => {
        const db = nd.createDb();
        await nd.indexChunks(db, chunks, options);
        await nd.persistIndex(db, path);
      })()
  }
];

/** For corpora laid out as `docs/<corpus>/<section>/<page>.md`. */
async function loadSectioned<T>(root: string, chunk: (md: string, path: string, section: string) => T[]): Promise<T[]> {
  const out: T[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    for (const path of await mdFiles(join(root, entry.name))) {
      out.push(...chunk(await readFile(path, 'utf8'), path, entry.name));
    }
  }
  return out;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const noSplit = args.includes('--no-split');
  const noPrefix = args.includes('--no-prefix');
  const named = args.filter((arg) => !arg.startsWith('--'));
  const selected = named.length > 0 ? CORPORA.filter((c) => named.includes(c.name)) : CORPORA;
  if (selected.length === 0) throw new Error(`No corpus matched ${JSON.stringify(named)}. Known: ${CORPORA.map((c) => c.name).join(', ')}`);

  const options: IndexOptions = { headingPrefix: !noPrefix };
  const count = await createTokenCounter();
  console.log(`Rebuilding from docs/: split ${noSplit ? 'OFF' : 'ON'}, heading prefix ${noPrefix ? 'OFF' : 'ON'}.`);

  for (const corpus of selected) {
    const started = Date.now();
    const sections = await corpus.load();
    const chunks = noSplit ? sections : splitChunks(sections, count);
    const path = join(INDEX_DIR, corpus.file);

    console.log(`  ${corpus.name}: ${sections.length} heading sections -> ${chunks.length} chunks. Embedding...`);
    await corpus.index(chunks as never[], options, path);
    console.log(`  ${corpus.name}: wrote ${path} in ${((Date.now() - started) / 1000).toFixed(0)}s`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
