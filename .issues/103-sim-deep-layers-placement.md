---
type: wayfinder-ticket
wayfinder: grilling
map: 097
status: done
blocked-by: 101
---

# 103 — Where the deep layers live: line detail, condition cards, elements trace, missed promos

## Question

Three of today's regions are **study** surfaces that each occupy a full card on every run:
`SimItemDetail` (four tiles + aggregated `ConditionCard` list + statistical toggle + message list),
`SimBonusBuyPanel` (the pricing-elements AG Grid, `h-72`), and `SimMissedPromotions` (currently
commented out). Under [101](101-sim-screen-device-prototype.md)'s device they cannot all keep a
permanent frame. **Where does each go, and what reveals it?**

This ticket **supersedes [049](049-sim-progressive-disclosure.md)** (closed `wontfix`), which asked
the narrower version of the same question — whether a promotion block reveals today's condition and
pricing detail. Answer it here, inside the new arrangement.

Settle:

1. **The disclosure grammar for the whole screen.** How many ways may a thing be revealed —
   inline expand, a tab strip, a side pane, a modal? One grammar, applied consistently; a screen with
   four disclosure idioms costs more attention than the frames it saved.
2. **`SimItemDetail`'s four tiles.** Base / discounts / tax / net for the selected line. With a
   headline band already carrying the run's totals, are the per-line tiles a duplicate at a
   different scope, or the only place per-line money is legible? If they survive, do they become
   chips ([100](100-sim-chip-vocabulary.md)) or stay tiles?
3. **The condition cards.** `aggregateConditions` + the statistical toggle is the deepest surface on
   the screen and the one an investigation actually needs. Use [098](098-simulate-payload-capture.md)'s
   real counts: how many cards on a typical line, how many statistical. That number decides between
   "always visible under the grid" and "one disclosure away".
4. **The pricing-elements trace.** It already self-hides when the run did not request it. Does it
   earn a permanent home when present, or does it belong under the same disclosure as the condition
   cards — both being the raw-trace layer?
5. **The missed promotions**, if [101](101-sim-screen-device-prototype.md) ruled them back in: are
   they a peer of the fired blocks, or the disclosed second half of one promotions region?
6. **What is lost.** Every move behind a disclosure costs a glance. Name, per layer, what the
   analyst can no longer see at rest, and confirm that is acceptable — this is the ruling the spec
   will be held to.

Arrangement only: `aggregateConditions`, `countStatistical` and `promoView` keep their rules.

## Answer

**The grammar is ruled.** Owner grilling session, 2026-07-25, against
[101](101-sim-screen-device-prototype.md)'s approved device and [098](098-simulate-payload-capture.md)'s
counts. No prototype — every question here is a placement rule, and the surfaces it places were
already drawn by 101 and [104](104-sim-results-line-anatomy.md).

Three of the ticket's six sub-questions were **already answered before this session opened**, and are
recorded as moot rather than re-decided: the four money tiles and the statistical toggle were retired
by [099](099-sim-region-question-inventory.md) (sub-question 2), and `SimMissedPromotions` was placed
by 101 as neutral `○` cards in the promotions rail — a peer of the fires, carrying no disclosure of
its own (sub-question 5).

### The grammar — sub-question 1

Four sentences, and every placement below follows from them:

1. **This run's own data expands in place. Anything fetched fresh opens a modal.**
2. **A disclosure opens inside a frame that already exists, and is never wider than it.**
3. **Nothing behind a disclosure is a diagnosis. Only trace hides.**
4. **State that changes the run reveals itself; state that explains the run does not.**

**One idiom, one exception.** The idiom is expand-in-place, **exactly one level deep**. The exception
is the bonus-buy details modal, and it earns the exception by not being this run's data at all — a
different record, from a different endpoint ([058](058-bby-detail-endpoint-contract.md), unbuilt),
under a different grant (`BbyInquiry`), whose surface a different map already approved
([060](060-bby-detail-modal-prototype.md)). Rule 1 is what makes that one exception a grammar rather
than an inconsistency. **No tab strip, no side pane, no second modal.** Rule 2 keeps 101's frame
budget at three by construction: a disclosure can never mint a frame.

### The line expansion — one surface, three parts, one level

