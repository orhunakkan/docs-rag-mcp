# Retrieval quality plan

Status: **not started.** Written 2026-07-29 after a measurement session. Nothing
in here has been implemented.

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

## Step 1 — Make the benchmark trustworthy

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

**Cost:** no resync. Judgement-heavy, no technical risk.

---

## Step 2 — Cap chunk size, with overlap

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

### Verification

Probe `docs/` for new counts and assert `max(tokens) <= budget` across all four
corpora, then resync and re-run the benchmark. **Expect natural-language recall
to be where the gain shows up.** If it does not move, that is an important
negative result — record it here rather than proceeding on faith to step 4.

**Cost:** full resync of all four corpora, including MDN.

---

## Step 3 — Put the heading path into the embedded text

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

---

## Step 4 — Cross-encoder reranking

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

### Verification

Benchmark with and without. The success criterion is **r@1 rising toward the
existing r@5** (currently 78% → 97%): that gap is precisely what reranking is
supposed to close. Also confirm the five known defects individually.

**Cost:** no resync. One extra model download.

---

## Step 5 — Re-run the tuning sweep

Steps 2–4 change what the retriever sees, so the current optimum almost
certainly moves — notably, the argument for `vector 0.7` was made against
truncated embeddings. Also sweep the rerank candidate count.

Update `src/search/tuning.ts` and the README design note only with sweep
evidence, in keeping with how that note is currently written.

---

## Step 6 — CI, and optionally the embedding model

**CI.** There is no `.github/` in the repo. Add `typecheck` + `test` on push and
PR. Exclude the benchmark: it needs the indexes, which are gitignored and total
hundreds of MB. This matters more now — chunker changes alter corpus semantics
silently, and three tests broke in the previous session only because they
happened to assert on chunk ordering.

**Model swap (optional, evaluate last).** `bge-small-en-v1.5` and `gte-small`
are the same size class as MiniLM-L6 and materially stronger on retrieval
benchmarks; `bge-small` is also 384-dim, so `EMBEDDING_DIM` may be unchanged.
Do this only after the above, because it invalidates every index, requires
re-running step 5 (`similarity` is model-specific), and nothing measured so far
points at the model as the bottleneck. Check the new model's window — if it is
512 too, step 2's budget holds.

---

## Ordering

1. **Step 1** — trustworthy benchmark, or everything after is unmeasurable
2. **Steps 2 + 3** — one shared resync; the substantive fix
3. **Step 4** — reranking, no resync
4. **Step 5** — re-sweep
5. **Step 6** — CI, then optionally the model

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

- Does step 2 actually move natural-language recall? The causal story is strong
  and the mechanism is proven, but the effect size is unmeasured.
- Is per-query adaptive weighting still worth anything after steps 2–4? It was
  proposed to fix the `mask` case, which step 2 may fix outright — and a query
  with no distinctive keyword has nothing to boost, which is most of the weak
  group.
- How should an oversized single code fence be handled — split with reopened
  fences, or kept whole and over budget?

## Repository state at time of writing

Five commits sit local and **unpushed** on `main` above `dba9f54`:
`cd2f344`, `30982fe`, `1f1e967`, `dd5cc1d`, `048cc44`. Push before starting, so
this work does not stack on an unreviewed diff.

Indexes on disk reflect: Playwright 6,119 chunks, TypeScript 1,396, JavaScript
9,939, Node 4,940. The MCP server is registered at user scope and caches its
index for the process lifetime — **restart the client after any resync.**
