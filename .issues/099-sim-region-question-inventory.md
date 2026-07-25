---
type: wayfinder-ticket
wayfinder: grilling
map: 097
status: done
blocked-by: —
---

# 099 — What the analyst reads the screen for, region by region

## Question

Before anything is rearranged: **what question does each region of today's screen answer, and who
asks it?** The rework's whole justification is that space is being spent on things nobody reads;
that claim needs an inventory before it can be acted on.

Walk the eleven regions — `SimHeaderForm`, `SimItemsEntry`, `SimManualConditions`, the Net-Total
tile, the actions card, the error banner, the E/W count banner, `SimResultsGrid`, `SimPromoBlocks`,
`SimItemDetail` (+ `ConditionCard`), `SimBonusBuyPanel` — and for each record:

- **The question it answers**, in the analyst's words, not the component's.
- **When it is read** — every run, on a surprise, or once a month during an investigation.
- **What it costs today** — the vertical space, and specifically the *chrome* cost: every region is
  a `rounded-lg border bg-card p-3` with its own heading, so eleven regions buy eleven frames.
- **Whether it is a glance or a study.** This is the axis the rework turns on: a glance value can
  become a chip; a study surface needs room and probably needs to move behind a disclosure.

Then the rulings this ticket owes the map:

1. **Which regions are permanent, which are conditional, and which are one disclosure away.**
2. **Which regions can lose their frame entirely** — the card border/heading is the unit of chrome,
   and collapsing two regions into one frame is free space before a single value moves.
3. **Is the screen one workflow or two?** Today it is input-above / results-below, both always
   present. If the analyst's real loop is *set up once, run many*, the input side is a header and
   not a half of the page — which is the premise under the map's chip-bar ruling and should be
   confirmed or contradicted here.
4. **What is on screen that nobody reads.** Name it, so the prototype does not politely rearrange it.

Read the components and `src/locales/en/simulation.json`; grill the owner on the loop. Where a
region's cost depends on real row counts, defer that number to
[098](098-simulate-payload-capture.md) rather than estimating it.

## Answer

**Inventoried and ruled.** Owner grilling session, 2026-07-25. The arrangement was settled by eye
rather than by questionnaire — [`assets/099-stack-order.PROTOTYPE.html`](assets/099-stack-order.PROTOTYPE.html)
draws four candidate arrangements plus today's screen on the real
[098](098-simulate-payload-capture.md) `03-applied-and-potential` capture, in the shipped POS
palette. **Arrangement D is approved.**

### The loop — ruling 3, confirmed and extended

**It is one workflow: set up once, run many.** The determination fields are typed once at open and
never touched again; the **basket changes on every run** (swap a material, bump a quantity to cross a
threshold, toggle promo off). So the map's chip-bar premise **holds for the header and fails for the
items** — those are two different regions with opposite lifetimes, and [102](102-sim-input-chip-bar.md)'s
scope narrows to the determination fields alone.

**A second loop the map did not know about, owner-supplied:** a bonus buy is edited in SAP,
re-downloaded, and *will not fire with its latest version until the pricing cache is wiped*. So the
real iteration is **fix → re-download → wipe cache → Process**. `Clear cache` is not an
administrative curio to be tucked away behind its grant — it is a **run control** and it belongs
beside Process. Spec 022 gated it correctly; this map places it correctly.

**First read after a run: "did the promotion fire?"** The screen exists to answer a promo question —
the ×1 → ×2 loop *is* a promo experiment. **Net Total is the confirming number, not the headline**,
which inverts today's layout (a 3xl figure top-right, the promo answer buried in the right column).

### The eleven regions

