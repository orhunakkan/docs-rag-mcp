import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DATA_DIR, toRepoRelative } from '../src/paths.js';
import { chunkMarkdown } from '../src/node/chunker.js';
import { cleanupClone, cloneDocsRepo } from '../src/ingest/clone.js';
import { normalizeNodeDoc } from '../src/node/normalize.js';
import { buildFileContent, writeNormalizedFile } from '../src/ingest/write.js';
import { DOCS_SUBDIR, NODE_DOCS_BASE, NODE_REPO, NODE_TAG, OUTPUT_DIR } from '../src/node/sources.js';
import { readApiDocs } from '../src/node/walk.js';
import { createDb, indexChunks, persistIndex } from '../src/node/buildIndex.js';
import type { NodeChunk, NodeSyncMeta } from '../src/node/types.js';

async function main() {
  console.log(`Cloning nodejs/node at ${NODE_TAG} (shallow)...`);
  const { repoPath, commitSha } = await cloneDocsRepo(NODE_REPO, NODE_TAG);

  const allChunks: NodeChunk[] = [];
  let docCount = 0;

  try {
    const rawDocs = await readApiDocs(repoPath, DOCS_SUBDIR);
    console.log(`  api: ${rawDocs.length} file(s)`);
    docCount = rawDocs.length;

    for (const rawDoc of rawDocs) {
      const body = normalizeNodeDoc(rawDoc.raw);
      const sourceUrl = `${NODE_DOCS_BASE}/${rawDoc.module}.html`;
      const fileContent = buildFileContent(body, sourceUrl);
      const outPath = toRepoRelative(await writeNormalizedFile(OUTPUT_DIR, rawDoc.module, fileContent));

      const chunks = chunkMarkdown(fileContent, {
        module: rawDoc.module,
        sourceUrl,
        sourceFile: outPath,
        sourceRef: commitSha
      });
      allChunks.push(...chunks);
    }
  } finally {
    await cleanupClone(repoPath);
  }

  console.log(`Chunked into ${allChunks.length} chunk(s) total. Embedding + indexing...`);

  const db = createDb();
  await indexChunks(db, allChunks);
  await persistIndex(db);

  const meta: NodeSyncMeta = {
    commitSha,
    tag: NODE_TAG,
    syncedAt: new Date().toISOString(),
    docCount,
    chunkCount: allChunks.length
  };
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(join(DATA_DIR, 'sync-meta-node.json'), JSON.stringify(meta, null, 2), 'utf8');

  console.log('Sync complete.');
  console.log(`  tag: ${NODE_TAG}`);
  console.log(`  commit: ${commitSha}`);
  console.log(`  docs: ${docCount}`);
  console.log(`  chunks: ${allChunks.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
