---
type: wayfinder-ticket
wayfinder: research
map: 097
status: done
blocked-by: 108
---

# 109 — The i18n churn and the testing seams

## Question

**Which translation keys does the rework retire, rename and add — and which of its rules are pure
enough to test?**

Graduated from the map's **Not yet specified** patch once [105](105-sim-responsive-arrangement.md) and
[106](106-sim-rtl-mirroring.md) landed and the arrangement locked. 083 could name its retired keys and
its pure seams because its rules were settled; ours now are. This is the **inventory** 083's spec
carried, not new design — the resolved tickets already name most of it, and this ticket's job is to make
it complete and checkable rather than scattered across nine answers.

Blocked on [108](108-sim-bby-details-affordance.md) only because it is the last arrangement decision
open; a key it renames would otherwise be missed.

**Already banked, to be collected not re-derived:**

- **Retired by [104](104-sim-results-line-anatomy.md):** `results.status`, `results.promoNone.*` (the
  status column is gone), plus a **rename** — not a reorder — of `results.subtotal` / `results.gross` /
  `results.net`, which no longer describe what they label.
- **Retired by [103](103-sim-deep-layers-placement.md):** `detail.tiles.*`, `detail.showStatistical`,
  `detail.hideStatistical`, `detail.records`, `detail.subRate`, `detail.title`, `bonus.tabs.elements`,
  `bonus.elements.empty`.
