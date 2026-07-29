import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { create, insertMultiple, load, save, type RawData } from '@orama/orama';
import { decode, encode } from '@msgpack/msgpack';
import { INDEX_DIR } from '../paths.js';
import { embedBatch } from '../search/embed.js';
import type { JsChunk } from './types.js';
import { schema } from './schema.js';

export const INDEX_PATH = join(INDEX_DIR, 'javascript.msp');

const EMBED_BATCH_SIZE = 32;

// mdn/content's ~1,300-page corpus produces ~10k chunks — deep enough that
// Orama's internal index structure exceeds @msgpack/msgpack's default
// 100-level encode depth guard. @orama/plugin-data-persistence's
// persistToFile/restoreFromFile hardcode encode(data) with no way to raise
// that limit, so persistence is done directly here against @orama/orama's
// save/load and @msgpack/msgpack's encode/decode instead (decode has no
// depth limit, so only the encode side needs the override).
const MSGPACK_MAX_DEPTH = 100_000;

export type JsDb = ReturnType<typeof createDb>;

export function createDb() {
  return create({ schema });
}

export async function indexChunks(db: JsDb, chunks: JsChunk[]): Promise<void> {
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

export async function persistIndex(db: JsDb, path: string = INDEX_PATH): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const dbExport = await save(db);
  const encoded = encode(dbExport, { maxDepth: MSGPACK_MAX_DEPTH });
  await writeFile(path, Buffer.from(encoded.buffer, encoded.byteOffset, encoded.byteLength));
}

export async function loadIndex(path: string = INDEX_PATH): Promise<JsDb> {
  const data = await readFile(path);
  const db = createDb();
  const deserialized = decode(data) as RawData;
  load(db, deserialized);
  return db;
}