Closed at rest. Opening a line reveals, in order:

| Part | Source | Present when |
|---|---|---|
| the money foot — `net + tax = total`, unit price | [104](104-sim-results-line-anatomy.md) §1 | always |
| **RULES APPLIED** — the aggregated condition cards | `aggregateConditions` | always (≤3 cards) |
| **PRICING ELEMENTS** — the raw procedure trace | `pricingElements` | only when the run requested it |

**Any number of lines may be open at once, independently** — the real question is often comparative
("why did #10 fire and #20 not?"), and at 098's density (1–3 lines) an accordion would forbid that to
save nothing. **Nothing ever opens by itself**, and a re-run lands with everything closed — so the
resting height of the Results frame depends only on how many lines you ran, never on what happened to
them. That is the same discipline as [102](102-sim-input-chip-bar.md)'s "collapse on every Process,
auto-expand never", and it agrees with 104 §6's "a re-run clears the selection".

**Selection and expansion are one gesture** — 104 §6 explicitly deferred this here and drew them as
one; that is confirmed. Consequence: 104's selection mark (3 px `primary` inline-start edge +
`card-2` fill) is **the open-line mark**, and several lines may carry it simultaneously. There is no
separate "current line" concept, because the panel it existed to feed is gone.

### The condition cards — sub-question 3

098's counts settle it: **1–5 raw conditions per line, aggregating to ≤3 cards, zero statistical rows
across all eleven captures.** Whole-screen worst case is ~9 cards. Small enough that "always visible"
was genuinely arguable — and rejected, because 099 classified this as **study, read on a surprise**,
and unfolding it at rest shoots the thing you always read (a scannable 3-line block) through with the
thing you rarely read.

`ConditionCard`'s **own expansion is retired** (`ConditionCard.tsx:24`, `count > 1`). It was the second
depth level, and it hit on the commonest multi-record case (`ZB03 ×2`). What it hid and what it showed
were backwards:

- **`conditionRate` and `conditionBaseValue` come out** onto the card as always-visible secondary text
  (`70.000 % on 91.25`). They are the *how* of the number and were hidden.
- **The `×N` pill stays** — the statement that the rule applied N times for the summed value.
- **The individual sub-records go.** Two applications of the same rule at the same rate, differing
  only in their values, summing to a figure the card already prints. Anyone who truly needs
  per-application rows has the elements trace, now one sibling away in the same expansion.

`aggregate.ts` is **untouched** — arrangement-only means its rules don't change. It keeps emitting
`subs`; the view stops rendering it.

**Statistical conditions: the control is retired, the distinction is not.** 099 retired the toggle on
the evidence that no statistical row has ever appeared. But `aggregateConditions` still returns them,
so on the new screen one would render as an ordinary card — **indistinguishable from a rule that moved
money**, which is the single place this rework would have been strictly worse than what it replaces.
A statistical card therefore carries a small neutral uppercase key (`STAT`). 100's vocabulary already
sanctions an uppercase key, so this costs **no new component, no new token, and none of the two-hue
budget**. It will probably never render.

### The pricing-elements trace — sub-question 4

**A sibling of the condition cards inside the same single expansion**, not a nested disclosure. The
request flag *is* the opt-in: the analyst tick `includePricingElements` before Process, so charging a
second and third click for what they explicitly asked for is a disclosure billing twice. 098 measures
it at **7 rows, 3 of them subtotals** — four real rows, which does not need a level of its own.

- **The AG Grid goes.** 099 already dissolved the `h-72` panel; an `AgGridReact` instance rendering 7
  rows inside an expanding table row is heavier than its content. It becomes a plain table sharing the
  expansion's typography, as the condition cards do. `bonus-columns.ts` keeps its column *definitions*
  as the field list and stops being a grid config; `SimBonusBuyPanel.tsx` dissolves entirely.
- **The 3 subtotal rows read as subtotals.** A running subtotal that looks like another step makes the
  trace unreadable.
- **It self-hides as it does today**, off the presence of the data — but per-opened-line, not per
  "selected line". No empty pane: `bonus.elements.empty` retires.

### What does *not* hide — the diagnosis rule

