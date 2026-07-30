# Retrieval quality plan

Status: **executed.** Written 2026-07-29 after a measurement session and carried
out immediately afterwards. Each step below records what was built, where it
diverged from this design, and what it measured. The plan is kept as written
rather than rewritten in hindsight, so that the wrong predictions stay visible.

## Result

Every figure is from `npm run benchmark` over the 102 labelled queries, with the
corpus held fixed at the committed `docs/` tree so that no documentation drift
enters the comparison. All four rows are reproducible and were confirmed
identical across four consecutive runs.

| stage | rerank | r@1 | r@3 | r@5 | MRR |
|---|---|---:|---:|---:|---:|
| step-1 baseline | off | 60% | 74% | 90% | 0.691 |
| + step 2, cap chunk size | off | 62% | 80% | 87% | 0.708 |
| + step 3, embed heading path | off | 64% | 79% | 89% | 0.723 |
| + step 4, cross-encoder rerank | on | 70% | 89% | 92% | 0.789 |
| + step 5, re-swept weights | on | **71%** | **89%** | **93%** | **0.799** |

By query kind, baseline → final:

| kind | n | r@1 | r@3 | r@5 | MRR |
|---|---:|---|---|---|---|
| identifier (terse) | 40 | 78% → **88%** | 88% → 93% | 95% → 95% | 0.833 → 0.902 |
| identifier (verbose) | 26 | 50% → **58%** | 69% → **92%** | 92% → 96% | 0.626 → 0.734 |
| natural language | 33 | 42% → **58%** | 58% → **82%** | 82% → 88% | 0.540 → 0.706 |
| language filter | 3 | 100% | 100% | 100% | 1.000 |

Natural-language recall@1 — the group this plan was written to fix — goes 42% →
58%, and its recall@3 58% → 82%. The r@1-to-r@5 gap that step 4 targeted closes
from 30 points to 22.

Per corpus, baseline → final recall@1: JavaScript 70% → **91%**, Playwright 68% →
74%, Node 50% → 58%, TypeScript 50% → 58%.

Of the five known genuine defects, **three are fixed outright**: "create an http
server", "temporal dead zone let const hoisting" and "difference between an
interface and a type alias" all now rank 1. Two improved without reaching rank 1:
"how do I mask elements in a screenshot comparison" 4 → 2, and "how do I log in
once and reuse the session" absent from the top 5 → 5.

### What did not improve

- **Verbose identifier recall@1 moved only at the last step.** Steps 2-4 left it
  at 54%; re-sweeping the weights in step 5 took it to 58%. The sweep shows it
  would reach 65% at `text 0.7`, but only by dropping natural-language recall to
  45% — the trade-off is real and unresolved, and it is the clearest remaining
  lead.
- **TypeScript is barely helped by reranking and is hurt at the top.** Reranking
  moves its recall@1 not at all (58% → 58%), and "type narrowing with typeof" —
  which passed at rank 1 before — now misses the top 5 entirely, answered with a
  release-note section. An ms-marco-trained reranker over handbook prose is the
  plausible cause. TypeScript remains the weakest corpus at 58%, against
  JavaScript's 91%.
- **Overall recall@5 barely moved** (90% → 93%), and step 2 alone *cost* 3
  points of it. Splitting puts more chunks in competition, so a top-5 window
  covers fewer distinct pages.
