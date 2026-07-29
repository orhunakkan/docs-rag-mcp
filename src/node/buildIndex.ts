import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { create, insertMultiple, load, save, type RawData } from '@orama/orama';
import { decode, encode } from '@msgpack/msgpack';
import { INDEX_DIR } from '../paths.js';
import { embedBatch } from '../search/embed.js';
import type { NodeChunk } from './types.js';
import { schema } from './schema.js';

export const INDEX_PATH = join(INDEX_DIR, 'node-runtime.msp');

const EMBED_BATCH_SIZE = 32;

// Same issue and fix as src/javascript/buildIndex.ts: doc/api/*.md's ~5k chunks
// produce an Orama index deep enough to exceed @msgpack/msgpack's default
// 100-level encode depth guard, so persistence goes directly through
// @orama/orama's save/load and @msgpack/msgpack's encode/decode (raising only
// the encode side's depth limit; decode has no such limit).
const MSGPACK_MAX_DEPTH = 100_000;

export type NodeDb = ReturnType<typeof createDb>;

export function createDb() {
  return create({ schema });
}

export async function indexChunks(db: NodeDb, chunks: NodeChunk[]): Promise<void> {
  for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
    const embeddings = await embedBatch(batch.map((chunk) => chunk.content));
    const docs = batch.map((chunk, idx) => ({
      ...chunk,
      headingPath: chunk.headingPath.join(' > '),
      embedding: embeddings[idx]
    }));
    await insertMultiple(db, docs);
  }
}

export async function persistIndex(db: NodeDb, path: string = INDEX_PATH): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const dbExport = await save(db);
  const encoded = encode(dbExport, { maxDepth: MSGPACK_MAX_DEPTH });
  await writeFile(path, Buffer.from(encoded.buffer, encoded.byteOffset, encoded.byteLength));
}

export async function loadIndex(path: string = INDEX_PATH): Promise<NodeDb> {
  const data = await readFile(path);
  const db = createDb();
  const deserialized = decode(data) as RawData;
  load(db, deserialized);
  return db;
}
