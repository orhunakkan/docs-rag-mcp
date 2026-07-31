/**
 * Labelled retrieval benchmark.
 *
 * `expect` is matched as a substring against a result's `sourceUrl`. A label
 * therefore has to be chosen deliberately, because both directions of error are
 * real and were both present in the first version of this file:
 *
 * - **too strict** — a correct answer living at a URL the label doesn't name
 *   scores as a retrieval failure. Three cases were confirmed by inspection
 *   (`js-optional-chaining`, `js-spread`, `ts-utility`), which is why absolute
 *   numbers from before 2026-07-29 read pessimistically.
 * - **too loose** — a label naming only a page or module (`fs.html`, `unions`)
 *   scores any chunk from it as correct, so the benchmark stops measuring
 *   retrieval and starts measuring routing. Node's labels were all of this
 *   shape: `fs.readFile` scored a hit on `fs.html#fsfsyncsyncfd`.
 *
 * The rules applied here, in order:
 *
 * 1. A label names the most specific substring that identifies a chunk which
 *    answers the query **on its own merits, judged by reading it** — never
 *    because it happened to rank well.
 * 2. Several members are fine when several pages genuinely answer. Every
 *    non-obvious member carries an inline comment saying why it qualifies.
 * 3. Index and listing chunks are never labels. MDN's `Reference/Operators`
 *    and `Reference` pages, and TypeScript's handbook TOCs, enumerate links
 *    with a one-line gloss each; they do not answer a question. Several of
 *    these currently rank #1, and that is a defect the benchmark should show.
 * 4. A page-level label is used only where every section of the page answers
 *    the query (Playwright's `docs/auth`, MDN's `Guide/Closures`).
 * 5. A label ending in `$` is matched as an end-of-URL anchor rather than a
 *    substring — see `matchesLabel`. Plain substrings cannot express two things
 *    the corpora need: `Array/reduce` is a substring of `Array/reduceRight`, so
 *    "Array.prototype.reduce" was scoring a hit on `reduceRight`; and a page's
 *    `_intro` chunk (whose sourceUrl carries no `#`) cannot be named without
 *    also matching every section of that page.
 *
 * `kind` drives the report's grouping. It replaced sniffing `id` for `-nl-`,
 * which silently mis-grouped: `js-closures` ("how do closures work") was
 * counted as an identifier lookup, and the three Playwright language-filter
 * probes — which test that a filter doesn't bleed across bindings, not ranking
 * quality — were counted in with the terse identifier group.
 *
 * `pairOf` marks a query as the verbose counterpart of another (by `id`). The
 * defect that motivated the pairing is that adding true, relevant terms to a
 * query containing an exact API identifier can make the result *worse* —
 * `filter` ranks `locator.filter()` first while `locator.filter has text` does
 * not. A benchmark of only well-behaved single-token queries would score highly
 * and measure nothing, so the report scores the groups separately.
 */

export type QueryKind =
  /** A bare API identifier, the way it appears in code. */
  | 'terse'
  /** The same lookup with true, relevant prose added around the identifier. */
  | 'verbose'
  /** A question containing no API identifier at all. The weak group. */
  | 'natural'
  /** Probes that a `language`/`docType` filter is applied, not ranking quality. */
  | 'filter';

export interface BenchmarkQuery {
  id: string;
  query: string;
  kind: QueryKind;
  /**
   * Label(s) matched against a result's sourceUrl by `matchesLabel`; any match
   * counts. See the labelling rules in this file's header before adding one.
   */
  expect: string | string[];
  /** id of the terse query this one is the verbose variant of. */
  pairOf?: string;
  language?: 'nodejs' | 'python' | 'java' | 'dotnet';
  docType?: 'agent-cli' | 'api' | 'guides' | 'mcp';
}

/**
 * Case-insensitive substring match, except that a trailing `$` anchors the
 * label to the end of the URL (rule 5). Shared by `scripts/benchmark.ts` and
 * `scripts/inspect.ts` so the two can never disagree about what a label means.
 */
