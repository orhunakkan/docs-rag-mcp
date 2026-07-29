import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { loadIndex, type Db } from '../search/buildIndex.js';
import { hybridSearch, type SearchResult } from '../search/query.js';
import { loadIndex as loadTsIndex, type TsDb } from '../typescript/buildIndex.js';
import { hybridSearch as tsHybridSearch, type TsSearchResult } from '../typescript/query.js';
import { loadIndex as loadJsIndex, type JsDb } from '../javascript/buildIndex.js';
import { hybridSearch as jsHybridSearch, type JsSearchResult } from '../javascript/query.js';
import { loadIndex as loadNodeIndex, type NodeDb } from '../node/buildIndex.js';
import { hybridSearch as nodeHybridSearch, type NodeSearchResult } from '../node/query.js';
import { NODE_TAG } from '../node/sources.js';

const server = new McpServer({ name: 'docs-rag-mcp', version: '1.1.0' });

let dbPromise: Promise<Db> | undefined;

function getDb(): Promise<Db> {
  if (!dbPromise) {
    dbPromise = loadIndex();
  }
  return dbPromise;
}

let tsDbPromise: Promise<TsDb> | undefined;

function getTsDb(): Promise<TsDb> {
  if (!tsDbPromise) {
    tsDbPromise = loadTsIndex();
  }
  return tsDbPromise;
}

let jsDbPromise: Promise<JsDb> | undefined;

function getJsDb(): Promise<JsDb> {
  if (!jsDbPromise) {
    jsDbPromise = loadJsIndex();
  }
  return jsDbPromise;
}

let nodeDbPromise: Promise<NodeDb> | undefined;

function getNodeDb(): Promise<NodeDb> {
  if (!nodeDbPromise) {
    nodeDbPromise = loadNodeIndex();
  }
  return nodeDbPromise;
}

/**
 * Playwright and MDN document the same content under several URLs (a method
 * exposed on Page, Frame, Locator and FrameLocator, say). Those copies are
 * collapsed to one result; this reports the URLs that were folded in, so the
 * agent still learns the API exists on all of them.
 */
function formatAlsoAt(alsoAt: string[] | undefined): string {
  return alsoAt && alsoAt.length > 0 ? `\nAlso documented at: ${alsoAt.join(', ')}` : '';
}

function formatResults(results: SearchResult[]): string {
  if (results.length === 0) {
    return 'No matching Playwright documentation found.';
  }
  return results
    .map((result) => {
      const path = result.headingPath ? `${result.title} > ${result.headingPath}` : result.title;
      return `### [${result.language}] ${path}\n\n${result.content}\n\nSource: ${result.sourceUrl}${formatAlsoAt(result.alsoAt)}`;
    })
    .join('\n\n---\n\n');
}

function formatTsResults(results: TsSearchResult[]): string {
  if (results.length === 0) {
    return 'No matching TypeScript documentation found.';
  }
  return results
    .map((result) => {
      const path = result.headingPath ? `${result.title} > ${result.headingPath}` : result.title;
      return `### [${result.section}] ${path}\n\n${result.content}\n\nSource: ${result.sourceUrl}${formatAlsoAt(result.alsoAt)}`;
    })
    .join('\n\n---\n\n');
}

function formatJsResults(results: JsSearchResult[]): string {
  if (results.length === 0) {
    return 'No matching JavaScript documentation found.';
  }
  return results
    .map((result) => {
      const path = result.headingPath ? `${result.title} > ${result.headingPath}` : result.title;
      return `### [${result.section}] ${path}\n\n${result.content}\n\nSource: ${result.sourceUrl}${formatAlsoAt(result.alsoAt)}`;
    })
    .join('\n\n---\n\n');
}

function formatNodeResults(results: NodeSearchResult[]): string {
  if (results.length === 0) {
    return 'No matching Node.js runtime documentation found.';
  }
  return results
    .map((result) => {
      const path = result.headingPath ? `${result.title} > ${result.headingPath}` : result.title;
      return `### [${result.module}] ${path}\n\n${result.content}\n\nSource: ${result.sourceUrl}${formatAlsoAt(result.alsoAt)}`;
    })
    .join('\n\n---\n\n');
}

