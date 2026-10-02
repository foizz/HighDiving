# High Dive List

A mobile-first web app for high divers: build a four-dive competition list, see each
dive's degree of difficulty, browse the full DD table, and simulate what a given set of
judges' awards would score — under either the **Red Bull Cliff Diving** rules or the
**World Aquatics (FINA)** rules, with the interface re-skinning to match.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine + rule tests
npm run build
```

Accounts are optional. With no Supabase keys the app runs guest-only and keeps lists on
the device; see [Accounts](#accounts).

## Where the numbers come from

Everything the app asserts about difficulty and legality is taken from the two published
rule books in this repository, not from memory or from a third-party table.

| | Red Bull Cliff Diving | World Aquatics |
|---|---|---|
| DD table | `RED BULL … 2026 RULE BOOK_final.pdf`, Appendix 3 ("2025 DD TABLE") | `2017-2021_high_diving_13082019_0.pdf`, Appendix 2 |
| Competition format | same rule book, §3 | [High Diving Competition Regulations](https://www.swiss-aquatics.ch/wp-content/uploads/2024/02/7.4.6-HDI-AQUA-Regeln_EN.pdf), in force 9 Nov 2024 |
| Dives tabled | 154 | 149 |

**The two tables are genuinely different.** Red Bull's 2025 table is not a copy of FINA's:
at 27 m, dive `202` is A 2.8 for Red Bull and A 2.9 for World Aquatics, and `106` is B 3.9
against B 3.8. Treating one as a stand-in for the other would produce wrong DDs, so each
rule set carries its own table.

The World Aquatics PDF does **not** contain the senior competition format — it defers to
By-Law BL 15 — so that came from the current World Aquatics regulations linked above.

### Rebuilding the data

```bash
npm run data:fina        # FINA PDF  -> src/data/dd-table.json
npm run data:rb-images   # Red Bull appendix pages -> tmp/rb-pages/*.png
npm run data:rb          # scripts/rb-dd-source.txt -> src/data/dd-table.redbull.json
```

The FINA appendix has a real text layer, so `scripts/extract-fina.mjs` reads it directly
with `pdftotext -table` (Xpdf; ships with Git for Windows). It locates the A/B/C/D/E
header row, snaps the observed value columns onto it, and **refuses to emit anything if
that mapping is ambiguous** rather than filing a DD under the wrong position.

The Red Bull appendix is scanned images with no text layer. `scripts/extract-rb-images.mjs`
pulls the bitmaps out of the PDF (dependency-free — Node's `zlib` plus a hand-rolled PNG
writer) so they can be read by eye, and the readings live in `scripts/rb-dd-source.txt`,
one dive per line, for checking against the images. `npm run data:rb` validates that file
and fails on a malformed row, an implausible DD or a duplicate dive.

### How the data is checked

`npm test` is not only unit tests of the helpers — it validates the extracted data:

- Spot DDs are asserted against values quoted from the PDFs.
- The books' own worked example is reproduced: `8.0, 7.5, 7.5, 7.5, 7.0 = 22.5 × 3.8 = 85.5`.
- Every one of the 303 tabled dive numbers across both books must parse, and the parser's
  derived group must equal the group the book tables it under. The two tables were produced
  by completely different routes — one automated, one transcribed by hand — so agreeing on
  all 303 cross-validates both.

## What the rules actually say

Both books score identically: cancel the highest and lowest awards, add the remaining
three, multiply by the DD. Five judges drop one from each end; seven drop two.

| | Red Bull | World Aquatics |
|---|---|---|
| Required / intermediate max DD | 2.8 / 3.6 men, 2.6 / 3.4 women | same |
| Optionals | 2, no DD limit | same |
| Take-offs | all four dives from different take-offs (3.5.1) | required ≠ intermediate, optional ≠ optional (3.4.1/3.4.2) |
| Dive over its DD limit | failed dive, scores **0** (3.5.3) | DD **capped** at the limit |
| Repeated dive | 0 points | not allowed |
| Height | 26.5–28 m / 20–22 m | 27 m / 20 m |
| Judges | 5 | 7 preferred, 5 permitted |

The over-limit behaviour is the one place the books genuinely disagree, and it is modelled
per rule set rather than shared.

## Layout

```
scripts/            PDF extraction and the Red Bull transcription source
src/data/           generated DD tables + the storage layer
src/lib/            dive-number parser, DD lookup, scoring
src/rules/          the two rule sets and list validation
src/screens/        entry, lists, editor, dive table, simulator, settings
supabase/migrations
```

`src/rules/index.ts` holds both rule sets as data against one `RuleSet` interface, so
adding a third set of rules is one file rather than conditionals spread through the UI.
Likewise the theme: every colour is a CSS variable keyed off `data-ruleset` on `<html>`,
so the toggle re-skins the whole app without a single per-component branch.

## Accounts

Copy `.env.example` to `.env` and fill in a Supabase project's URL and anon key, then apply
`supabase/migrations/0001_init.sql`. Row-level security scopes every row to `auth.uid()`,
so the anon key in the browser only ever reaches the signed-in user's own lists. Guest and
signed-in modes run the same screens through one `DataSource` interface, which is what lets
a guest's lists be moved into an account after signing up (Settings → Account).

## Season rankings

The rule book defines **two** season tables. They count different events on different
scales, and the app never merges them:

| | World Series ranking (3.3.1) | World Ranking (6.2) |
|---|---|---|
| Counts | Red Bull tour stops only | Red Bull stops **+ World Aquatics High Diving World Cups** |
| Points | 20, 16, 13, 10, 8, 7, 6, 5, 4, 3, 2, 1 | 45, 38, 32, 27, 23, 20, 18, 16, 14, 12, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1 |
| Aggregation | sum | average, divisor never below 4 |
| Best-dive bonus | +1 (3.4.1) | not applied |

A World Aquatics result moves the World Ranking and leaves the Series table untouched —
`src/lib/ranking.test.ts` asserts exactly that, because it is the easy thing to break.

Each competition row carries `counts_for_series` and `counts_for_world_ranking`, so the
separation is enforced by data rather than by remembering a convention.

### Seeding 2022–2026

`npm run data:results-seed` reads both spreadsheets and writes two SQL files, to run in
the SQL editor after the migrations:

| Seed | Source | Content | Counts for |
|---|---|---|---|
| `supabase/seed/redbull_results.sql` | Red Bull workbook | 62 tables, 741 results | both tables |
| `supabase/seed/worldaquatics_results.sql` | World Aquatics workbook | 16 tables, 314 results | World Ranking only |

Both are idempotent — competitions and divers are keyed on ids derived from the event and
the name, and each seeded competition's results are deleted before insert.

**Divers are matched across the two files by name**, which is what lets one diver hold a
single World Ranking built from both series. That makes a spelling difference an expensive
and silent fault: the diver splits into two records with half a ranking each, and nothing
errors. Three such pairs exist (`Jucelino Lima Junior` / `Jucelino Junior`,
`Maike Elena Halbisch` / `Maike Halbisch`, `Isabel Cristina Perez` / `Isabel Perez`) and
are mapped in `ALIASES` in the generator. The script reports any new near-duplicate it
finds, so an updated spreadsheet cannot introduce one unnoticed.

What the sources cannot tell us:

- **No best-dive bonuses.** Neither records which dive won the +1 (3.4.1), so `best_dive`
  is false throughout and World Series totals can be up to one point per stop below the
  official figure. Tick them on the Admin screen where you know them.
- **One missing total.** Andrea Barnaba, 2025 El Nido, is a DNF with no numeric total; the
  placing is kept and the score stored as null.
- **Eight withdrawals** (DNS/WD/DSQ) in the World Aquatics file have no finishing position
  and are not imported. They score nothing, so no ranking is affected.

Rule 6.2 names only World Cups, but the World Championships are counted here too, as a
deliberate choice — the rule book says the 2026 procedure was still to be finalised. Any
event's two flags can be changed per competition on the Admin screen.

### Uploading results

Apply `supabase/migrations/0002_results.sql` and `0003_allow_tied_placings.sql`, then
make yourself an admin with the commented `insert` at the bottom of 0002. The Admin screen appears under **More**
once you are in the `admins` table; writes are rejected by row level security for anyone
who is not, so hiding the screen is a convenience rather than the control.

Results go in by pasting a table (`position, name, score`, with `*` marking the best dive)
or row by row. The parser takes tabs, commas or runs of spaces, reports problems per row,
and asks before turning an unrecognised name into a new diver.

## The assistant

`supabase/functions/ask` answers questions about either rule book, your own lists, and the
uploaded results.

```bash
npm i -g supabase                      # if you do not have it
supabase functions deploy ask
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

