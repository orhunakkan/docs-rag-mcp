import { join } from 'node:path';
import { DOCS_DIR } from '../paths.js';
import type { Language, SourceDescriptor } from '../types.js';

export const PLAYWRIGHT_DEV_REPO = 'https://github.com/microsoft/playwright.dev.git';

interface LanguageConfig {
  language: Language;
  /** Path inside the cloned repo holding this language's Docusaurus docs. */
  docsSubdir: string;
  /** Live site URL segment for this language, e.g. '/python'. Empty for nodejs (default/root language). */
  siteLangPrefix: string;
}

const LANGUAGES: LanguageConfig[] = [
  { language: 'nodejs', docsSubdir: 'nodejs/docs', siteLangPrefix: '' },
  { language: 'python', docsSubdir: 'python/docs', siteLangPrefix: '/python' },
  { language: 'java', docsSubdir: 'java/docs', siteLangPrefix: '/java' },
  { language: 'dotnet', docsSubdir: 'dotnet/docs', siteLangPrefix: '/dotnet' }
];

function perLanguageSources({ language, docsSubdir, siteLangPrefix }: LanguageConfig): SourceDescriptor[] {
  return [
    {
      language,
      docType: 'api',
      repoSubdir: `${docsSubdir}/api`,
      recursive: false,
      siteUrlPrefix: `${siteLangPrefix}/docs/api`,
      outputDir: join(DOCS_DIR, language, 'api')
    },
    {
      language,
      docType: 'guides',
      // Top-level files only (non-recursive) — this naturally excludes the
      // nested `api/` subdirectory, which is handled by its own descriptor above.
      repoSubdir: docsSubdir,
      recursive: false,
      siteUrlPrefix: `${siteLangPrefix}/docs`,
      outputDir: join(DOCS_DIR, language, 'guides')
    }
  ];
}

export const SOURCES: SourceDescriptor[] = [
  {
    language: 'nodejs',
    docType: 'agent-cli',
    repoSubdir: 'agent-cli',
    recursive: true,
    siteUrlPrefix: '/agent-cli',
    outputDir: join(DOCS_DIR, 'nodejs', 'agent-cli')
  },
  {
    language: 'nodejs',
    docType: 'mcp',
    repoSubdir: 'mcp',
    recursive: true,
    siteUrlPrefix: '/mcp',
    outputDir: join(DOCS_DIR, 'nodejs', 'mcp')
  },
  ...LANGUAGES.flatMap(perLanguageSources)
];