export function matchesLabel(sourceUrl: string, expect: string | string[]): boolean {
  const url = sourceUrl.toLowerCase();
  return (Array.isArray(expect) ? expect : [expect]).some((raw) => {
    const label = raw.toLowerCase();
    return label.endsWith('$') ? url.endsWith(label.slice(0, -1)) : url.includes(label);
  });
}

export const playwrightQueries: BenchmarkQuery[] = [
  // --- identifier lookups, terse ---
  { id: 'pw-filter', query: 'filter', kind: 'terse', expect: 'class-locator#locator-filter', language: 'nodejs' },
  { id: 'pw-getbyrole', query: 'getByRole', kind: 'terse', expect: 'get-by-role', language: 'nodejs' },
  { id: 'pw-tohavescreenshot', query: 'toHaveScreenshot', kind: 'terse', expect: 'to-have-screenshot', language: 'nodejs' },
  { id: 'pw-waitforloadstate', query: 'waitForLoadState', kind: 'terse', expect: 'wait-for-load-state', language: 'nodejs' },
  { id: 'pw-routefulfill', query: 'route.fulfill', kind: 'terse', expect: 'class-route#route-fulfill', language: 'nodejs' },
  { id: 'pw-selectoption', query: 'selectOption', kind: 'terse', expect: 'select-option', language: 'nodejs' },
  { id: 'pw-setviewportsize', query: 'setViewportSize', kind: 'terse', expect: 'set-viewport-size', language: 'nodejs' },
  { id: 'pw-tracing', query: 'tracing.start', kind: 'terse', expect: 'class-tracing#tracing-start', language: 'nodejs' },
  { id: 'pw-storagestate', query: 'storageState', kind: 'terse', expect: 'storage-state', language: 'nodejs' },
  { id: 'pw-locatorall', query: 'locator.all', kind: 'terse', expect: 'class-locator#locator-all', language: 'nodejs' },

  // --- the same lookups, phrased the way a person actually asks ---
  {
    id: 'pw-filter-verbose',
    query: 'locator.filter has text',
    kind: 'verbose',
    expect: 'class-locator#locator-filter',
    pairOf: 'pw-filter',
    language: 'nodejs'
  },
  {
    id: 'pw-getbyrole-verbose',
    query: 'getByRole with accessible name option',
    kind: 'verbose',
    expect: 'get-by-role',
    pairOf: 'pw-getbyrole',
    language: 'nodejs'
  },
  {
    id: 'pw-tohavescreenshot-verbose',
    query: 'toHaveScreenshot mask option to hide elements',
    kind: 'verbose',
    expect: 'to-have-screenshot',
    pairOf: 'pw-tohavescreenshot',
    language: 'nodejs'
  },
  {
    id: 'pw-waitforloadstate-verbose',
    query: 'waitForLoadState networkidle wait until no network activity',
    kind: 'verbose',
    expect: 'wait-for-load-state',
    pairOf: 'pw-waitforloadstate',
    language: 'nodejs'
  },
  {
    id: 'pw-routefulfill-verbose',
    query: 'route.fulfill to stub a network response body',
    kind: 'verbose',
    expect: 'class-route#route-fulfill',
    pairOf: 'pw-routefulfill',
    language: 'nodejs'
  },
  {
    id: 'pw-selectoption-verbose',
    query: 'selectOption choose a value in a select dropdown',
    kind: 'verbose',
    expect: 'select-option',
    pairOf: 'pw-selectoption',
    language: 'nodejs'
  },
  {
    id: 'pw-storagestate-verbose',
    query: 'storageState save signed in cookies to reuse between tests',
    kind: 'verbose',
    expect: 'storage-state',
    pairOf: 'pw-storagestate',
    language: 'nodejs'
  },

  // --- natural language, no identifier at all ---
  // Page-level label: every section of the Authentication guide is about
  // signing in once and reusing the state.
  { id: 'pw-nl-auth', query: 'how do I log in once and reuse the session', kind: 'natural', expect: 'docs/auth', language: 'nodejs' },
  {
    id: 'pw-nl-parallel',
    query: 'run tests in parallel across workers',
    kind: 'natural',
    // Tightened from 'parallel', which credited `class-testinfo#test-info-parallel-index`
    // — a property returning a worker's index, not an answer about running in
    // parallel. `best-practices` qualifies: its parallelism-and-sharding section
    // explains the mechanism and when to use it. `docs/ci#workers` is
    // deliberately excluded — it is about setting `workers: 1` to opt *out* on CI.
    expect: ['docs/test-parallel', 'best-practices#use-parallelism-and-sharding'],
    language: 'nodejs'
  },
  {
    id: 'pw-nl-trace',
    query: 'record a trace to debug a failing test',
    kind: 'natural',
    // `class-testoptions#test-options-trace` is the option that turns recording
    // on; `trace-viewer-intro` covers recording and then opening the trace.
    expect: ['docs/trace-viewer', 'test-options-trace'],
    language: 'nodejs'
  },
  { id: 'pw-nl-retry', query: 'automatically retry flaky tests', kind: 'natural', expect: 'docs/test-retries', language: 'nodejs' },
  {
    id: 'pw-nl-fixture',
    query: 'create a custom test fixture',
    kind: 'natural',
    // Tightened from 'fixture' (which also matched `class-fixtures`, the type
    // reference for the built-ins, and an accessibility-guide aside).
    expect: 'docs/test-fixtures',
    language: 'nodejs'
  },
  {
    id: 'pw-nl-iframe',
    query: 'interact with an element inside an iframe',
    kind: 'natural',
    // `frameLocator()` on any of the four classes is the answer, as is the
    // frames guide; all are genuinely correct entry points.
    expect: ['frame-locator', 'docs/frames', 'locator-content-frame'],
    language: 'nodejs'
  },
  {
    id: 'pw-nl-upload',
    query: 'upload a file in a form',
    kind: 'natural',
    // `class-page#page-event-file-chooser` rather than a bare `file-chooser`,
    // which also matched `mcp/tools/file-upload#cancel-file-chooser` — an MCP
    // tool reference, not an answer about uploading in a test.
    expect: ['docs/input#upload-files', 'class-page#page-event-file-chooser'],
    language: 'nodejs'
  },
  {
    id: 'pw-nl-mobile',
    query: 'emulate a mobile device viewport',
    kind: 'natural',
    // `docs/codegen#emulate-devices` is excluded despite ranking #1: it is about
    // passing `--device` to the codegen CLI, not about emulating a viewport in a
    // test, which is what the emulation guide covers.
    expect: 'docs/emulation',
    language: 'nodejs'
  },
  {
    id: 'pw-nl-mask',
    // Failed in real use before the embedding-window cap. The `mask` and
    // `maskColor` options sit ~1,400 and ~1,585 chars into the
    // `toHaveScreenshot` chunks, i.e. at and past the embedding window.
    query: 'how do I mask elements in a screenshot comparison',
    kind: 'natural',
    // Only the assertion options document masking *in a comparison*. The
    // visual-comparisons guide never mentions `mask` (checked), so it is not a
    // label however plausible its title looks.
    expect: 'to-have-screenshot',
    language: 'nodejs'
  },
  {
    id: 'pw-nl-network-mock',
    query: 'intercept a request and return fake data',
    kind: 'natural',
    // The API-mocking guide, the network guide's mocking section, and
    // `route.fulfill` itself all answer this directly.
    expect: ['docs/mock#', 'network#network-mocking', 'class-route#route-fulfill'],
    language: 'nodejs'
  },
  {
    id: 'pw-nl-ci',
    query: 'run playwright tests in github actions',
    kind: 'natural',
    expect: ['docs/ci-intro', 'docs/ci#github-actions'],
    language: 'nodejs'
  },

  // --- language filtering must not bleed across bindings ---
  { id: 'pw-py-expect', query: 'expect assertions', kind: 'filter', expect: '/python/', language: 'python' },
  { id: 'pw-java-locator', query: 'Locator class', kind: 'filter', expect: '/java/', language: 'java' },
  { id: 'pw-dotnet-page', query: 'Page class', kind: 'filter', expect: '/dotnet/', language: 'dotnet' }
];

