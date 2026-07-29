/**
 * Labelled retrieval benchmark.
 *
 * `expect` is matched as a substring against a result's `sourceUrl`, so it
 * should name the anchor that uniquely identifies the right chunk (e.g.
 * `class-locator#locator-filter`).
 *
 * `pairOf` marks a query as the verbose counterpart of another (by `id`). The
 * observed defect is specifically that adding true, relevant terms to a query
 * containing an exact API identifier makes the result *worse* — `filter` ranks
 * `locator.filter()` first while `locator.filter has text` does not return it
 * at all. A benchmark of only well-behaved single-token queries would score
 * highly and measure nothing, so every identifier query here has a verbose twin
 * and the report scores the two groups separately.
 */

export interface BenchmarkQuery {
  id: string;
  query: string;
  /**
   * Substring(s) matched against a result's sourceUrl. An array means the
   * question has more than one genuinely correct answer in the corpus and any
   * of them counts — several of these questions do, and scoring them against a
   * single arbitrary page measures the label rather than the retrieval.
   */
  expect: string | string[];
  /** id of the terse query this one is the verbose variant of. */
  pairOf?: string;
  language?: 'nodejs' | 'python' | 'java' | 'dotnet';
  docType?: 'agent-cli' | 'api' | 'guides' | 'mcp';
}

export const playwrightQueries: BenchmarkQuery[] = [
  // --- identifier lookups, terse ---
  { id: 'pw-filter', query: 'filter', expect: 'class-locator#locator-filter', language: 'nodejs' },
  { id: 'pw-getbyrole', query: 'getByRole', expect: 'get-by-role', language: 'nodejs' },
  { id: 'pw-tohavescreenshot', query: 'toHaveScreenshot', expect: 'to-have-screenshot', language: 'nodejs' },
  { id: 'pw-waitforloadstate', query: 'waitForLoadState', expect: 'wait-for-load-state', language: 'nodejs' },
  { id: 'pw-routefulfill', query: 'route.fulfill', expect: 'class-route#route-fulfill', language: 'nodejs' },
  { id: 'pw-selectoption', query: 'selectOption', expect: 'select-option', language: 'nodejs' },
  { id: 'pw-setviewportsize', query: 'setViewportSize', expect: 'set-viewport-size', language: 'nodejs' },
  { id: 'pw-tracing', query: 'tracing.start', expect: 'class-tracing#tracing-start', language: 'nodejs' },
  { id: 'pw-storagestate', query: 'storageState', expect: 'storage-state', language: 'nodejs' },
  { id: 'pw-locatorall', query: 'locator.all', expect: 'class-locator#locator-all', language: 'nodejs' },

  // --- the same lookups, phrased the way a person actually asks ---
  {
    id: 'pw-filter-verbose',
    query: 'locator.filter has text',
    expect: 'class-locator#locator-filter',
    pairOf: 'pw-filter',
    language: 'nodejs'
  },
  {
    id: 'pw-getbyrole-verbose',
    query: 'getByRole with accessible name option',
    expect: 'get-by-role',
    pairOf: 'pw-getbyrole',
    language: 'nodejs'
  },
  {
    id: 'pw-tohavescreenshot-verbose',
    query: 'toHaveScreenshot mask option to hide elements',
    expect: 'to-have-screenshot',
    pairOf: 'pw-tohavescreenshot',
    language: 'nodejs'
  },
  {
    id: 'pw-waitforloadstate-verbose',
    query: 'waitForLoadState networkidle wait until no network activity',
    expect: 'wait-for-load-state',
    pairOf: 'pw-waitforloadstate',
    language: 'nodejs'
  },
  {
    id: 'pw-routefulfill-verbose',
    query: 'route.fulfill to stub a network response body',
    expect: 'class-route#route-fulfill',
    pairOf: 'pw-routefulfill',
    language: 'nodejs'
  },
  {
    id: 'pw-selectoption-verbose',
    query: 'selectOption choose a value in a select dropdown',
    expect: 'select-option',
    pairOf: 'pw-selectoption',
    language: 'nodejs'
  },
  {
    id: 'pw-storagestate-verbose',
    query: 'storageState save signed in cookies to reuse between tests',
    expect: 'storage-state',
    pairOf: 'pw-storagestate',
    language: 'nodejs'
  },

  // --- natural language, no identifier at all ---
  { id: 'pw-nl-auth', query: 'how do I log in once and reuse the session', expect: 'auth', language: 'nodejs' },
  { id: 'pw-nl-parallel', query: 'run tests in parallel across workers', expect: 'parallel', language: 'nodejs' },
  { id: 'pw-nl-trace', query: 'record a trace to debug a failing test', expect: 'trace', language: 'nodejs' },
  { id: 'pw-nl-retry', query: 'automatically retry flaky tests', expect: 'retries', language: 'nodejs' },
  { id: 'pw-nl-fixture', query: 'create a custom test fixture', expect: 'fixture', language: 'nodejs' },
  { id: 'pw-nl-iframe', query: 'interact with an element inside an iframe', expect: 'frame', language: 'nodejs' },
  { id: 'pw-nl-upload', query: 'upload a file in a form', expect: 'input', language: 'nodejs' },
  { id: 'pw-nl-mobile', query: 'emulate a mobile device viewport', expect: 'emulation', language: 'nodejs' },

  // --- language filtering must not bleed across bindings ---
  { id: 'pw-py-expect', query: 'expect assertions', expect: '/python/', language: 'python' },
  { id: 'pw-java-locator', query: 'Locator class', expect: '/java/', language: 'java' },
  { id: 'pw-dotnet-page', query: 'Page class', expect: '/dotnet/', language: 'dotnet' }
];