The key lives in function secrets and never reaches the browser. The function requires the
caller's Supabase JWT and reuses it for every query, so the assistant can only read what
that user could read themselves.

Two choices worth knowing about:

- **Both rule books go into the prompt whole** (~32k tokens), behind a cache breakpoint
  with a one-hour TTL. They fit, caching makes repeat questions cheap, and unlike a
  retrieval index nothing can silently drop the clause that decides an answer.
- **Figures come from tools, not from the model.** DD lookups, list validation, scoring
  and standings call the same functions the app uses, bundled for Deno from
  `src/engine-entry.ts` by `npm run build:engine` rather than copied. The assistant cannot
  disagree with the dive picker, and those answers stay covered by the app's tests.

Regenerate both inputs after changing the engine or the rule books:

```bash
npm run build:engine       # src/engine-entry.ts -> supabase/functions/_shared/engine.js
npm run data:rules-text    # the PDFs -> supabase/functions/_shared/rules-text.js
```

`ai_usage` caps requests per user per day (`ASK_DAILY_LIMIT`, default 50), checked before
any model call — without it one looping client could spend the whole API budget.

## Known gaps

- **A tied placing is allowed.** Divers do tie and rule 3.3.2 says both take the full
  points, so there is no unique index on (competition, position). 0003 drops the one 0002
  originally created.
- **The 2026 season is partial.** The data has five Red Bull stops and two World Aquatics
  events for 2026, while rule 6.2 counts eight, so World Ranking averages will move as the
  rest are added.
- **The assistant has not been run against a live key.** The function is written and the
  engine bundle is verified standalone, but it has not been deployed or exercised
  end to end.
- **DD comes from the tables only.** Both books also publish a formula for computing the DD
  of a dive that is not tabled (FINA Appendix 1, Red Bull Appendix 2). That is not
  implemented — an untabled dive/position is reported as unavailable rather than given a
  computed number that was never published.
- The Red Bull DD values were transcribed by eye. They are worth spot-checking against
  `tmp/rb-pages/*.png` before being relied on for anything that matters.
