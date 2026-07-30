import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DATA_DIR, toRepoRelative } from '../src/paths.js';
import { chunkMarkdown } from '../src/chunk/chunker.js';
import { splitChunks } from '../src/chunk/split.js';
import { createTokenCounter } from '../src/search/embed.js';
import { cleanupClone, cloneDocsRepo } from '../src/ingest/clone.js';
import { normalizeMdx } from '../src/ingest/normalize.js';
import { PLAYWRIGHT_DEV_REPO, SOURCES } from '../src/ingest/sources.js';
import { readSourceFiles } from '../src/ingest/walk.js';
import { buildFileContent, buildSourceUrl, flattenRelPath, writeNormalizedFile } from '../src/ingest/write.js';
import { createDb, indexChunks, persistIndex } from '../src/search/buildIndex.js';
import type { Chunk, DocType, Language, SyncMeta } from '../src/types.js';

async function main() {
  console.log('Cloning microsoft/playwright.dev (shallow)...');
  const { repoPath, commitSha } = await cloneDocsRepo(PLAYWRIGHT_DEV_REPO);

  const allChunks: Chunk[] = [];
  const counts: Record<Language, Partial<Record<DocType, number>>> = {
    nodejs: {},
    python: {},
    java: {},
    dotnet: {}
  };

  try {
    for (const source of SOURCES) {
      const rawDocs = await readSourceFiles(repoPath, source);
      console.log(`  ${source.language}/${source.docType}: ${rawDocs.length} file(s)`);
      counts[source.language][source.docType] = rawDocs.length;

      for (const rawDoc of rawDocs) {
        const { body } = normalizeMdx(rawDoc.raw);
        const sourceUrl = buildSourceUrl(source, rawDoc.relPath);
        const fileContent = buildFileContent(body, sourceUrl);
        const fileSlug = flattenRelPath(rawDoc.relPath);
        const outPath = toRepoRelative(await writeNormalizedFile(source.outputDir, fileSlug, fileContent));

        const chunks = chunkMarkdown(fileContent, {
          language: source.language,
          docType: source.docType,
          fileSlug,
          sourceUrl,
          sourceFile: outPath,
          playwrightRef: commitSha
        });
        allChunks.push(...chunks);
      }
    }
  } finally {
    await cleanupClone(repoPath);
  }

  // Cap every chunk at the embedding window before indexing: heading slices
  // run far past it, and the overflow is truncated silently. See
  // src/chunk/split.ts.
  const chunks = splitChunks(allChunks, await createTokenCounter());
  const added = chunks.length - allChunks.length;
  console.log(`Chunked into ${allChunks.length} heading section(s); ${chunks.length} chunks after splitting oversized ones (+${added}). Embedding + indexing...`);

  const db = createDb();
  await indexChunks(db, chunks);
  await persistIndex(db);

  const docCount = Object.values(counts)
    .flatMap((byDocType) => Object.values(byDocType))
    .reduce((a: number, b) => a + (b ?? 0), 0);

  const meta: SyncMeta = {
    commitSha,
    syncedAt: new Date().toISOString(),
    docCount,
    chunkCount: chunks.length,
    counts
  };
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(join(DATA_DIR, 'sync-meta.json'), JSON.stringify(meta, null, 2), 'utf8');

  console.log('Sync complete.');
  console.log(`  commit: ${commitSha}`);
  console.log(`  docs: ${docCount} ${JSON.stringify(counts)}`);
  console.log(`  chunks: ${chunks.length} (${allChunks.length} heading sections, capped at the embedding window)`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