export const typescriptQueries: BenchmarkQuery[] = [
  // --- identifier lookups, terse ---
  { id: 'ts-satisfies', query: 'satisfies', kind: 'terse', expect: 'satisfies' },
  {
    id: 'ts-discriminated',
    query: 'discriminated unions',
    kind: 'terse',
    // Tightened from 'unions', which matched every release note mentioning
    // union types. The handbook's own "Discriminated unions" section is an H1
    // *inside* Narrowing.md, so the chunker (H2/H3 boundaries) never emits it
    // as its own chunk — the functional-programmers page is the corpus's only
    // standalone chunk that defines the pattern with its discriminant property.
    expect: 'typescript-in-5-minutes-func.html#discriminated-unions'
  },
  { id: 'ts-generics', query: 'generics', kind: 'terse', expect: '2/generics.html' },
  {
    id: 'ts-utility',
    query: 'Partial Record Pick utility types',
    kind: 'terse',
    // `typescript-2-1.html#partial-readonly-record-and-pick` added per step 1:
    // read it, and it defines all three named types with worked signatures. It
    // is a release note, but it answers the question on its own merits.
    expect: ['utility-types.html', 'typescript-2-1.html#partial-readonly-record-and-pick']
  },
  { id: 'ts-keyof', query: 'keyof type operator', kind: 'terse', expect: '2/keyof-types.html' },
  { id: 'ts-narrowing', query: 'type narrowing with typeof', kind: 'terse', expect: '2/narrowing.html#typeof-type-guards' },
  { id: 'ts-decorators', query: 'decorators', kind: 'terse', expect: 'handbook/decorators.html' },
  {
    id: 'ts-modules',
    query: 'module resolution strategies',
    kind: 'terse',
    expect: ['modules/reference.html#the-moduleresolution-compiler-option', 'modules/theory.html#module-resolution', '2/modules.html']
  },
  { id: 'ts-strict', query: 'strictNullChecks compiler option', kind: 'terse', expect: 'strictnullchecks' },
  { id: 'ts-declaration', query: 'writing a declaration file for a JS library', kind: 'terse', expect: 'declaration-files/' },

  // --- the same lookups, phrased the way a person actually asks ---
  {
    id: 'ts-satisfies-verbose',
    query: 'satisfies operator to check a value against a type',
    kind: 'verbose',
    expect: 'satisfies',
    pairOf: 'ts-satisfies'
  },
  {
    id: 'ts-utility-verbose',
    query: 'Pick to build a type from a subset of another type properties',
    kind: 'verbose',
    expect: 'utility-types.html#picktype-keys',
    pairOf: 'ts-utility'
  },
  {
    id: 'ts-keyof-verbose',
    query: 'keyof to get the property names of a type as a union',
    kind: 'verbose',
    // `typescript-2-1.html#keyof-and-lookup-types` added on inspection: it
    // states "`keyof T` yields the type of permitted property names" and shows
    // `type K1 = keyof Person; // "name" | "age" | "location"`, which is the
    // question verbatim. `advanced-types.html#index-types` is excluded — it
    // uses `keyof` to build `pluck()` and never states the union-of-names
    // result, which is what was asked.
    expect: ['2/keyof-types.html', 'typescript-2-1.html#keyof-and-lookup-types'],
    pairOf: 'ts-keyof'
  },
  {
    id: 'ts-decorators-verbose',
    query: 'decorators applied to a class method',
    kind: 'verbose',
    expect: 'handbook/decorators.html#method-decorators',
    pairOf: 'ts-decorators'
  },
  {
    id: 'ts-generics-verbose',
    query: 'generic function that works over more than one type',
    kind: 'verbose',
    expect: '2/generics.html',
    pairOf: 'ts-generics'
  },
  {
    id: 'ts-narrowing-verbose',
    query: 'narrow a union by checking typeof before using the value',
    kind: 'verbose',
    // `2/everyday-types.html#working-with-union-types` added on inspection: it
    // demonstrates exactly this — a `number | string` parameter narrowed with
    // `typeof id === "string"` — and names the technique "narrowing".
    expect: ['2/narrowing.html', '2/everyday-types.html#working-with-union-types'],
    pairOf: 'ts-narrowing'
  },
  {
    id: 'ts-discriminated-verbose',
    query: 'union whose members share a literal tag property',
    kind: 'verbose',
    expect: 'typescript-in-5-minutes-func.html#discriminated-unions',
    pairOf: 'ts-discriminated'
  },

  // --- natural language, no identifier at all ---
  {
    id: 'ts-nl-interface',
    query: 'difference between an interface and a type alias',
    kind: 'natural',
    // Only sections that actually *contrast* the two qualify.
    // `2/everyday-types.html#type-aliases` is deliberately excluded: it defines
    // type aliases and never mentions interfaces, so crediting it (it currently
    // ranks #3) would be crediting a near-miss.
    expect: [
      '2/everyday-types.html#differences-between-type-aliases-and-interfaces',
      'advanced-types.html#interfaces-vs-type-aliases'
    ]
  },
  {
    id: 'ts-nl-unknown',
    query: 'safer alternative to any for a value of unknown shape',
    kind: 'natural',
    // The handbook section defines `unknown` and shows why it is safer than
    // `any`; the 3.0 release note introduces it as the safe top type.
    expect: ['2/functions.html#unknown', 'typescript-3-0.html#new-unknown-top-type']
  },
  {
    id: 'ts-nl-strict',
    query: 'make the compiler check my code more strictly',
    kind: 'natural',
    expect: ['2/basic-types.html#strictness', '2/basic-types.html#noimplicitany', '2/basic-types.html#strictnullchecks']
  },
  {
    id: 'ts-nl-enum',
    query: 'should I use an enum or a plain object of constants',
    kind: 'natural',
    // "Objects vs Enums" recommends an `as const` object over an enum — exactly
    // the trade-off asked about.
    expect: 'enums.html#objects-vs-enums'
  },
  {
    id: 'ts-nl-jsproject',
    query: 'add type checking to an existing javascript project',
    kind: 'natural',
    expect: ['intro-to-js-ts.html', 'type-checking-javascript-files.html']
  },
  {
    id: 'ts-nl-constraint',
    query: 'require a type parameter to have certain properties',
    kind: 'natural',
    // `2/generics.html#using-type-parameters-in-generic-constraints` is excluded
    // even though it currently ranks #1: it constrains one type parameter *by
    // another* (`Key extends keyof Type`) to index safely, which is a different
    // question from constraining a parameter to a shape.
    expect: '2/generics.html#generic-constraints'
  },
  {
    id: 'ts-nl-inference',
    query: 'when do I need to write a type annotation and when is it inferred',
    kind: 'natural',
    expect: ['2/everyday-types.html#type-annotations-on-variables', 'type-inference.html']
  }
];