export const typescriptQueries: BenchmarkQuery[] = [
  { id: 'ts-satisfies', query: 'satisfies', expect: 'satisfies' },
  { id: 'ts-satisfies-verbose', query: 'satisfies operator to check a value against a type', expect: 'satisfies', pairOf: 'ts-satisfies' },
  { id: 'ts-discriminated', query: 'discriminated unions', expect: 'unions' },
  { id: 'ts-generics', query: 'generics', expect: 'generics' },
  { id: 'ts-utility', query: 'Partial Record Pick utility types', expect: 'utility-types' },
  { id: 'ts-keyof', query: 'keyof type operator', expect: 'keyof-types' },
  { id: 'ts-narrowing', query: 'type narrowing with typeof', expect: 'narrowing' },
  { id: 'ts-decorators', query: 'decorators', expect: 'decorators' },
  { id: 'ts-modules', query: 'module resolution strategies', expect: 'module' },
  { id: 'ts-strict', query: 'strictNullChecks compiler option', expect: 'strictnullchecks' },
  { id: 'ts-declaration', query: 'writing a declaration file for a JS library', expect: 'declaration' },
  { id: 'ts-nl-interface', query: 'difference between an interface and a type alias', expect: 'everyday-types' }
];

export const javascriptQueries: BenchmarkQuery[] = [
  { id: 'js-flatmap', query: 'Array.prototype.flatMap', expect: 'flatMap' },
  { id: 'js-flatmap-verbose', query: 'flatMap to map and flatten an array one level', expect: 'flatMap', pairOf: 'js-flatmap' },
  { id: 'js-groupby', query: 'Object.groupBy', expect: 'groupBy' },
  { id: 'js-optional-chaining', query: 'optional chaining', expect: 'Optional_chaining' },
  { id: 'js-destructuring', query: 'destructuring assignment', expect: 'Destructuring' },
  { id: 'js-promise-all', query: 'Promise.allSettled', expect: 'allSettled' },
  { id: 'js-closures', query: 'how do closures work', expect: 'Closures' },
  // The canonical reference is Statements/function*, but MDN's generators guide
  // answers the question just as well.
  { id: 'js-generator', query: 'generator function yield', expect: ['function*', 'Iterators_and_generators'] },
  { id: 'js-proxy', query: 'Proxy handler traps', expect: 'Proxy' },
  { id: 'js-nullish', query: 'nullish coalescing operator', expect: 'Nullish_coalescing' },
  // `structuredClone` was here originally and was an invalid label: it is a Web
  // API, under Web/API rather than the Web/JavaScript subtree this corpus
  // indexes, so no result could ever have matched. Replaced with a question the
  // corpus can actually answer.
  { id: 'js-spread', query: 'spread syntax to copy an object', expect: ['Spread_syntax', 'assign'] },
  { id: 'js-tempdead', query: 'temporal dead zone let const hoisting', expect: ['Statements/let', 'temporal-dead-zone', 'Hoisting'] }
];

export const nodeQueries: BenchmarkQuery[] = [
  { id: 'nd-readfile', query: 'fs.readFile', expect: 'fs.html' },
  { id: 'nd-readfile-verbose', query: 'fs.readFile read a file asynchronously with a callback', expect: 'fs.html', pairOf: 'nd-readfile' },
  { id: 'nd-pipe', query: 'stream pipeline', expect: 'stream.html' },
  { id: 'nd-abortsignal', query: 'AbortSignal.timeout', expect: 'abortsignaltimeout' },
  { id: 'nd-worker', query: 'worker_threads Worker', expect: 'worker_threads.html' },
  { id: 'nd-spawn', query: 'child_process.spawn', expect: 'child_process.html' },
  { id: 'nd-buffer', query: 'Buffer.allocUnsafe', expect: 'buffer.html' },
  { id: 'nd-http-server', query: 'create an http server', expect: 'http.html' },
  { id: 'nd-eventemitter', query: 'EventEmitter once', expect: 'events.html' },
  { id: 'nd-crypto', query: 'crypto createHash sha256', expect: 'crypto.html' },
  { id: 'nd-perf', query: 'measure elapsed time with high resolution', expect: 'perf_hooks.html' },
  // Originally labelled `process.html`, which was simply the wrong file —
  // Node documents this in environment_variables.html (and cli.html).
  { id: 'nd-nl-env', query: 'read environment variables', expect: ['environment_variables.html', 'cli.html#environment-variables'] }
];
