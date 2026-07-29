import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// Every path in this project is anchored to this file's location rather than
// process.cwd(). MCP clients launch the stdio server with the *opened project*
// as cwd, so cwd-relative paths resolve against whatever repo the user happens
// to have open — the index fails to load, and the embedding model silently
// re-downloads into their project directory.
//
// `..` assumes this file is at <root>/src/paths.ts and runs from source: there
// is no build step, so tsx executes the .ts in place and import.meta.url is the
// real source location. Adding a dist/ build would change this depth.
const HERE = dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = join(HERE, '..');

export const DATA_DIR = join(REPO_ROOT, 'data');
export const INDEX_DIR = join(DATA_DIR, 'index');
export const DOCS_DIR = join(REPO_ROOT, 'docs');
export const MODEL_CACHE_DIR = join(REPO_ROOT, '.cache', 'models');

/**
 * Renders an absolute path under the repo as a forward-slashed repo-relative
 * one. Chunks record their `sourceFile` this way so the value stays portable —
 * it is persisted into the search index, and an absolute path there would bake
 * one machine's directory layout into a distributable artifact.
 */
export function toRepoRelative(absPath: string): string {
  return relative(REPO_ROOT, absPath).split('\\').join('/');
}