| # | Region | The question it answers | Read | Glance/study | Verdict |
|---|---|---|---|---|---|
| 1 | `SimHeaderForm` | "What am I pricing *as*?" | once per session | glance after run 1 | → **chip rail**, expandable |
| 2 | `SimItemsEntry` | "What's in the basket?" | **every run** | instrument | **permanent, live** |
| 3 | `SimManualConditions` | "What if I force a condition?" | investigation only | study | → **disclosure** in the items frame |
| 4 | Net-Total tile | "What did it come to?" | every run, confirming | glance | → **readout in the run strip**, frame dissolved |
| 5 | Actions card | — (a control cluster, not a region) | every run | n/a | → **run strip**, frame + heading dissolved |
| 6 | Error banner | "Why did the whole run fail?" | on a 400 | glance | **kept** — the only evidenced failure path |
| 7 | E/W count banner | "Which lines are unhealthy?" | rare | glance | **RETIRED** |
| 8 | `SimResultsGrid` | "What did each line price at?" | every run | glance + drill | **permanent**, lines expand |
| 9 | `SimPromoBlocks` | **"Did the promotion fire?"** | **every run — primary** | glance | **promoted to the rail** |
| 10 | `SimItemDetail` + `ConditionCard` | "Which rules built this price?" | on a surprise | study | → **opens on the line**; panel gone |
| 11 | `SimBonusBuyPanel` | "What did the procedure actually do?" | forensic | study | → **disclosure** inside the open line |

Plus `SimMissedPromotions`, disabled at `SimulationPage.tsx:357` — **reinstated**, see below.

### Ruling 1 — permanent / conditional / one disclosure away

- **Permanent:** the run strip (chips · money readout · Process · Clear · Wipe cache), items entry,
  results.
- **Conditional:** the promotions rail (after a run only), the whole-run 400 `ErrorBanner`.
- **One disclosure away:** manual conditions · a line's conditions · that line's pricing elements ·
  a promotion's bonus-buy details.

### Ruling 2 — the frames

**Nine frames and seven headings become three and three.** `Summary` and `Actions` dissolve into an
unframed run strip — one is a readout, the other a control cluster, and neither is a region. Net
Total keeps its emphasis **by weight, not by border**. `Manual Conditions` folds into the items
frame; `Pricing Elements` and the whole detail panel fold into the open result line. That is the
reclaim, and **it happens before a single value moves**.

### Ruling 4 — what nobody reads

1. **The E/W count banner.** It points at information already on screen (the line's own dot, its
   `pricingStatusMessages` in the detail) and, on 098's evidence, only ever counts warnings — a
   per-line `E` is never produced. Deleted; at most a warning count on the results heading. Retires
   `banner.counts`.
2. **`SimItemDetail`'s four money tiles.** Base price / discounts / tax / net total are *already
   columns on the line the analyst just clicked*. Pure duplication. Retires `detail.tiles.*`.
3. **The statistical-conditions toggle.** Zero statistical rows on all eleven captures — the control
   has never rendered. Retires `detail.showStatistical` / `detail.hideStatistical`.
4. **The Pricing Elements panel** as a *permanent* surface — an `h-72` AG Grid for 7 rows, 3 of them
   subtotals. The trace itself survives as a forensic disclosure; the panel does not.

**Two candidates the owner rescued from this list** — recorded because a research pass would have
cut them:

- **Procedure key and loyalty group/tier are deliberate test levers**, not vestigial WPF fields:
  the procedure key selects another pricing procedure to test (or verify a newly set-up one), and
  the loyalty fields exercise promotions restricted to a tier. Blank on every capture because
  captures were ordinary runs. They live **inside the expanded rail**, never deleted.
- **`itemConditionControl` is the coupon lever.** Setting it to **`M`** is how a coupon — which
  carries no base price — is priced without failing. This *explains a finding 098 filed without
  understanding*: `COUP01` returning `W` with `[070] Mandatory condition 'VKP0' (Basic Price) not
  found at step 5` is precisely the symptom of an unset `M`. The column is **load-bearing and
  permanent**.

### The arrangement — D

One column, then a **66/34 split**: results left, promotions rail right.

