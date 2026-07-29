import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DATA_DIR, toRepoRelative } from '../src/paths.js';
import { chunkMarkdown } from '../src/typescript/chunker.js';
import { cleanupClone, cloneDocsRepo } from '../src/ingest/clone.js';
import { normalizeMdx } from '../src/ingest/normalize.js';
import { buildFileContent, flattenRelPath, writeNormalizedFile } from '../src/ingest/write.js';
import { SOURCES, TYPESCRIPT_WEBSITE_REPO } from '../src/typescript/sources.js';
import { readSourceFiles } from '../src/typescript/walk.js';
import { createDb, indexChunks, persistIndex } from '../src/typescript/buildIndex.js';
import type { TsChunk, TsSection, TsSyncMeta } from '../src/typescript/types.js';

const TYPESCRIPT_LANG_BASE = 'https://www.typescriptlang.org';

async function main() {
  console.log('Cloning microsoft/TypeScript-Website (shallow)...');
  const { repoPath, commitSha } = await cloneDocsRepo(TYPESCRIPT_WEBSITE_REPO);

  const allChunks: TsChunk[] = [];
  const counts: Partial<Record<TsSection, number>> = {};

  try {
    for (const source of SOURCES) {
      const rawDocs = await readSourceFiles(repoPath, source);
      console.log(`  ${source.section}: ${rawDocs.length} file(s)`);
      counts[source.section] = rawDocs.length;

      for (const rawDoc of rawDocs) {
        const { body, permalink } = normalizeMdx(rawDoc.raw);
        if (!permalink) {
          console.warn(`  WARNING: ${source.section}/${rawDoc.relPath} has no permalink, skipping`);
          continue;
        }
        const sourceUrl = `${TYPESCRIPT_LANG_BASE}${permalink}`;
        const fileContent = buildFileContent(body, sourceUrl);
        const fileSlug = flattenRelPath(rawDoc.relPath);
        const outPath = toRepoRelative(await writeNormalizedFile(source.outputDir, fileSlug, fileContent));

        const chunks = chunkMarkdown(fileContent, {
          section: source.section,
          fileSlug,
          sourceUrl,
          sourceFile: outPath,
          sourceRef: commitSha
        });
        allChunks.push(...chunks);
      }
    }
  } finally {
    await cleanupClone(repoPath);
  }

  console.log(`Chunked into ${allChunks.length} chunk(s) total. Embedding + indexing...`);

  const db = createDb();
  await indexChunks(db, allChunks);
  await persistIndex(db);

  const docCount = Object.values(counts).reduce((a: number, b) => a + (b ?? 0), 0);
  const meta: TsSyncMeta = {
    commitSha,
    syncedAt: new Date().toISOString(),
    docCount,
    chunkCount: allChunks.length,
    counts
  };
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(join(DATA_DIR, 'sync-meta-typescript.json'), JSON.stringify(meta, null, 2), 'utf8');

  console.log('Sync complete.');
  console.log(`  commit: ${commitSha}`);
  console.log(`  docs: ${docCount} ${JSON.stringify(counts)}`);
  console.log(`  chunks: ${allChunks.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