- **Added by [105](105-sim-responsive-arrangement.md):** `promotions.lines` (interpolated — the promo
  card's printed line list). 105 retires nothing.
- **Seam 1, from [102](102-sim-input-chip-bar.md):** the staleness predicate — a pure comparison of the
  current `SimulateRequest` against the request that produced the on-screen result. The screen's one
  clearly-pure new rule.
- **Seam 2, from [103](103-sim-deep-layers-placement.md):** `aggregateConditions` becomes the sole
  producer of the expansion's rule list, with `isStatistics` load-bearing for the `STAT` key.

Against that, answer:

1. **The complete key ledger** — retired, renamed, added — for `src/locales/en/simulation.json`, checked
   against the actual file rather than against the tickets' memory of it. A rename must state both names,
   since [i18n-zero-literal](../.claude/rules/i18n-zero-literal.md) makes a stale key render raw to users.
   Note which retirements are *only* reachable from components 103 dissolves (`SimBonusBuyPanel`,
   `SimItemDetail`), because those retire with their file rather than needing a sweep.
2. **The chip and strip vocabulary's keys** — [100](100-sim-chip-vocabulary.md) fixed a chip's content to
   a bounded domain (code, date, enum label) and [102](102-sim-input-chip-bar.md) added the status slot's
   three states. Name the keys that carries, including the uppercase chip keys 106 flagged as an Arabic
   pressure point.
3. **The seam inventory** — every rule the rework makes that is testable in `vitest` **without** React
   Testing Library, which [083](083-document-details-rework-spec.md)'s ruling still leaves uninstalled.
   The two seams above are named; find the rest (candidates: 104's blank-on-undiscounted and
   `not priced` suppression, 105's shed order, 100's blank ⇒ no chip).
4. **What is provably NOT a pure seam**, and what proves it instead. [106](106-sim-rtl-mirroring.md) is
   the worked example: its 13 bidi call sites and two flipped icons have no pure surface at all, and its
   proof is a **drive** (`tools/sim-rtl-drive.mjs`, already written and green). Say which of the
   rework's rules are in that class, so the spec asks for a drive rather than an impossible unit test.

## Answer

**The ledger is complete and mechanically checked** (2026-07-25). Method, because the ticket asked for
it: the live `src/locales/en/simulation.json` was flattened to its **157 leaf keys** and diffed by
script against every `t()` call site in the seventeen files of `src/features/pricing/simulation/`,
dynamic key families (`` t(`detail.badge.${…}`) `` and six siblings) excluded by prefix and resolved by
hand. So the ledger below is checked against the *file*, not against the tickets' memory of it — which
is what turned up the retirements no ticket had banked, and one key that is already dead today.

**Headline: the churn is smaller than nine answers implied, and it is lopsided.** 9 keys retire by
*deleting two files*; **13 more retire by sweep** through files that survive — and the sweep half is
where a stale `t()` renders raw to users. Of the 22 retirements, **9 were never banked by any ticket**.

### 1 — The complete key ledger

#### A. Retired with a dissolving file — no sweep, delete the file (9)

[103](103-sim-deep-layers-placement.md) dissolves `SimItemDetail.tsx` and `SimBonusBuyPanel.tsx`. Every
one of these keys is referenced from **exactly one** of those two files and nowhere else — verified, not
assumed — so they leave with their component and no call site is orphaned.

| Key | Only call site |
|---|---|
| `detail.title` | `SimItemDetail.tsx` |
| `detail.tiles.base` · `.discounts` · `.net` · `.tax` | `SimItemDetail.tsx` |
| `detail.showStatistical` · `detail.hideStatistical` | `SimItemDetail.tsx` |
| `bonus.tabs.elements` | `SimBonusBuyPanel.tsx` |
| `bonus.elements.empty` | `SimBonusBuyPanel.tsx` |

#### B. Retired by sweep — the call site lives in a file that survives (13)

This is the half that needs care. **Nine of the thirteen were not banked by any ticket** (marked ▲).

| Key | Surviving call site | Why it goes |
|---|---|---|
| `results.status` | `SimResultsGrid.tsx` | 104 §2 — no status column |
| `results.promoNone.mark` | `SimResultsGrid.tsx` | duplicate of `summary.placeholder` (both `—`); one placeholder, not two |
| `results.promoNone.label` | `SimResultsGrid.tsx` | was the cell's `title`; the promotion slot's empty state is an em-dash with nothing to announce |
| ▲ `results.material` | `SimResultsGrid.tsx` | 104 §8 — description **over** material in one `Item` column, one header for two values |
| ▲ `results.description` | `SimResultsGrid.tsx` | same column merge |
| ▲ `banner.counts` | `SimulationPage.tsx` | the E/W count banner, retired by 099 and hardened by 104 §2 |
| ▲ `summary.title` | `SimulationPage.tsx` | frame heading; nine frames become three (101) |
| ▲ `actions.title` | `SimulationPage.tsx` | frame heading; the actions live in the strip (101/102) |
| ▲ `header.title` | `SimHeaderForm.tsx` | frame heading; the form is the strip's expansion, not a titled frame |
| ▲ `status.ok` | `SimResultsGrid.tsx` | 100 — an `ok` line carries **no mark at all**, so nothing renders the label |
| `detail.records` | `ConditionCard.tsx` | 103 — sub-records gone; **the card survives**, so this is a sweep |
| `detail.subRate` | `ConditionCard.tsx` | same |
| ▲ `summary.elapsed` | **none** | **already dead today** — the page calls `summary.calc`; `elapsed` has had no call site since before this map opened |

`summary.elapsed` is the mechanical check's payoff and the argument for running it again at build time:
one orphan was sitting in the file that no reading of the tickets could have found.

#### C. Renamed — both names stated, and one collision to refuse (6)

104 §1 fixed the money order before the grid was redrawn, which makes three of today's five money keys
**wrong about their own field**, not merely mis-ordered. Set B's approved headers, read off the ruling
prototype's `colHead()`, are `# · Item · Qty · Promotion · Was · Saved · Net total`.

| Today | Field it labels | Becomes | Where |
|---|---|---|---|
| `results.gross` "Gross" | `grossValue` | **`results.was`** "Was" | the line |
| `results.promo` "Promo" | `promotionDiscount` | **`results.saved`** "Saved" | the line, magnitude, neutral (104 §4) |
| `results.net` "Net" | `netTotal` | **`results.netTotal`** "Net total" | the line, the only bold figure |
| `results.subtotal` "Subtotal" | `netValue` | **`results.expandNet`** "Net" | the expansion's money foot |
| `results.tax` "Tax" | `taxValue` | **`results.expandTax`** "Tax" | the expansion's money foot |
| `summary.netTotal` "Total Net Total" | header `netTotal` | **`strip.netTotal`** "Net total" | the run strip (101) |

**The collision, and the ruling that avoids it.** The natural rename of `results.subtotal` is
`results.net` — because `netValue` *is* "Net". But `results.net` is **occupied today, by `netTotal`**.
A rename onto an occupied key is the one shape [i18n-zero-literal](../.claude/rules/i18n-zero-literal.md)
cannot protect: a half-finished sweep leaves a key that resolves, renders plausible English, and is
about the wrong number — strictly worse than a raw key, which is at least visibly broken.

**So all five `results.*` money keys are retired and minted fresh**, and the build ticket carries a
one-line assertion that is cheap and total: **the strings `results.subtotal`, `results.promo`,
`results.gross`, `results.tax`, `results.net` appear in neither the JSON nor any call site.** No
partially-swept state can satisfy that.

#### D. Survives unchanged, some relocated — the large majority

~120 leaves are untouched: `menu.*` (used from `src/layout/menu-model.ts:135,139`, outside the feature —
checked), `title`, `access.*`, every `header.*` field label, all of `items.*` (099: the items grid never
collapses), all of `manual.*` (102: manual conditions open themselves when rows exist), `clearCache.*`
(099: a run control now, same copy), `actions.process` / `.processing` / `.clear`, `banner.failed` (101:
the 400 banner replaces the work area), `summary.totalDiscount` / `.tax` / `.calc` / `.placeholder` /
`.noResult`, `results.title` / `.item` / `.qty` / `.promotion` / `.promoKind.*` / `.promoRole.*` /
`.empty`, the whole of `promo.*` and `missed.*` (101 reinstates `SimMissedPromotions`), `detail.badge.*`
/ `.category.*` / `.countPill` (the `×N` pill stays) / `.rateBase` (103: promoted, now always visible) /
`.rulesTitle` / `.noRules` / `.messagesTitle`, `status.warning`, `status.error` (100: coded, unproven —
098 never produced an `E`, and it stays coded), `bonus.yes` / `.no`, and the eleven `bonus.elements.*`
column headers.

Three notes on this list, each a place the ledger would otherwise be read wrong:

- **`results.item` survives its own meaning change.** Today "Item" heads `itemNumber`; in set B it heads
  the description-over-material column. Same key, same word, different referent — so it is *not* churn,
  but it is the one key a reviewer should expect to see move and not find in the diff.
- **`bonus.elements.*` survives the AG Grid's death.** 103 turns the `h-72` grid into a plain table and
  105 sheds `ctr` then `unit` from it; `bonus-columns.ts` (a `ColDef[]` builder) and `BoolCell.tsx`'s
  AG-Grid `ICellRendererParams` signature both go, but all eleven header labels and the two boolean
  labels are the same strings on a `<th>`. **Component churn, zero key churn.**
- **A `bonus-buy-inquiry` namespace that moves without being renamed** — 108 graduates `DetailModal` and
  seven siblings to `@/core/`, and [feature-structure](../.claude/rules/feature-structure.md) keeps i18n
  flat and feature-named regardless of folder. `core/i18n.ts`'s registration and every
  `t('bonus-buy-inquiry:…')` call site are **untouched**. Stated because it looks like churn and is not.

#### E. New keys (17)

| Key | Value | Owed to |
|---|---|---|
| `results.pos` | `#` | 104 §1 — the line-position column |
| `results.was` · `results.saved` · `results.netTotal` | Was · Saved · Net total | 104 §1 (renames, above) |
| `results.expandNet` · `results.expandTax` · `results.expandTotal` | Net · Tax · Net total | 104 §1 — the expansion's self-footing money row |
| `results.unitPrice` | `unit price {{price}}` (accessible name) | 104 §1 — `× 91.26` under the quantity is a bare glyph + number |
| `results.fired` | `fired` | 104 §3 — the promotion slot's first state (`✔` is the glyph) |
| `results.notPriced` | `not priced` | 104 §5 — the one place the screen refuses to print what the wire sent |
| `results.elementsTitle` | Pricing elements | 103 — the expansion's second sub-heading |
| `detail.stat` | `STAT` | 103 — the statistical *distinction* survives the *control*'s retirement |
| `promotions.lines` | `lines {{lines}}` | 105 §5 — the card's printed line list, interpolated |
| `promo.bbyDetails` | Bonus buy details | 108 — on the fired card **and** the near-miss |
| `promo.notMeasured` | (one sentence: promo off ⇒ nothing was measured) | 101 — a blacked-out rail must never read as "nothing fired" |
| `strip.netTotal` | Net total | 101 (rename of `summary.netTotal`, above) |
| the `strip.*` chip vocabulary | § 2 below | 100 / 102 |

**A correction to 103, in the direction of less work.** 103's hand-off says the expansion needs "the two
expansion sub-headings" as *new*. Checked against the file: `detail.rulesTitle` ("Applied pricing rules")
and `detail.messagesTitle` ("Pricing messages") already exist, are already the right words, and are
referenced only from the dissolving `SimItemDetail.tsx` — so they **move rather than retire**, and only
**one** sub-heading (`results.elementsTitle`) is genuinely new. Recorded because it changes what the
build ticket deletes: without this, a build following 103 literally would retire two live strings and
mint two identical ones.

### 2 — The chip and strip vocabulary's keys

100 fixed a chip's content to a **bounded domain** (code, date, enum label — never money, never server
free text) so truncation is impossible by construction, and 102 added the status slot's three states.
That bounded domain is exactly why the vocabulary is small and closed:

**Chip keys — the uppercase key is a separate key from its value, because only the key is translated.**
The value is a server code (`P001`) or an enum label and is passed through as data.

| Key | Value | Chip |
|---|---|---|
| `strip.key.plant` | `PLANT` | ordinary — always |
| `strip.key.org` | `ORG` | ordinary — always |
| `strip.key.chan` | `CHAN` | ordinary — always |
| `strip.key.proc` | `PROC` | lever — only when set |
| `strip.key.loy` | `LOY` | lever — only when set |
| `strip.key.tier` | `TIER` | lever — only when set |
| `strip.key.elem` | `ELEM` | lever — only when on |
| `strip.promoOn` / `strip.promoOff` | `PROMO on` / `PROMO off` | ordinary — **both states**, one whole key each (the state is not a code, so it is not a value slot) |

The **date chip carries no key at all** — a formatted date reads alone, which is 100's test passing. So
the ordinary strip is five chips of which **four** need keys, rising to eight chips / seven keys with the
levers in play.

**The strip's other three strings:** `strip.edit` (`Edit ▾` — the tail that makes the region's
interactivity discoverable, 100 §3), `strip.stale` (`Inputs changed`; `↻` is a glyph), and the in-flight
state, which **reuses `actions.processing`** — 102 puts `Processing…` in the slot *and* on the disabled
Process button, the same string in two places, one key.