```
run strip   chips · [edit] · NET 172.38 · disc · tax · ms · [Process] [Clear] [Wipe cache]
items       material · qty · uom · CONTROL ▾ · ✕        › Manual conditions
─────────────────────────────────┬──────────────────────
RESULTS (66%)                    │ PROMOTIONS (34%)
 ● #10 …  2 EA  ✓70% 2nd PCS     │  ✓ 70% 2nd PCS   % off
   └ 1. VKP0 — Basic Price       │    000100000131 · ZB03
     2. ZB03 — 70% 2nd PCS ×2    │    Saved  −63.88 SAR
     3. MWST — Vat %             │    [ Bonus buy details ▸ ]
     ‹ Pricing elements          │
 ● #20 …  1 EA  —                │  ○ 2 PC for 29.95 SR  didn't fire
                                 │    Would save 26.04 SAR
```

Why the rail rather than a full-width band: the results **never shift position** when the promo
region grows or shrinks between runs, and 0–2 fired + 0–1 near-miss cannot overflow 34% of the
width. Verdict and the lines it explains sit on one horizontal band — the eye moves sideways
instead of scrolling.

**Near-misses return** (`SimMissedPromotions` re-enabled), in the same rail as the fires: on this
loop, "×1 didn't fire and ×2 does" is one question, not two. Each card carries **only what live
data has** — description, kind, `wouldSave`, validity, `isStackable`. **No prerequisite line ever**
(098: `prerequisites` `[]`, `skipReason` `null` on every capture).

### Two changes to inputs (in scope — presentation, not request shape)

- **Control becomes a dropdown**, not free text. `M` is a value you either already know or never
  discover, and 098's unexplained `W` is what a text box costs. The request field is unchanged.
- **Wipe cache moves into the run strip.** Gating, confirm dialog and semantics are untouched
  (spec 022); only its placement changes.

### The bonus-buy details boundary

**In scope: the affordance. Out of scope: the surface.** A promo card carries a
**Bonus buy details ▸** button — but the modal it opens is
[060](060-bby-detail-modal-prototype.md), already an approved prototype mirroring SAP "Display
Bonus Buy", over the contract designed in [058](058-bby-detail-endpoint-contract.md)
(`Bby/Detail` by number + a lazy paged members endpoint, members reaching ~1000 SKUs). **Neither
endpoint is built on SIS.Api.** So the rail must read correctly with the button absent, and this
map must not redesign a surface another map has already approved.

**Gating (owner ruling):** the button is **hidden behind a `BbyInquiry` access probe** — a
*different* grant from `PosSimulation` (`PROMO_ADMIN` bundles both, but either can be held alone).
Same show/hide hygiene as the cache button; the server still enforces on the call. Consequence to
record: this puts **three** access probes on mount — `Pricing/Access`, the cache grant, and now
`BbyInquiry`.

### What this ticket hands on

- [101](101-sim-screen-device-prototype.md) — builds D properly; the arrangement is settled, the
  device vocabulary is not.
- [102](102-sim-input-chip-bar.md) — **determination fields only**. Items never collapse.
- [103](103-sim-deep-layers-placement.md) — four disclosures to design, all small: manual
  conditions, line conditions (≤3 cards), pricing elements (7 rows), bonus-buy details.
- [104](104-sim-results-line-anatomy.md) — the line and its expansion; the promo rail is no longer
  its problem.
- [105](105-sim-responsive-arrangement.md) — inherits **one** breakpoint decision: when the 66/34
  split stacks.

### Open, not blocking

- **The Control dropdown's value set is unknown.** `M` is the one evidenced value. The full domain
  needs a backend/SAP answer before the dropdown can be more than `(none)` + `M`; until then
  `(none)` + `M` is correct and complete for every case this screen has been shown to handle.
- The `M`-fixes-`COUP01` relationship should be **verified against a live run** when SIS.Api is next
  reachable — it is the owner's domain knowledge, consistent with 098's evidence, but not yet
  captured as a payload pair.
