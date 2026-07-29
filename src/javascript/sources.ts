import { join } from 'node:path';
import { DOCS_DIR } from '../paths.js';
import type { JsSourceDescriptor } from './types.js';

export const MDN_CONTENT_REPO = 'https://github.com/mdn/content.git';

const DOCS_ROOT = 'files/en-us/web/javascript';

export const SOURCES: JsSourceDescriptor[] = [
  {
    // The section landing page only (files/en-us/web/javascript/index.md).
    // Non-recursive so it never descends into guide/ or reference/, handled below.
    section: 'general',
    repoSubdir: DOCS_ROOT,
    recursive: false,
    outputDir: join(DOCS_DIR, 'javascript', 'general')
  },
  {
    section: 'guide',
    repoSubdir: `${DOCS_ROOT}/guide`,
    recursive: true,
    outputDir: join(DOCS_DIR, 'javascript', 'guide')
  },
  {
    section: 'reference',
    repoSubdir: `${DOCS_ROOT}/reference`,
    recursive: true,
    outputDir: join(DOCS_DIR, 'javascript', 'reference')
  }
];
