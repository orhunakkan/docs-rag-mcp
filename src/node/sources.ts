import { join } from 'node:path';
import { DOCS_DIR } from '../paths.js';

export const NODE_REPO = 'https://github.com/nodejs/node.git';

// Pins the corpus to a specific LTS release rather than main, so "added in"/
// "deprecated in" metadata and the sourceUrl below stay internally consistent —
// bump this (and re-run npm run sync:node) to move to a different release.
export const NODE_TAG = 'v24.18.0';

export const DOCS_SUBDIR = 'doc/api';

export const OUTPUT_DIR = join(DOCS_DIR, 'node-runtime', 'api');

// nodejs.org serves an exact-version-pinned mirror of the docs at this path
// (verified identical byte-for-byte to /docs/latest-v24.x/ for this tag), so
// citations always resolve to the same content the corpus was built from.
export const NODE_DOCS_BASE = `https://nodejs.org/docs/${NODE_TAG}/api`;
