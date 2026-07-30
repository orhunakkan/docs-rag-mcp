import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { create, insertMultiple } from '@orama/orama';
import { persistToFile, restoreFromFile } from '@orama/plugin-data-persistence/server';
import { INDEX_DIR } from '../paths.js';
import { embedBatch, embedInput, type IndexOptions } from '../search/embed.js';
import type { TsChunk } from './types.js';
import { schema } from './schema.js';

export const INDEX_PATH = join(INDEX_DIR, 'typescript.msp');

const EMBED_BATCH_SIZE = 32;

export type TsDb = ReturnType<typeof createDb>;

export function createDb() {
  return create({ schema });
}

export async function indexChunks(db: TsDb, chunks: TsChunk[], options: IndexOptions = {}): Promise<void> {
  for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
    // Embed the heading context along with the body, but store `content`
    // untouched — see embedInput in src/search/embed.js.
    const embeddings = await embedBatch(
      batch.map((chunk) => (options.headingPrefix === false ? chunk.content : embedInput(chunk.title, chunk.headingPath, chunk.content)))
    );
    const docs = batch.map((chunk, idx) => ({
      ...chunk,
      headingPath: chunk.headingPath.join(' > '),
      embedding: embeddings[idx]
    }));
    await insertMultiple(db, docs);
  }
}

export async function persistIndex(db: TsDb, path: string = INDEX_PATH): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await persistToFile(db, 'binary', path);
}

export async function loadIndex(path: string = INDEX_PATH): Promise<TsDb> {
  return restoreFromFile<TsDb>('binary', path);
}