export const javascriptQueries: BenchmarkQuery[] = [
  // --- identifier lookups, terse ---
  { id: 'js-flatmap', query: 'Array.prototype.flatMap', kind: 'terse', expect: 'Array/flatMap' },
  { id: 'js-groupby', query: 'Object.groupBy', kind: 'terse', expect: 'Object/groupBy' },
  {
    id: 'js-optional-chaining',
    query: 'optional chaining',
    kind: 'terse',
    // `Guide/Expressions_and_operators#optional-chaining` added per step 1: read
    // it, and it explains `?.`, its short-circuiting, and all three call forms.
    // A self-contained correct answer, not an index entry.
    expect: ['Operators/Optional_chaining', 'Expressions_and_operators#optional-chaining']
  },
  { id: 'js-destructuring', query: 'destructuring assignment', kind: 'terse', expect: ['Operators/Destructuring', 'Expressions_and_operators#destructuring'] },
  { id: 'js-promise-all', query: 'Promise.allSettled', kind: 'terse', expect: 'Promise/allSettled' },
  { id: 'js-proxy', query: 'Proxy handler traps', kind: 'terse', expect: ['Global_Objects/Proxy', 'Meta_programming#handlers-and-traps'] },
  { id: 'js-nullish', query: 'nullish coalescing operator', kind: 'terse', expect: 'Operators/Nullish_coalescing' },
  // Anchored per rule 5: a plain `Array/reduce` label also matched
  // `Array/reduceRight`, which was ranking #1 and scoring as correct.
  // `TypedArray/reduce` is excluded — a different constructor, not the query.
  { id: 'js-reduce', query: 'Array.prototype.reduce', kind: 'terse', expect: ['Array/reduce$', 'Array/reduce#'] },
  { id: 'js-weakmap', query: 'WeakMap', kind: 'terse', expect: ['Global_Objects/WeakMap', 'Keyed_collections#weakmap-object'] },
  { id: 'js-symbol-iterator', query: 'Symbol.iterator', kind: 'terse', expect: 'Symbol/iterator' },

  // --- the same lookups, phrased the way a person actually asks ---
  {
    id: 'js-flatmap-verbose',
    query: 'flatMap to map and flatten an array one level',
    kind: 'verbose',
    expect: 'Array/flatMap',
    pairOf: 'js-flatmap'
  },
  {
    id: 'js-reduce-verbose',
    query: 'reduce to sum the numbers in an array',
    kind: 'verbose',
    // Same anchoring as `js-reduce`. Both `TypedArray/reduce` and
    // `Array/reduceRight` have a "Sum up all values within an array" example and
    // both outrank the real answer; neither is `Array.prototype.reduce`.
    expect: ['Array/reduce$', 'Array/reduce#'],
    pairOf: 'js-reduce'
  },
  {
    id: 'js-nullish-verbose',
    query: 'nullish coalescing to supply a default when a value is null',
    kind: 'verbose',
    expect: 'Operators/Nullish_coalescing',
    pairOf: 'js-nullish'
  },
  {
    id: 'js-spread',
    query: 'spread syntax to copy an object',
    kind: 'verbose',
    // `Object_initializer#spread-properties` added per step 1: read it, and it
    // shows `{ ...obj1 }` cloning and contrasts it with `Object.assign()` —
    // the best answer in the corpus. `Reference/Operators#spread-syntax` and
    // `Reference#spread-syntax` are excluded under rule 3: both are operator
    // index listings, and both currently outrank every real answer.
    expect: ['Operators/Spread_syntax', 'Object_initializer#spread-properties', 'Object/assign#cloning-an-object']
  },
  {
    id: 'js-generator',
    query: 'generator function yield',
    kind: 'verbose',
    // `Operators/yield` added per step 1: it opens by defining `yield` as what
    // pauses and resumes a generator function, with a runnable example.
    // `Global_Objects/GeneratorFunction` is excluded — it documents the hidden
    // constructor reachable via `function*(){}.constructor`, a reflection
    // detail, and it currently ranks #1.
    expect: ['Statements/function*', 'Iterators_and_generators', 'Operators/yield']
  },
  {
    id: 'js-tempdead',
    query: 'temporal dead zone let const hoisting',
    kind: 'verbose',
    // Tightened: the bare substring 'temporal-dead-zone' was matching
    // `Statements/using#initialization-and-temporal-dead-zones`, which is about
    // `using` declarations and mentions let/const only by analogy. The canonical
    // TDZ section lives on the `let` page; `Grammar_and_types` covers the
    // hoisting half; the error page explains what a TDZ access throws.
    expect: [
      'Statements/let',
      'Statements/const',
      'Grammar_and_types#variable-hoisting',
      'Cant_access_lexical_declaration_before_init'
    ]
  },

  // --- natural language, no identifier at all ---
  // Was `js-closures`, and so was scored as an identifier lookup.
  { id: 'js-nl-closures', query: 'how do closures work', kind: 'natural', expect: ['Guide/Closures', 'Guide/Functions#closures'] },
  {
    id: 'js-nl-equality',
    query: 'difference between double equals and triple equals',
    kind: 'natural',
    expect: ['Equality_comparisons_and_sameness', 'Operators/Strict_equality', 'Operators/Equality']
  },
  {
    id: 'js-nl-iterate-object',
    query: 'loop over the keys and values of an object',
    kind: 'natural',
    expect: ['Object/entries', 'Object/keys', 'Statements/for...in', 'Working_with_objects']
  },
  {
    id: 'js-nl-immutable',
    query: 'stop an object from being changed',
    kind: 'natural',
    expect: ['Object/freeze', 'Object/isFrozen', 'Object/seal']
  },
  {
    id: 'js-nl-this',
    query: 'why is this undefined inside a callback',
    kind: 'natural',
    // `Operators/this#function-context` is the chunk holding the "Callbacks"
    // subsection (H4, so not its own chunk) that states callbacks are typically
    // called with `this` undefined. Arrow functions are the standard fix.
    expect: ['Operators/this', 'Functions/Arrow_functions']
  },
  {
    id: 'js-nl-await-many',
    query: 'wait for several promises to finish before continuing',
    kind: 'natural',
    expect: ['Promise/all', 'Using_promises', 'Promise/allSettled']
  },
  {
    id: 'js-nl-modules',
    query: 'import and export values between files',
    kind: 'natural',
    expect: ['Guide/Modules', 'Statements/import', 'Statements/export']
  }
];