**A `W` line's `pricingStatusMessages` ride on the line, always visible, never inside the expansion.**
This **corrects 101** ("its `[070]` message sits inside its own expansion") and **corrects 104 §5**
(same). Both were written before the expansion was ruled closed at rest, which is what turns that
placement into the exact failure 099 killed the E/W count banner for — *a mark that points at
something you must go and fetch*. If the badge is all you get at rest, the badge **is** the new count
banner.

The evidence supports carrying it: 098 found **no per-line `E` anywhere** — failures arrive as
whole-run 400s — so `W` is the only per-line message that exists, and the captured one is a single
sentence on a rare line. 104's other `W` rulings stand unchanged: the badge in the promotion slot, the
suppressed money, the italic *not priced*.

The result is that the expansion contains exactly one kind of thing — **trace** — and every
*diagnosis* is at rest.

### Manual conditions — the apparent inconsistency, reconciled

102 ruled manual conditions **open themselves when rows exist**; this ticket rules lines **never** do.
Rule 4 is why that is not a contradiction. A manual condition is an **input that silently alters the
result** — 098 finding 6 makes a hidden one the difference between an explicable run and a 400, so
concealing it conceals a *cause*. A condition card is an **effect**. Same reason the `W` message sits
at rest.

Placement is unchanged from 099: the disclosure lives **inside the Items frame**, which satisfies
rule 2. It is the same idiom as the line expansion — no new form.

### What is lost — sub-question 6, the ruling the spec is held to

**Lost, and accepted:**

| Layer | What goes | Recovery |
|---|---|---|
| Line 1's rules + trace | today auto-selected and free at rest (`SimulationPage.tsx:83`) | one click — on an arbitrary line nobody chose |
| Sub-records of a `×N` group | **gone entirely**, not hidden | the elements trace, and only if the run requested it |
| The four per-line money tiles | gone entirely (099) | the line's own money columns (104 §1) |
| The statistical count report | gone | the distinction survives as the `STAT` key |
| E/W count banner · status dot column | gone entirely (099, 101) | the badge on the line itself |
| The permanent Pricing Elements panel | gone | the same rows, inside the opened line |

The **auto-selected first line** is the sharpest loss and was ruled on explicitly: line 1 is whichever
material you typed first, not the one that surprised you. Today's auto-selection is an artifact of a
panel that had to render *something*, not a judgment that line 1 matters — and with the panel gone,
the reason for a default goes with it. 099 also ruled the first read after a run is "did the promotion
fire?", which the rail answers; opening line 1's rules answers a question nobody has asked yet.

The one **irrecoverable** loss is the sub-records row — and only on runs that did not request elements.

**Newly free — the offset, recorded because the ledger is not one-way:**

- The `W` message was visible only for the *selected* line, inside the panel. It is now always visible
  on its own line. **Strictly better than today.**
- `conditionRate` / `conditionBaseValue` were behind a card expand. Now always on the card. **Strictly
  better.**
- Missed promotions were commented out of the page entirely (`SimulationPage.tsx:357`). Now in the
  rail (101). **Strictly better.**

### What this hands on

- [105](105-sim-responsive-arrangement.md) — rule 2 is a constraint on the stack: when 66/34 stacks,
  the expansion still may not exceed its frame. The expansion's own width never becomes a breakpoint.
- [106](106-sim-rtl-mirroring.md) — the expansion is a nested grid with end-aligned money and a
  start-edge open mark; it mirrors with the line, adding nothing new to 104's three.
- **For the spec — i18n churn**, feeding the map's accumulating fog patch. Retires `detail.tiles.*`,
  `detail.showStatistical`, `detail.hideStatistical`, `detail.records`, `detail.subRate`,
  `detail.title` (the panel heading), `bonus.tabs.elements` and `bonus.elements.empty`. Survives and is
  promoted: `detail.rateBase` (now always visible). New: the `STAT` key and the two expansion
  sub-headings. `SimItemDetail.tsx` and `SimBonusBuyPanel.tsx` both dissolve into the line expansion.
- **A testing seam**, second after 102's staleness predicate: `aggregateConditions` is now the only
  producer of the expansion's rule list and its `isStatistics` flag is load-bearing for the `STAT`
  key — a pure module with a live consumer contract, which is exactly the shape 090's vitest tier
  wants.