- **Six queries still miss the top 5 entirely.** Three on TypeScript ("make the
  compiler check my code more strictly", "should I use an enum or a plain object
  of constants", "require a type parameter to have certain properties") plus
  "type narrowing with typeof"; two on Node, both `worker_threads Worker` in its
  terse and verbose forms. In every case the correct section is in the index and
  retrievable — `npm run inspect` confirms it — so all six are ranking failures,
  not coverage gaps.

### Cost

- 22,394 heading sections → 30,309 indexed chunks (+35%); indexes total ~370 MB.
- One extra ~23 MB model download for the reranker.
- Median query latency 13 ms → 439 ms, entirely the reranker's ~25 forward
  passes. `rerank: false` in `src/search/tuning.ts` reverts that at the cost of
  7 points of recall@1 and 10 of recall@3.

## Why this exists

A session spent fixing two chunking defects and building a benchmark ended by
finding a larger problem underneath both: **chunks are much larger than the
embedding model's input window, and the overflow is discarded silently.** That
finding reframes the earlier work — the tuning sweep, and a proposal to add
query-adaptive weighting, were both aimed at symptoms.

Two process notes that should shape how this plan is executed:

- Three defects this session were found by measuring, not by reasoning. Two
  confident hypotheses turned out wrong (that verbose identifier queries were
  broadly broken; that rebalancing toward keyword search would help).
- The benchmark that will judge every step below currently **understates**
  performance. Fixing that is step 1 for exactly that reason.

## Established measurements

All figures below were measured, not estimated. They are the baseline to beat.

### The embedding window

`Xenova/all-MiniLM-L6-v2` has `model_max_length: 512`. Beyond that, input is
truncated before embedding, with no error. Demonstrated: two texts sharing a
3,480-char prefix and having entirely different tails embed to cosine
similarity `1.000000` — bit-identical vectors. The suffix stops affecting the
vector somewhere between 1,000 and 1,500 characters of prose.

Using ~1,500 chars as the effective window:

| corpus | chunks | median | max | over window | **corpus text never embedded** |
|---|---:|---:|---:|---:|---:|
| playwright | 6,119 | 609 | 19,755 | 1,436 (23.5%) | **42.7%** |
| typescript | 1,396 | 858 | 52,654 | 377 (27.0%) | **29.4%** |
| node-runtime | 4,940 | 376 | 14,794 | 652 (13.2%) | **24.8%** |
| javascript | 9,939 | 366 | 43,479 | 738 (7.4%) | **17.4%** |

BM25 still indexes the full text, so this content is keyword-findable. The
vector half of hybrid search cannot see it at all — which is why
natural-language queries, the ones that depend on the vector side, are the weak
group.

Worked example: the `page.screenshot` chunk is 4,635 chars. `mask` first appears
at 1,398 — right at the boundary — and `maskColor` at 1,585, outside it. About
67% of that chunk is never embedded. The query "how do I mask elements in a
screenshot comparison" ranks a page that never mentions "mask" above it.

### Benchmark baseline

`npm run benchmark`, tuning `text 0.3 / vector 0.7`, `similarity 0.1`,
`titleBoost 3` (from `src/search/tuning.ts`):

| corpus | n | r@1 | r@3 | r@5 | MRR |
|---|---:|---:|---:|---:|---:|
| playwright | 28 | 75% | 86% | 96% | 0.817 |
| typescript | 12 | 83% | 100% | 100% | 0.903 |
| javascript | 12 | 67% | 83% | 100% | 0.792 |
| node-runtime | 12 | 92% | 92% | 92% | 0.917 |
| **overall** | **64** | **78%** | **89%** | **97%** | **0.847** |

Playwright by query style: bare identifier 92% r@1, identifier + prose 86%,
no identifier 38%.

### Tuning sweep (already done — do not repeat before step 5)

24 configurations over `hybridWeights` × `similarity` × `titleBoost`:

- committed `0.3/0.7` ties for best overall MRR *and* best verbose-identifier recall
- shifting toward text degrades monotonically; `0.8/0.2` drops overall r@1 to 59%
- `similarity` is inert across 0.05–0.2 — not the binding constraint there
- `titleBoost: 3` beats `1`; `6` is a wash

Conclusion recorded in the README: no tuning change is justified *for the
current chunking*. Step 5 revisits this because steps 2–4 change the inputs.

### Known genuine defects

| query | corpus | symptom |
|---|---|---|
| "how do I mask elements in a screenshot comparison" | playwright | `Attachments` (never says "mask") ranks #1 |
| "how do I log in once and reuse the session" | playwright | `auth` guide absent from top 5 |
| "create an http server" | node | all results from `http2`, never `http` |
| "temporal dead zone let const hoisting" | javascript | collides with the `Temporal` API |
| "difference between an interface and a type alias" | typescript | correct answer at rank 3 |

---

## Step 1 — Make the benchmark trustworthy — **done**

**Nothing below can be judged until this is done.** Labels are URL substrings,
so a correct answer living at a different URL scores as a failure. Three
confirmed cases where the #1 result was right and the label rejected it:
`js-optional-chaining`, `js-spread`, `ts-utility`. Absolute numbers in the
README are therefore pessimistic, including the widely-quoted 38%.

### Work

1. For every query in `tests/fixtures/benchmark-queries.ts`, inspect the top 5
   and enumerate *all* genuinely correct URLs. `expect` already accepts
   `string | string[]`.
2. **Guard against fitting the benchmark to current behaviour.** A URL may be
   added only if the page answers the question on its own merits, judged by
   reading it — never because it happened to rank well. Record the reason inline
   as a comment. The five defects above must still fail afterwards; if any
   silently starts passing, the label was loosened wrongly.
3. Expand coverage. Current fixture is Playwright-heavy: 28 of 64 queries, and 8
   of 10 natural-language ones. TypeScript, JavaScript and Node have **one**
   natural-language query each, which supports no conclusion at all. Target ≥6
   per corpus, ~100 queries total.
4. Add the queries that failed in real use and are unrepresented, notably
   "how do I mask elements in a screenshot comparison".
5. Correct the README once re-baselined: the "38%" line is currently stated as
   measured fact and should not be until this step lands.

### Verification

Re-run `npm run benchmark`. Expect overall r@1 to rise purely from label
correctness — that rise is measurement error being removed, not improvement, and
must be described as such. Record the new baseline in this file.

### Outcome — the prediction above was wrong in sign

**r@1 fell, 78% → 60%.** The step was written expecting labels to be uniformly
too strict. Inspecting all 64 top-5s found the opposite error dominating: labels
were, on net, too *loose*. Both errors were real and both were corrected.

- **Too strict, corrected upward** — the three predicted cases
  (`js-optional-chaining`, `js-spread`, `ts-utility`) all held up on reading, plus
  four more found by inspection: `ts-keyof-verbose`, `ts-narrowing-verbose`,
  `js-generator`, `nd-nl-delay` (Node documents `setTimeout` twice, and the
  timers-only label rejected the `globals.html` copy).
- **Too loose, corrected downward** — every Node label named a *module*
  (`fs.html`), so `fs.readFile` scored rank 1 on `fs.html#fsfsyncsyncfd` and
  `worker_threads Worker` on `worker_threads.html#worker_threadsthreadName`. The
  fixture's own header already said a label "should name the anchor that uniquely
  identifies the right chunk"; Node's labels never did. Node's r@1 is 92% under
  module labels and 50% under anchor labels, measuring the same index. Playwright
  and TypeScript had page-level versions of the same defect (`parallel` credited
  `class-testinfo#test-info-parallel-index`; `unions` credited every release note
  mentioning a union).
- **A substring bug** — `Array/reduce` is a substring of `Array/reduceRight`,
  which was ranking #1 and scoring as a hit for "Array.prototype.reduce". Labels
  can now end in `$` to anchor to the end of the URL, which also makes a page's
  `_intro` chunk nameable for the first time.
- **Mis-grouping** — the report split groups by testing `id.includes('-nl-')`.
  That counted `js-closures` ("how do closures work") as an identifier lookup and
  put the three language-filter probes in with the terse identifiers. Queries now
  carry an explicit `kind`, and the report groups on it.

None of the five known genuine defects started passing: `pw-nl-auth`,
`nd-nl-http-server` and `js-tempdead` still miss the top 5 entirely, and
`pw-nl-mask` and `ts-nl-interface` still fail at rank 1 (both rank 4).

Coverage went 64 → 102 queries, and natural-language coverage 10 → 33, which was
the point: TypeScript, JavaScript and Node had one such query each and now have
7, 7 and 8.

### New baseline — this is what steps 2-6 must beat

`npm run benchmark`, unchanged index, unchanged tuning (`text 0.3 / vector 0.7`,
`similarity 0.1`, `titleBoost 3`):

| corpus | n | r@1 | r@3 | r@5 | MRR |
|---|---:|---:|---:|---:|---:|
| playwright | 31 | 68% | 81% | 97% | 0.765 |
| typescript | 24 | 50% | 71% | 88% | 0.618 |
| javascript | 23 | 70% | 83% | 96% | 0.786 |
| node-runtime | 24 | 50% | 58% | 79% | 0.576 |
| **overall** | **102** | **60%** | **74%** | **90%** | **0.691** |

Pooled across corpora by query kind — the per-corpus groups are 7-11 queries, so
one query moves them 9-14 points and the pooled numbers are the ones to watch:

| kind | n | r@1 | r@3 | r@5 | MRR |
|---|---:|---:|---:|---:|---:|
| identifier (terse) | 40 | 78% | 88% | 95% | 0.833 |
| identifier (verbose) | 26 | 50% | 69% | 92% | 0.626 |
| natural language | 33 | 42% | 58% | 82% | 0.540 |
| language filter | 3 | 100% | 100% | 100% | 1.000 |

The r@1 → r@5 gap that step 4 targets is now 60% → 90%, and it is widest exactly
where the plan predicted: natural language, 42% → 82%.

`npm run inspect` was added to make this step repeatable — it prints the top-N
with the label's match marked, per query or ad hoc, which is what distinguishes a
wrong label from a wrong result.

**Cost:** no resync. Judgement-heavy, no technical risk.

---

## Step 2 — Cap chunk size, with overlap — **implemented**

The main event. Every chunk must fit the embedding window.

### Design

New shared module (suggested `src/chunk/split.ts`), used by all four chunkers
after heading slicing, in the same spirit as `src/chunk/emptySection.ts`.

**Budget with the real tokenizer, not a character heuristic.** Markdown with
code fences tokenizes far denser than prose, so any chars-per-token constant
will be wrong for exactly the API-reference chunks that overflow worst.
`@huggingface/transformers` exposes `AutoTokenizer`; tokenizing each chunk once
per sync is negligible beside the embedding pass. This couples the chunker to
the model, which is a real cost — accept it and note it where `EMBEDDING_DIM`
is declared, so a model swap is known to touch both.

Suggested budget: **~400 tokens of content, ~60 tokens overlap**, leaving
headroom under 512 for step 3's heading prefix. Tune once measured.

**Splitting must respect structure.** This is the hard part and the whole reason
the existing chunker slices at byte offsets:

- never split inside a fenced code block — carry the fence into the next part
  and reopen it, or keep an oversized fence intact and accept it
- prefer paragraph, then list-item, then sentence boundaries
- never split mid-line

**IDs and citations.** Sub-chunks need unique ids — suffix `~1`, `~2` on the
existing slug. `sourceUrl` should stay the section anchor: every part cites the
same upstream section, and inventing sub-anchors would produce dead links.

### Consequences to size before committing

- **Chunk count grows.** Rough expectation +25–40% overall, worst for
  Playwright and TypeScript. Measure exactly with a probe over the committed
  `docs/` tree before any resync — this technique worked well in the previous
  session, predicting 6,357/1,466 against actuals of 6,356/1,466.
- **Index size grows** proportionally. `javascript.msp` is already ~106 MB.
- **Embedding time grows.** The MDN corpus is the slow one and will get slower.
- `dedupeByContent` will see overlapping parts as distinct content, which is
  correct, but overlap means adjacent parts share text — watch for
  near-duplicate results that dedupe won't catch because they aren't identical.
  If that shows up, it is a *new* problem, not one to pre-solve here.

### Tests (mandatory — this is a chunker change)

- a chunk under budget passes through byte-identical
- an oversized prose chunk splits with the expected overlap
- **a fenced code block is never split across parts** (the case that matters most)
- a single code fence larger than the budget is handled deliberately, not silently corrupted
- sub-chunk ids are unique and stable
- every emitted chunk is within budget, asserted by tokenizing

### As built — where it diverged from this design

Four things came out differently, three of them because the rules above conflict
with each other in this markdown.

**The budget is 440, not 400, and it was chosen by measurement.** The headroom
calculation in the design was wrong in a useful direction: overlap is *not*
additive to the cap (a part's total, overlap included, is what must fit), so 400
left 112 tokens spare rather than ~50. `npm run probe` measures the step-3 prefix
at a 5-17 token median and a **51-token maximum** (Node's deep
`module > class > event` paths), so 440 leaves 72 — enough, with the extractor's
two special tokens. Raising the cap matters because splitting costs chunk count,
steeply: Playwright grows +84% at a 400 cap and +74% at 440. 460 was rejected as
too close to a 51-token observed maximum.

**A list item outranks a paragraph.** The rule as written — "prefer paragraph,
then list-item" — is backwards for these corpora, and following it produced a
real defect. Playwright and Node document an option as a marker line naming it
plus a *separate indented paragraph* explaining it, so a paragraph-first split
put `- \`quality\` number *(optional)*` at the end of one part and "The quality of
the image, between 0-100…" at the start of the next: a chunk describing an option
without ever naming it, which is the same failure as separating `mask` from
`maskColor`. Items are now kept whole, nested ones included, and only broken up
when a single item exceeds the budget. Verified on `page.screenshot`: all 13 of
its options are now named in the same part that describes them, and every part
begins on an option boundary.

**"Prefer sentence boundaries" was dropped, deliberately.** It cannot coexist
with "never split mid-line" — a paragraph written as one long line with ten
sentences in it cannot be cut on a sentence boundary without cutting mid-line.
Mid-line is the stronger guarantee (it is what protects table rows and lines of
code), and it costs little here because the TypeScript handbook and MDN both
write one sentence per line, so line boundaries usually *are* sentence
boundaries.

**Open question answered: an oversized fence is split and reopened.** Keeping it
whole would leave exactly the worst chunks — huge API-reference examples — still
truncated at embedding time, defeating the point. Each piece is closed and
reopened with the same info string, so it is still renderable markdown, and cuts
land only on line boundaries so no line of code is corrupted. The cost is that a
sample can be cut mid-function.

**The splitter runs at the pipeline edge, not inside the chunkers.** The design
said "used by all four chunkers", but the tokenizer loads asynchronously and
making four synchronous chunkers async would have rippled into every chunker
test for no benefit. Instead `splitChunks` takes a `CountTokens` and stays
synchronous and stub-testable, the four sync scripts call it after chunking, and
the model coupling lives in `src/search/embed.ts` next to `MODEL_NAME` — with
`MODEL_MAX_TOKENS` added there so a model swap is known to touch all three
values.

### Measured consequences

`npm run probe`, over the committed `docs/` tree, before any resync. The "before"
chunk counts match the committed indexes exactly (6,119 / 1,396 / 9,939 / 4,940),
which is what validates the technique:

| corpus | sections | chunks after | growth | median tok | max tok | over budget |
|---|---:|---:|---:|---:|---:|---:|
| playwright | 6,119 | 10,637 | +73.8% | 263 | 440 | 0 |
| typescript | 1,396 | 2,063 | +47.8% | 268 | 440 | 0 |
| javascript | 9,939 | 11,301 | +13.7% | 136 | 846 | 11 |
| node-runtime | 4,940 | 6,308 | +27.7% | 157 | 440 | 0 |
| **total** | **22,394** | **30,309** | **+35.3%** | | | **11** |

Growth is roughly double the design's +25-40% guess for Playwright, and the share
of corpus text never reaching the embedder goes from 43.0% / 26.1% / 14.0% /
23.0% to **0.0% / 0.0% / 0.1% / 0.0%**. The 11 remaining over-budget chunks are
exactly the 11 chunks containing a *single line* longer than the budget, all in
MDN — the one case that cannot be fixed without cutting mid-line, so it is
reported rather than hidden.

### Verification

Probe `docs/` for new counts and assert `max(tokens) <= budget` across all four
corpora, then resync and re-run the benchmark. **Expect natural-language recall
to be where the gain shows up.** If it does not move, that is an important
negative result — record it here rather than proceeding on faith to step 4.

**Cost:** full resync of all four corpora, including MDN.

### Measured — the prediction held, and it cost something

Reranking off, so this is step 2 alone against the step-1 baseline:

| group | r@1 | r@3 | r@5 | MRR |
|---|---|---|---|---|
| all | 60% → 62% | 74% → 80% | 90% → **87%** | 0.691 → 0.708 |
| identifier (terse) | 78% → **73%** | 88% → 90% | 95% → 93% | 0.833 → 0.810 |
| identifier (verbose) | 50% → 54% | 69% → 77% | 92% → 88% | 0.626 → 0.647 |
| natural language | 42% → **52%** | 58% → 70% | 82% → 79% | 0.540 → 0.607 |

**The open question is answered: yes, capping chunk size moves natural-language
recall, by +10 points at r@1 and +12 at r@3.** The causal story was right.

It also costs 5 points of terse-identifier recall@1 and 3 of overall recall@5,
which the plan did not anticipate. The mechanism is visible per corpus:
Playwright gains (68% → 74%, natural language 27% → 55%) while **Node loses
badly, 50% → 33%**. Node's sections are already method-level — its chunker
tracks headings to H5 — so splitting them fragments a method into parts whose
bodies no longer name the method. That is precisely the context step 3 supplies,
and step 3 recovers it: Node's terse recall goes 40% → 60% and the pooled terse
figure returns to the 78% baseline. Running the two separately is what made that
diagnosis possible rather than a guess.

---

## Step 3 — Put the heading path into the embedded text — **implemented**

`indexChunks` embeds `chunk.content` alone, so the vector has no idea a chunk
sits under `class-page` → `Methods` → `screenshot`. BM25 sees `title` with a 3×
boost; the vector sees nothing.

### Work

In the four `buildIndex.ts` files, embed `"${title} > ${headingPath}: ${content}"`
while **storing `content` unchanged** — the stored value is what the agent reads
and what dedupe compares, and it must not gain a synthetic prefix. Schema
unchanged.

Coordinate the prefix length with step 2's token budget; that is why the budget
leaves headroom.

Do this in the **same resync as step 2** — both are index-only changes and the
MDN embedding pass is too slow to spend twice.

Caveat: bundling them means one resync cannot attribute the gain between the
two. If attribution matters, run the benchmark on step 2 alone first, then add
step 3 — at the price of a second full resync.

### As built

`embedPrefix(title, headingPath)` lives in `src/search/embed.ts` and is applied
by all four `indexChunks`; `content` is stored byte-unchanged. The prefix drops a
`headingPath` entry equal to `title`, which would otherwise emit
`screenshot > screenshot: `.

**Attribution was paid for, and it cost no extra resync.** The design offered
attribution only "at the price of a second full resync", but a resync also
re-clones upstream — which would have mixed documentation drift into the
measurement and made even the bundled number unattributable. `scripts/reindex.ts`
rebuilds from the committed `docs/` instead, so the corpus is held fixed and only
the pipeline changes; `--no-split` and `--no-prefix` turn off one change at a
time, and `INDEX_SUBDIR` keeps a candidate index away from the one the server is
serving. It was validated before being trusted: `reindex --no-split --no-prefix`
reproduces the committed TypeScript index's benchmark numbers *exactly*, group
breakdown and misses included.

One asymmetry worth recording: documents get the prefix, queries do not.
MiniLM-L6-v2 is a symmetric similarity model, so this shifts document vectors
without a matching shift on the query side. Whether that helps is what the
measurement below decides rather than something to argue about.

### Measured — it pays for step 2's regression, and little else

Reranking off, step 2 alone → steps 2+3:

| group | r@1 | r@3 | r@5 | MRR |
|---|---|---|---|---|
| all | 62% → 64% | 80% → 79% | 87% → 89% | 0.708 → 0.723 |
| identifier (terse) | 73% → **78%** | 90% → 93% | 93% → 98% | 0.810 → 0.849 |
| identifier (verbose) | 54% → 54% | 77% → 73% | 88% → 81% | 0.647 → 0.633 |
| natural language | 52% → 52% | 70% → 67% | 79% → 85% | 0.607 → 0.617 |

The prefix does one thing, and does it exactly: it restores the terse-identifier
recall that splitting cost, 73% → 78%, back to the baseline, while leaving step
2's natural-language gain intact. Per corpus the effect is concentrated where
predicted — Node, which has the deepest heading paths and lost the most to
splitting, recovers 33% → 46% overall and 40% → 60% on terse identifiers.

It is not a free win everywhere. **TypeScript gets worse: 63% → 58%**, with
verbose recall@1 dropping 43% → 29%. TypeScript's heading paths are the
shallowest of the four corpora and its `title` often repeats the heading, so the
prefix adds little signal while still shifting every document vector. That is the
cost of an asymmetric prefix on a symmetric model, and it is a reason to re-check
this if the embedding model is ever swapped.

---

## Step 4 — Cross-encoder reranking — **implemented**

The standard layer this project lacks, and the one aimed squarely at the
observed failure mode: **every miss found so far has the right answer at #2–#5.**

### Design

New `src/search/rerank.ts` using `Xenova/ms-marco-MiniLM-L-6-v2` (~23 MB, caches
into `.cache/models/` like the embedder — `MODEL_CACHE_DIR` already handles this).

Flow: hybrid retrieve → dedupe → rerank top ~25 → slice to `limit`. A
cross-encoder scores query and document *together*, so it is much stronger than
cosine over independently-computed vectors.

- `overfetchLimit` (currently `limit × 4`, capped 100) must supply enough
  candidates; reranking wants ~25–30 regardless of `limit`
- add an on/off switch through `Tuning` so the benchmark can A/B it and so it
  can be disabled if latency is unacceptable
- measure and record added latency per call — roughly 25 forward passes

### As built

`rerank(query, candidates)` in `src/search/rerank.ts`, loaded once per process
like the embedder, called by all four query modules after dedupe. `Tuning` gained
`rerank: boolean` and `rerankCandidates: number`; `wanted` is
`max(rerankCandidates, limit)` when reranking and `limit` otherwise, so
`overfetchLimit` supplies 100 raw hits to collapse down to ~25 candidates. The
cross-encoder's raw logit replaces `score` — the values run about -12 to +12 and
are not comparable with the hybrid scores they replace, only their order is. The
MCP server never reads `score`, so nothing user-facing changed shape.

The document side of a pair is `"${title} > ${headingPath}: ${content}"`, the
same composition as the embedded text — a test asserts that, because a divergence
would mean the reranker judges documents by a different description than the one
they were indexed under.

One limit found by checking rather than assuming: this model's window is also
512, and a pair is `[CLS] query [SEP] doc [SEP]`, so a 440-token chunk plus
prefix plus query sits within a few tokens of it and the longest candidates lose
a little of their tail. Left to `truncation: true` rather than cutting the chunk
budget further: this costs the tail of one candidate in a reordering decision,
where the embedding case was discarding 43% of a corpus.

### Verification

Benchmark with and without. The success criterion is **r@1 rising toward the
existing r@5** — after step 1's re-labelling that gap is 60% → 90%, and it is
widest exactly where predicted: natural language, 42% → 82%. Also confirm the five
known defects individually.

**Cost:** no resync. One extra model download.

### Measured — the largest single gain in the plan

Same index, reranking off → on:

| group | r@1 | r@3 | r@5 | MRR |
|---|---|---|---|---|
| all | 64% → **70%** | 79% → **89%** | 89% → 92% | 0.723 → 0.789 |
| identifier (terse) | 78% → **88%** | 93% → 93% | 98% → **93%** | 0.849 → 0.896 |
| identifier (verbose) | 54% → 54% | 73% → **92%** | 81% → 92% | 0.633 → 0.705 |
| natural language | 52% → **58%** | 67% → **82%** | 85% → 91% | 0.617 → 0.707 |

The success criterion was r@1 rising toward r@5, and it does: the gap closes from
25 points to 22, and recall@3 gains 10 points, which is the clearer signal — the
reranker is very good at pulling a correct answer from rank 4-5 into the top 3
and less reliable about the final step to rank 1.

Latency, measured over all 102 queries in one process: **median 13 ms → 440 ms**,
p95 491 ms, max 687 ms. That is ~25 forward passes of a 6-layer cross-encoder, and
it is the whole reason `rerank` is a switch.

Three negatives:

- **Verbose identifier recall@1 does not move at all** (54% → 54%), even though
  its r@3 gains 19 points. The one group whose defect motivated the pairing in
  the fixture is the group reranking helps least at rank 1.
- **Terse recall@5 drops 98% → 93%.** Reranking reorders a fixed candidate pool,
  so it can push a correct answer that was at rank 4-5 out of the window when it
  scores something else higher.
- **TypeScript does not benefit**: r@1 flat at 58%, r@3 75% → 71%, r@5 79% → 75%.
  Two queries that passed now miss, both answered with a handbook index page
  ("Compiler Options" for "strictNullChecks compiler option"). This is the one
  place where the committed default is worse than the alternative for a single
  corpus, and it is recorded rather than tuned away, because `Tuning` is global
  and the pooled numbers are decisively better.

### An unplanned defect this branch introduced, found by inspection

Splitting means one section can be several overlapping chunks, and the plan
flagged that dedupe would not catch them: "If that shows up, it is a *new*
problem, not one to pre-solve here." It showed up — on "difference between an
interface and a type alias", **five of six result slots were parts of just two
sections** — so it was solved rather than left in.

`collapseSiblingParts` keeps one result per `sourceUrl`. There is nothing to put
on `alsoAt`, unlike the cross-class case: sibling parts share a URL, a title and
a heading path, so an agent that receives two of them cannot tell them apart and
gains nothing over the best-matching one plus a different section.

Where it runs was measured, not reasoned: collapsing *before* reranking narrows
the cross-encoder's pool to one chunk per section and cost 1 point of recall@1
and 3 of recall@3 (70%/89% → 69%/86%), so it runs *after*.

---

## Step 5 — Re-run the tuning sweep — **done, and the optimum did move**

Steps 2–4 change what the retriever sees, so the current optimum almost
certainly moves — notably, the argument for `vector 0.7` was made against
truncated embeddings. Also sweep the rerank candidate count.

Update `src/search/tuning.ts` and the README design note only with sweep
evidence, in keeping with how that note is currently written.

### The sweep

28 configurations, `npm run benchmark -- --sweep`. `similarity` is omitted below
because it is still almost entirely inert: 0.05 and 0.1 give identical results at
every weighting, and 0.2 differs only in MRR, by at most 0.004.

| text/vector | titleBoost | rerank | all r@1 | verbose r@1 | natural r@1 | MRR |
|---|---:|---:|---:|---:|---:|---:|
| 0.2/0.8 | 3 | 25 | 69% | 54% | 55% | 0.787 |
| **0.3/0.7** (previous) | 3 | 25 | 70% | 54% | 58% | 0.789 |
| 0.4/0.6 | 3 | 25 | 69% | 54% | 55% | 0.785 |
| **0.5/0.5** (adopted) | 3 | 25 | **71%** | **58%** | **58%** | **0.799** |
| 0.6/0.4 | 3 | 25 | 70% | 58% | 55% | 0.792 |
| 0.7/0.3 | 3 | 25 | 69% | **65%** | 45% | 0.767 |
| 0.8/0.2 | 3 | 25 | 68% | 65% | 42% | 0.743 |
| 0.5/0.5 | 1 | 25 | 68% | 50% | 55% | 0.783 |
| 0.5/0.5 | 6 | 25 | 71% | 62% | 55% | 0.801 |
| 0.3/0.7 | 3 | 10 | 69% | 62% | 52% | 0.787 |
| 0.3/0.7 | 3 | 40 | 67% | 54% | 52% | 0.774 |
| 0.3/0.7 | 3 | **off** | 64% | 54% | 52% | 0.723 |

### What changed, and what deliberately did not

**Adopted: `text 0.5 / vector 0.5`.** The prediction in this plan was right — the
case for `vector 0.7` was made against truncated embeddings, and once the
embedder actually sees the whole chunk, an even split is better: recall@1 70% →
71%, MRR 0.789 → 0.799, verbose-identifier recall@1 54% → 58%, with
natural-language recall unchanged at 58%. This also **overturns a finding
recorded in the README**: "shifting weight toward text degrades both
monotonically" was true of the old chunking and is not true now. Verbose
identifier recall now *peaks* at `text 0.7` (65%).

**Not adopted: `titleBoost: 6`.** It is the best single row by MRR (0.801 vs
0.799) and buys 4 points of verbose recall, but it costs 3 points of natural
language. That is one query each way on n=26 and n=33 — a trade, not an
improvement, and the plan's standing conclusion that "6 is a wash" survives with
that refinement.

**Not adopted: `similarity: 0.2`.** Nominally the best row by MRR (0.803), but the
margin over 0.1 is 0.004 with identical recall at every k, which is inside what
one query moving one rank does. The established finding — inert anywhere in
0.05–0.2 — holds, and changing a value the README explains for a delta that
small would be fitting the benchmark.

**Confirmed: `rerankCandidates: 25`.** Both directions are worse — 10 gives MRR
0.787 and 40 gives 0.774. More candidates is not better: a wider pool gives the
cross-encoder more chances to promote something wrong, which is worth knowing
before anyone tries to buy accuracy by raising it.

**Confirmed in the same grid: reranking is the single largest contributor.**
Turning it off, with everything else held at the previous tuning, drops MRR
0.789 → 0.723 and recall@1 70% → 64%.

---

## Step 6 — CI, and optionally the embedding model

**CI — done.** `.github/workflows/ci.yml` runs `typecheck` + `test` on push to
`main` and on every PR, across Node 20 (the `engines` floor) and 24. Install is
`npm ci --ignore-scripts`: the native postinstall builds that `allowScripts`
approves locally (onnxruntime-node, sharp, esbuild) buy nothing here, because
neither the typecheck nor the unit suite loads a model or runs an ONNX session —
`tests/split.test.ts` budgets against a stub token counter precisely so that it
does not need a tokenizer, and `tests/rerank.test.ts` only exercises the paths
that return before the model loads. Verified by running both steps against a
clean `--ignore-scripts` install rather than assuming. The benchmark, probe and
reindex are all excluded: they need the indexes (gitignored, ~370 MB) and two of
them need the model.

**Model swap — evaluated and declined, with the numbers.** Both candidates were
checked rather than recalled:

| model | dim | window | layers |
|---|---:|---:|---:|
| `Xenova/all-MiniLM-L6-v2` (current) | 384 | 512 | 6 |
| `Xenova/bge-small-en-v1.5` | 384 | 512 | **12** |
| `Xenova/gte-small` | 384 | 512 | **12** |

The good news the plan hoped for holds: both are 384-dim, so `EMBEDDING_DIM` is
unchanged, and both have a 512 window, so step 2's budget carries over untouched.
The cost the plan did not note is that both are **12-layer**, twice MiniLM-L6's
depth — so roughly twice the embedding time on a corpus that just grew 35%, and
twice the per-query latency on top of the reranker's.

Declining for now, on the plan's own reasoning: nothing measured points at the
embedding model as the bottleneck. What the measurements *do* point at is
recorded per step above. Worth revisiting only if the remaining defects turn out
to be recall failures — candidates the retriever never surfaces — since a
stronger embedder helps there and a reranker cannot.

---

## Ordering

1. **Step 1** — trustworthy benchmark, or everything after is unmeasurable
2. **Steps 2 + 3** — one shared resync; the substantive fix
3. **Step 4** — reranking, no resync
4. **Step 5** — re-sweep
5. **Step 6** — CI, then optionally the model

## What the next session should look at

Ordered by what the measurements actually point at, not by what sounds
promising.

1. **TypeScript is the weakest corpus and the only one the reranker hurts.** It
   is now 58% recall@1 against JavaScript's 87%, three of its natural-language
   queries miss the top 5 with the right section retrievable, and both
   `rerank` and the heading prefix score *worse* on it than without. Whatever is
   wrong is specific to handbook prose. Worth its own investigation before any
   more global tuning.
2. **A TypeScript chunking defect found in passing and not fixed.** `Narrowing.md`
   has `# Discriminated unions`, `# The never type` and `# Exhaustiveness
   checking` as **H1s in the middle of the document**. The chunkers treat depth 1
   as the document title, so those three sections are never emitted as chunks —
   their text is absorbed into whichever H2 chunk precedes them. That is why
   `ts-discriminated` has to be labelled against a functional-programmers page
   rather than the handbook's own section. Out of scope here because it is a
   chunker change with its own resync, but it is a genuine content gap, not a
   ranking problem.
3. **Verbose identifier queries at rank 1.** The one group nothing in this plan
   moved (50% → 54%). Its recall@3 is 92%, so the answer is nearly always in
   view; something about identifier-plus-prose keeps it off the top.
4. **A stronger reranker rather than a stronger embedder.** Step 6 declined the
   embedding-model swap because nothing points at the embedder. What the residual
   failures do point at is the reranker: `ms-marco-MiniLM-L-6-v2` is trained on
   web-search queries, and its failures here are on documentation prose. A larger
   or differently-trained cross-encoder is a cheaper experiment than a re-embed,
   because it needs no reindex at all.

## Out of scope

- **MDN's 967 redundant chunks (9.7%).** `dedupeByContent` collapses them per
  query, but the cause is unexamined and is not Playwright's cross-class cause.
  Deserves its own investigation.
- **Sync never deletes pages removed upstream** — a known, documented limitation.
- **No freshness signal** — a stale index is silent.
- **Committing indexes** — they stay gitignored and regenerable.
- **Memory footprint** — a server touching all four tools holds all four indexes
  resident. Not currently a reported problem.

## Open questions

- ~~Does step 2 actually move natural-language recall?~~ **Answered: yes.**
  +10 points at recall@1 (42% → 52%) and +12 at recall@3, with reranking off so
  nothing else can account for it. See step 2's "Measured".
- ~~Is per-query adaptive weighting still worth anything after steps 2–4?~~
  **Probably not, and the evidence now says why.** The plan's own doubt was the
  right one: every query still missing the top 5 is a TypeScript
  natural-language question with no distinctive identifier to weight —
  "make the compiler check my code more strictly", "should I use an enum or a
  plain object of constants". Adaptive weighting has nothing to act on there. And
  the `mask` case it was proposed for is now rank 2 rather than absent. What the
  residual failures have in common is that the correct section *is* retrieved and
  then ranked below something else, which is a reranking problem, not a weighting
  one.
- ~~How should an oversized single code fence be handled — split with reopened
  fences, or kept whole and over budget?~~ **Answered: split and reopened.**
  Keeping it whole would leave the worst chunks still truncated, which defeats
  step 2 entirely. See step 2's "As built".

## Repository state at time of writing

Five commits sit local and **unpushed** on `main` above `dba9f54`:
`cd2f344`, `30982fe`, `1f1e967`, `dd5cc1d`, `048cc44`. Push before starting, so
this work does not stack on an unreviewed diff.

Indexes on disk reflect: Playwright 6,119 chunks, TypeScript 1,396, JavaScript
9,939, Node 4,940. The MCP server is registered at user scope and caches its
index for the process lifetime — **restart the client after any resync.**

*(Checked at the start of execution: `main` was level with `origin/main`, so those
five commits were already pushed. The chunk counts above were confirmed exactly by
`npm run probe`, which is what established that probing `docs/` is a faithful
stand-in for a resync.)*