export const nodeQueries: BenchmarkQuery[] = [
  // --- identifier lookups, terse ---
  // Every label below was tightened from a bare module name (`fs.html`,
  // `stream.html`, …). A module-level label made these queries unfailable:
  // `fs.readFile` scored rank 1 on `fs.html#fsfsyncsyncfd`, and
  // `worker_threads Worker` on `worker_threads.html#worker_threadsthreadname`.
  {
    id: 'nd-readfile',
    query: 'fs.readFile',
    kind: 'terse',
    // All three are `readFile`: the callback API, the promises API, and the
    // FileHandle method.
    expect: ['fs.html#fsreadfilepath-options-callback', 'fs.html#fspromisesreadfilepath-options', 'fs.html#filehandlereadfileoptions']
  },
  { id: 'nd-pipe', query: 'stream pipeline', kind: 'terse', expect: 'stream.html#streampipeline' },
  { id: 'nd-abortsignal', query: 'AbortSignal.timeout', kind: 'terse', expect: 'abortsignaltimeout' },
  { id: 'nd-worker', query: 'worker_threads Worker', kind: 'terse', expect: ['worker_threads.html#class-worker', 'worker_threads.html#new-workerfilename-options'] },
  { id: 'nd-spawn', query: 'child_process.spawn', kind: 'terse', expect: 'child_process.html#child_processspawncommand-args-options' },
  {
    id: 'nd-buffer',
    query: 'Buffer.allocUnsafe',
    kind: 'terse',
    // The "what makes … unsafe" section is about this exact method, so it
    // qualifies alongside the method reference itself.
    expect: ['buffer.html#static-method-bufferallocunsafesize', 'buffer.html#what-makes-bufferallocunsafe']
  },
  {
    id: 'nd-eventemitter',
    query: 'EventEmitter once',
    kind: 'terse',
    expect: ['events.html#emitteroncereventname-listener', 'events.html#eventsonceemitter-name-options', 'events.html#handling-events-only-once']
  },
  { id: 'nd-crypto', query: 'crypto createHash sha256', kind: 'terse', expect: 'crypto.html#cryptocreatehashalgorithm-options' },
  { id: 'nd-pathjoin', query: 'path.join', kind: 'terse', expect: 'path.html#pathjoinpaths' },
  { id: 'nd-parseargs', query: 'util.parseArgs', kind: 'terse', expect: 'util.html#utilparseargsconfig' },

  // --- the same lookups, phrased the way a person actually asks ---
  {
    id: 'nd-readfile-verbose',
    query: 'fs.readFile read a file asynchronously with a callback',
    kind: 'verbose',
    // "with a callback" is specific: only the callback form qualifies.
    expect: 'fs.html#fsreadfilepath-options-callback',
    pairOf: 'nd-readfile'
  },
  {
    id: 'nd-spawn-verbose',
    query: 'child_process.spawn run a command and stream its output',
    kind: 'verbose',
    expect: 'child_process.html#child_processspawncommand-args-options',
    pairOf: 'nd-spawn'
  },
  {
    id: 'nd-crypto-verbose',
    query: 'createHash sha256 hex digest of a string',
    kind: 'verbose',
    expect: ['crypto.html#cryptocreatehashalgorithm-options', 'crypto.html#hashdigestencoding'],
    pairOf: 'nd-crypto'
  },
  {
    id: 'nd-abortsignal-verbose',
    query: 'AbortSignal.timeout to cancel an operation after a delay',
    kind: 'verbose',
    expect: 'abortsignaltimeout',
    pairOf: 'nd-abortsignal'
  },
  {
    id: 'nd-worker-verbose',
    query: 'worker_threads Worker to run javascript on another thread',
    kind: 'verbose',
    expect: ['worker_threads.html#class-worker', 'worker_threads.html#new-workerfilename-options'],
    pairOf: 'nd-worker'
  },
  {
    id: 'nd-eventemitter-verbose',
    query: 'EventEmitter once to handle an event a single time',
    kind: 'verbose',
    expect: ['events.html#emitteroncereventname-listener', 'events.html#handling-events-only-once'],
    pairOf: 'nd-eventemitter'
  },

  // --- natural language, no identifier at all ---
  {
    id: 'nd-nl-env',
    query: 'read environment variables',
    kind: 'natural',
    expect: ['environment_variables.html', 'cli.html#environment-variables', 'process.html#processenv']
  },
  {
    // Was `nd-http-server`, and so was scored as an identifier lookup despite
    // containing no identifier. One of the known defects: every result comes
    // from `http2`.
    id: 'nd-nl-http-server',
    query: 'create an http server',
    kind: 'natural',
    expect: ['http.html#httpcreateserveroptions-requestlistener', 'http.html#class-httpserver']
  },
  {
    // Was `nd-perf`, grouped as terse. `performance.timeOrigin` (the label's
    // old module-level match) is a timestamp of process start, not a way to
    // measure elapsed time; `performance.now()` and `process.hrtime.bigint()`
    // both are.
    id: 'nd-nl-perf',
    query: 'measure elapsed time with high resolution',
    kind: 'natural',
    expect: ['perf_hooks.html#performancenow', 'process.html#processhrtimebigint', 'process.html#processhrtimetime']
  },
  {
    id: 'nd-nl-cli-args',
    query: 'get the command line arguments passed to my script',
    kind: 'natural',
    expect: ['process.html#processargv', 'util.html#utilparseargsconfig']
  },
  {
    id: 'nd-nl-uncaught',
    query: 'handle an exception that was never caught',
    kind: 'natural',
    expect: ['process.html#event-uncaughtexception', 'process.html#warning-using-uncaughtexception-correctly']
  },
  {
    id: 'nd-nl-testrunner',
    query: 'run unit tests without installing a test framework',
    kind: 'natural',
    // Anchored rather than page-level: `test.html` as a substring credited
    // `#only-tests` (filtering with `only`), which is a runner feature and not
    // an answer to how to run tests at all. `cli.html#--test` is excluded for
    // the same reason in reverse — as a substring it also matches
    // `#--test-coverage-lines` and a dozen other flags.
    // `test.html$` (rule 5) names the module's `_intro` chunk, which shows
    // `node:test` end to end — the best answer — without also crediting every
    // other section of the page the way a bare `test.html` label did (it was
    // scoring `#only-tests` as correct).
    expect: ['test.html$', 'test.html#running-tests-from-the-command-line']
  },
  {
    id: 'nd-nl-delay',
    query: 'run a function after a delay',
    kind: 'natural',
    // `globals.html#settimeoutcallback-delay-args` added on inspection: Node
    // documents `setTimeout` a second time on the globals page, and that copy
    // is a genuinely correct answer the timers-only label was rejecting.
    expect: [
      'timers.html#settimeoutcallback-delay-args',
      'timers.html#timerspromisessettimeout',
      'globals.html#settimeoutcallback-delay-args'
    ]
  },
  {
    id: 'nd-nl-lines',
    query: 'read a text file one line at a time',
    kind: 'natural',
    expect: ['readline.html', 'fs.html#filehandlereadlinesoptions']
  }
];
