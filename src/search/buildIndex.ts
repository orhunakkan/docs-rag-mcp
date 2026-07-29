import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { create, insertMultiple } from '@orama/orama';
import { persistToFile, restoreFromFile } from '@orama/plugin-data-persistence/server';
import type { Chunk } from '../types.js';
import { INDEX_DIR } from '../paths.js';
import { embedBatch } from './embed.js';
import { schema } from './schema.js';

export const INDEX_PATH = join(INDEX_DIR, 'playwright-nodejs.msp');

const EMBED_BATCH_SIZE = 32;

export type Db = ReturnType<typeof createDb>;

export function createDb() {
  return create({ schema });
}

export async function indexChunks(db: Db, chunks: Chunk[]): Promise<void> {
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

export async function persistIndex(db: Db, path: string = INDEX_PATH): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await persistToFile(db, 'binary', path);
}

export async function loadIndex(path: string = INDEX_PATH): Promise<Db> {
  return restoreFromFile<Db>('binary', path);
}
