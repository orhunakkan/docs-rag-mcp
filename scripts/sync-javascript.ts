import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DATA_DIR, toRepoRelative } from '../src/paths.js';
import { chunkMarkdown } from '../src/javascript/chunker.js';
import { splitChunks } from '../src/chunk/split.js';
import { createTokenCounter } from '../src/search/embed.js';
import { cleanupClone, cloneDocsRepo } from '../src/ingest/clone.js';
import { normalizeMdn } from '../src/javascript/normalize.js';
import { buildFileContent, flattenRelPath, writeNormalizedFile } from '../src/ingest/write.js';
import { MDN_CONTENT_REPO, SOURCES } from '../src/javascript/sources.js';
import { readSourceFiles } from '../src/javascript/walk.js';
import { createDb, indexChunks, persistIndex } from '../src/javascript/buildIndex.js';
import type { JsChunk, JsSection, JsSyncMeta } from '../src/javascript/types.js';

const MDN_BASE = 'https://developer.mozilla.org/en-US/docs';

async function main() {
  console.log('Cloning mdn/content (shallow)...');
  const { repoPath, commitSha } = await cloneDocsRepo(MDN_CONTENT_REPO);

  const allChunks: JsChunk[] = [];
  const counts: Partial<Record<JsSection, number>> = {};

  try {
    for (const source of SOURCES) {
      const rawDocs = await readSourceFiles(repoPath, source);
      console.log(`  ${source.section}: ${rawDocs.length} file(s)`);
      counts[source.section] = rawDocs.length;

      for (const rawDoc of rawDocs) {
        const { body, slug } = normalizeMdn(rawDoc.raw);
        if (!slug) {
          console.warn(`  WARNING: ${source.section}/${rawDoc.relPath} has no slug, skipping`);
          continue;
        }
        const sourceUrl = `${MDN_BASE}/${slug}`;
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

  // Cap every chunk at the embedding window before indexing: heading slices
  // run far past it, and the overflow is truncated silently. See
  // src/chunk/split.ts.
  const chunks = splitChunks(allChunks, await createTokenCounter());
  const added = chunks.length - allChunks.length;
  console.log(`Chunked into ${allChunks.length} heading section(s); ${chunks.length} chunks after splitting oversized ones (+${added}). Embedding + indexing...`);

  const db = createDb();
  await indexChunks(db, chunks);
  await persistIndex(db);

  const docCount = Object.values(counts).reduce((a: number, b) => a + (b ?? 0), 0);
  const meta: JsSyncMeta = {
    commitSha,
    syncedAt: new Date().toISOString(),
    docCount,
    chunkCount: chunks.length,
    counts
  };
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(join(DATA_DIR, 'sync-meta-javascript.json'), JSON.stringify(meta, null, 2), 'utf8');

  console.log('Sync complete.');
  console.log(`  commit: ${commitSha}`);
  console.log(`  docs: ${docCount} ${JSON.stringify(counts)}`);
  console.log(`  chunks: ${chunks.length} (${allChunks.length} heading sections, capped at the embedding window)`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