**The uppercase inventory 106 flagged as an Arabic pressure point — twelve keys, now named:** the seven
`strip.key.*`, `detail.badge.promotion` / `.manual` / `.header`, `detail.stat`, and `promo.free`
(`FREE`). The pressure is real but it is **not a churn item for this map**: Arabic copy stays ruled out
(083, restated by 097). What this map owes the later effort is the *list*, plus one constraint that is
cheap to honour now — **the uppercase must be authored in the JSON value, never applied by a CSS
`uppercase` transform**, because a transform is a no-op on Arabic script and would silently leave the
key looking un-keyed rather than visibly needing a translator's decision.

**One key does double duty and should not be duplicated:** the promotion slot's neutral `MANUAL` chip
(104 §3) is the same word as the condition card's `detail.badge.manual`. One key, two call sites.

### 3 — The seam inventory: what is testable in `vitest` with no RTL

083's ruling still stands and React Testing Library is still not installed — `vitest.config.ts` is
`environment: 'node'`, `include: ['src/**/*.test.ts']`, `.tsx` deliberately unreachable. The precedent is
the document feature's five test files (772 lines) beside its drives. **A rule is a seam here only if it
can be stated as a function from data to data with no DOM.** Six qualify — four more than were banked.

**Seam 1 — the staleness predicate** (102, banked). New module. `isStale(current: SimulateRequest, ran:
SimulateRequest | null): boolean` — a pure comparison of the current request against the request that
produced the on-screen result. Untestable-by-eye cases that are one line each in `vitest`: no prior run
⇒ not stale; a changed *lever* is as stale as a changed determination field; **item and manual-condition
row edits count** (102 puts no counts on the strip, but they are inputs); reordering rows that are
otherwise equal; `''` vs `null` vs `undefined` on an optional field must **not** read as a change, which
is the false-positive that would leave `↻ Inputs changed` stuck on permanently.