server.registerTool(
  'search_playwright_docs',
  {
    title: 'Search Playwright Docs',
    description:
      "Hybrid (keyword + semantic) search over Playwright's documentation across Node.js, Python, Java, and .NET (API reference and guides for all four; MCP and agent CLI docs are Node.js-tooling-only). Returns cited excerpts with source URLs. Pass `language` when you know the calling project's language — unfiltered queries search all four and may mix languages in the results.",
    inputSchema: {
      query: z.string().describe('Natural-language question or exact API name (e.g. "page.locator" or "how do I wait for network idle")'),
      limit: z.number().int().min(1).max(20).optional().describe('Max results to return (default 5)'),
      docType: z.enum(['agent-cli', 'api', 'guides', 'mcp']).optional().describe('Restrict results to one doc category'),
      language: z.enum(['nodejs', 'python', 'java', 'dotnet']).optional().describe('Restrict results to one language (recommended when known)')
    }
  },
  async ({ query, limit, docType, language }) => {
    const db = await getDb();
    const results = await hybridSearch(db, query, { limit, docType, language });
    return { content: [{ type: 'text', text: formatResults(results) }] };
  }
);

server.registerTool(
  'search_typescript_docs',
  {
    title: 'Search TypeScript Docs',
    description:
      "Hybrid (keyword + semantic) search over the TypeScript Handbook and language guides (typescriptlang.org) — unrelated to Playwright. Covers handbook-v2, get-started, javascript interop, modules, project config, reference, release notes, tutorials, and declaration files. Returns cited excerpts with source URLs.",
    inputSchema: {
      query: z.string().describe('Natural-language question or TypeScript concept (e.g. "discriminated unions" or "how do generics work")'),
      limit: z.number().int().min(1).max(20).optional().describe('Max results to return (default 5)'),
      section: z
        .enum([
          'general',
          'handbook-v2',
          'get-started',
          'javascript',
          'modules-reference',
          'project-config',
          'reference',
          'release-notes',
          'tutorials',
          'declaration-files'
        ])
        .optional()
        .describe('Restrict results to one documentation section')
    }
  },
  async ({ query, limit, section }) => {
    const db = await getTsDb();
    const results = await tsHybridSearch(db, query, { limit, section });
    return { content: [{ type: 'text', text: formatTsResults(results) }] };
  }
);

server.registerTool(
  'search_javascript_docs',
  {
    title: 'Search JavaScript Docs',
    description:
      'Hybrid (keyword + semantic) search over the core JavaScript language docs from MDN (developer.mozilla.org) — the language Guide and Reference (global objects, operators, statements, errors, etc.), not the broader Web/DOM API surface MDN also hosts. Unrelated to Playwright or TypeScript. Returns cited excerpts with source URLs.',
    inputSchema: {
      query: z.string().describe('Natural-language question or exact API name (e.g. "Array.prototype.flatMap" or "how do closures work")'),
      limit: z.number().int().min(1).max(20).optional().describe('Max results to return (default 5)'),
      section: z.enum(['general', 'guide', 'reference']).optional().describe('Restrict results to one documentation section')
    }
  },
  async ({ query, limit, section }) => {
    const db = await getJsDb();
    const results = await jsHybridSearch(db, query, { limit, section });
    return { content: [{ type: 'text', text: formatJsResults(results) }] };
  }
);

server.registerTool(
  'search_node_runtime_docs',
  {
    title: 'Search Node.js Runtime Docs',
    description: `Hybrid (keyword + semantic) search over the official Node.js runtime API reference (nodejs.org/api), pinned to ${NODE_TAG} LTS — fs, http, stream, buffer, worker_threads, child_process, etc. Unrelated to Playwright, TypeScript, or JavaScript-the-language. Each result includes any "Added in"/"Deprecated since"/history metadata Node's own docs record for that API, plus a cited source URL. Pass \`module\` when you know the relevant module (e.g. "fs", "stream") — unfiltered queries search across all modules.`,
    inputSchema: {
      query: z.string().describe('Natural-language question or exact API name (e.g. "fs.readFile" or "how do I pipe a readable stream")'),
      limit: z.number().int().min(1).max(20).optional().describe('Max results to return (default 5)'),
      module: z.string().optional().describe('Restrict results to one module by its doc/api file stem (e.g. "fs", "http", "child_process", "stream")')
    }
  },
  async ({ query, limit, module }) => {
    const db = await getNodeDb();
    const results = await nodeHybridSearch(db, query, { limit, module });
    return { content: [{ type: 'text', text: formatNodeResults(results) }] };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