**Seam 2 — `aggregateConditions`** (103, banked). Already pure, already in `aggregate.ts`, and **already
untested** — 103 makes it the *sole* producer of the expansion's rule list, so its blast radius grows
while its coverage stays zero. Worth asserting: the composite `` grouping key; the two-pass index
(non-statistical numbered first, statistical after); `count > 1` folding with `conditionBaseValue` and
`conditionValue` summed; `bbyNumbers` distinct and non-empty; `isStatistics` surviving the fold, because
it is now load-bearing for the `STAT` key. **And one retirement it hands over:** `countStatistical()` was
built for the "(N hidden)" toggle report, its only call site is the dissolving `SimItemDetail.tsx`, and
103 retires the control — so it is **dead code that leaves with the file**, not a seam.

**Seam 3 — the result line's money projection** (104, ▲ new). The strongest seam on the screen and the
one most likely to regress silently, because every failure mode is a *plausible-looking number*.
`resultLineView(line)` → `{ was, saved, netTotal, notPriced, promoSlot }`. It carries three of 104's
rulings at once: `was`/`saved` **blank — not `0.00`** — on an undiscounted line (§1); a `W` line
**suppresses all five zeros the wire sent** and reads `not priced` (§5); the promotion slot resolves to
exactly one of four states with `fired` + `MANUAL` able to stack (§3). Capture `04b` #10 (`COUP01`,
zeros across `netPrice`/`grossValue`/`netValue`/`taxValue`/`netTotal`) is a ready-made fixture.

**Seam 4 — the run strip's chip set** (100/102, ▲ new). `runChips(request)` → an array of
`{ key, value }` **tokens, not translated strings** — which is what keeps it node-testable and keeps the
i18n rule intact. It makes 100's headline claim assertable instead of eyeballed: **five chips
ordinarily, eight with the levers**; blank ⇒ **no chip** (not a muted one); determination fields chip
**even at their defaults** (098 finding 8 — an invalid plant prices silently); promo chips in **both**
states; and nothing outside the bounded domain ever reaches a chip.

**Seam 5 — the elements trace's shed order** (105, ▲ new, *conditional*). 105 §6 rules the trace sheds
`ctr` first, then `unit`, and **never a number**. This is a seam **only if the build expresses it as a
column list** — `elementColumns(level: 0 | 1 | 2)` → `ColumnId[]` — and it is **not** a seam if the
columns are hidden by `@container` CSS. **Recommend the list form**: the assertion "no numeric column is
ever shed" is one line over three levels, and it is the rule most likely to be violated by someone later
adding a column and dropping it into the shed order without thinking. The choice belongs to the build;
the spec should name the consequence so it is made deliberately.

**Seam 6 — the promotion card's printed line list** (105, ▲ new). `promotions.lines` renders from
`promoView`'s `affectedItemNumbers`. `promoView` itself is **out of scope** (043's model, ruled), but the
*projection to a printed, sorted, de-duplicated list* is new here and is one small pure function. It
earns a test for a reason 104 §3 makes sharp: after 098's no-item-linkage finding, this list and the
cross-highlight are **the only things on screen that say which lines a promotion touched** — and unlike
the highlight, the list survives the card being scrolled away from its lines.

### 4 — What is provably NOT a pure seam, and what proves it instead

The test is the same one, failed: a rule whose statement needs a DOM, a computed style, a pixel or a
clock has no `vitest` surface at all, and asking for one produces a test that asserts a re-implementation
of the rule rather than the rule. **106 is the worked example the ticket names, and it is worth stating
why it is not a near-miss but a total one:** its output is 13 `core/ui/Ltr` wrappers and two flipped
lucide SVGs, and its central finding — that 28 of 36 digit+space runs reorder — is a *measurement of the
browser's bidi algorithm*. No pure function can assert what UBA does to a string. Its proof is
`tools/sim-rtl-drive.mjs`, 180 state combinations × both directions, **already written and green**.

Five classes join it, with the proof each needs:

| Rule | Why no pure surface | Proof |
|---|---|---|
| **Mirroring and bidi** (106) — 13 `Ltr` sites, `›`/`‹` self-mirroring, the SVG double-mirror trap, 080's superset predicate | the browser's bidi algorithm is the thing under test | `tools/sim-rtl-drive.mjs` — **exists, green** |
| **The strip's behaviour** (102) — collapse on every Process, auto-expand never, one tab stop for nine inputs, `Ctrl`+`Enter`, spinner after **150 ms**, `Edit ▾` **disabled not hidden** | focus order, event wiring and a timer | a new strip drive |
| **The arrangement** (105) — the 900 px `@container` breakpoint, the rail **above** when stacked, the strip never fragmenting past two rows, chips never truncating | layout is computed by the engine, and 105 measures the **work area**, not the viewport | a responsive drive at three widths |
| **Density and disclosure** (103/104) — 34 px rows, no scroll box, every captured line visible at once, nothing auto-opens, any number open at once, never wider than its frame | resting geometry, and state that only exists once mounted | a drive, on 098's captures |
| **The bonus-buy affordance** (108) — `probed && screenAllowed`, unknown ⇒ absent, ships **dark** | one boolean on a query result; the gate is trivial, the *consequence* is a mount decision | a drive with the probe stubbed across its three states |

**One addition this ticket found while checking the ledger, because it is provable and currently false.**
100 rules the screen's whole hue budget at **two** — `success` on a fired promotion, `attention` on a `W`
line. `BoolCell.tsx:23` paints its true-flag check `text-success`, and that component survives into the
elements trace (de-AG-Grid'd, but the same glyph). Left as is, the expansion spends `success` on
"this row is statistical", and the budget statement is **not true of the built screen**. It must go
neutral. Related and free: `BoolCell`'s `mode: 'met'` branch — the `text-danger` X — has **no call site
today** (`bonus-columns.ts` passes `'check'` exclusively), so the third hue leaves with dead code rather
than needing a ruling. The hue budget is partly guarded already by `npm run lint`'s colour-literal and
contrast gates, but *which token* is spent *where* is a drive assertion on computed styles, not a lint.

### What this hands on

- **To `/to-spec`, an Implementation Decisions section that is already written:** 22 retirements split
  9 file-deletions / 13 sweeps, 6 renames with both names stated, 17 new keys, and one anti-collision
  assertion (the five retired `results.*` money keys appear in neither JSON nor call sites) that no
  partial sweep can satisfy.
- **To `/to-spec`, a Testing Decisions section:** six pure seams, of which **`aggregate.ts` is testable
  today and untested** — so it is the one seam a build ticket can land red-green before any rework
  exists. The other five are new modules and should be *written as modules*, which is the only reason
  they are seams; a rule inlined into a `.tsx` is unreachable by a `node`-environment runner and stays
  unreachable until someone installs RTL.
- **Five drives to commission**, one of them (`sim-rtl-drive.mjs`) already green, and the standing note
  that RTL remains the hardening ticket's to add — this map does not install it.
- **Two structural notes that are not keys and would be lost otherwise:** 105 moves the shell from
  viewport prefixes to a **container query** (a layout mechanism change, not a class rename), and
  `bonus-columns.ts` + `BoolCell.tsx`'s AG-Grid signatures dissolve with the feature's **last** AG Grid
  — after which, as 106 found, the screen has zero grids and `enableRtl` has no call site here.

## Comments

**From [108](108-sim-bby-details-affordance.md), now done — the last blocker cleared (2026-07-25).**
Three things it banks for the ledger and the seam inventory:

- **One new key** for the promotion card's control (`Bonus buy details`), on both the fired and the
  near-miss card.
- **A namespace that moves without being renamed.** 108 graduates `DetailModal` and seven siblings to
  `@/core/`; [feature-structure](../.claude/rules/feature-structure.md) keeps i18n flat and
  feature-named regardless of folder, so `bonus-buy-inquiry`'s registration in `core/i18n.ts` and every
  `t('bonus-buy-inquiry:…')` call site are **unchanged**. Worth stating in the ledger precisely because
  it looks like churn and is not.
- **No new pure seam** — the affordance's gate is one boolean (`probed && screenAllowed`) on a query
  result, and the modal's `toDetailView` is already the inquiry screen's seam and travels with it. So
  108 belongs in sub-question 4's class: proved by a drive, not a unit test.
