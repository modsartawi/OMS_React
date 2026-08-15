---
status: done
spec: 282
blocked-by: 285
---

# 288 — The settlement front page counts the work and links to it

## What to build

The Overview — the settlement door — gains a **counted signpost** through to the lane: how many
entries the estate has owing, how many owed, and how many receipts are waiting, each linking to its
tab.

This is what makes the work discoverable from the screen an accountant already opens. The front page
stays a **glance** — it does not grow a lane, and the prototype's finding that killed the untriaged
list stands: ~140 cards at estate scale, 131 of them merely ageing, burying the four that were
actually wrong. Chasing is a work session and lives on its own screen; the front page only says how
big it is and points at it.

**Counts are rows** — not money (`figures.ts` refuses to total across currencies, and the
`currencyKey` hole is still open) and not branches (a branch with four shortages is four calls). They
come from the **same one call** the lane makes, so the signpost and the tab counts can never disagree.

🚩 **A failed read draws an em-dash and says the read failed.** It must never render as `0`, and it
must never render as *nothing needs you* — that exact mistake was one of ticket 270's own
`/code-review` findings, and this is the surface it happened on.

Links carry the reader's scope through, per `addresses.ts`'s keep-list rule, and land on the right
tab.

## Spine reach

logic (the counts off the existing lane query) · component (the signpost on the door) · i18n · test
(pure + drive)

## Proof (→ `tdd` red-green cycles)

- [x] `door: the signpost counts rows, and says nothing it cannot count` — counts per tab from one
      answer; a failed read yields the failure case rather than zeroes · **pure**
      (`open-lane.test.ts`, six cases) — the counts are asserted **equal to the lane's own**
      (`tallyOpenLane` is the one function both surfaces read, and `buildOpenLane` now delegates to
      it), plus *counts are rows not branches* (four shortages on one branch is four), *a door that
      answered nothing is not a door that failed*, and the cap making the count a **floor**
- [x] Drive `tools/settlement-drive.mjs`: the signpost renders its counts, each link lands on
      its tab with the scope preserved, and a stubbed refusal shows em-dashes plus the failure
      sentence · **flow (Playwright)** — **256/256 PASS**, at estate scale (1,012 owing / 385 owed
      off the same fixture the lane draws). Also driven: the cash count **absent** rather than a
      fabricated zero; **both** links carrying the scope, the Owed one carrying its tab and the
      Owing one spelling its default as an absence, both dropping the search query that led there;
      and the wrong-money triage beside the signpost untouched by the lane's refusal

**Also run:** `npm run typecheck` clean · `npm test` 1883/1883 (118 files) · `npm run lint`
(boundaries, contrast, colour literals) clean · `npm run build` green.

**Nine decisions taken unattended, logged in `.afk/HITL-288.md`.** The load-bearing ones: **two
links, not three** — *Boundaries* beats *Done when* while 286 is unbuilt, and a third would point
at `?tab=cash`, which lands on Owing and therefore lies about where it goes; the counts come from
**the lane's own query, key and all**, so clicking through costs no second call and the two
surfaces cannot disagree; the door's *Refresh* now invalidates the lane too; a read **in flight**
draws the same em-dash as a failed one but says nothing (285's own finding, applied here before the
drive could find it again); and the server's refusal is **interpolated into** this screen's
sentence rather than replacing it, because *"at least one ledger criterion is required"* alone says
nothing about what the em-dashes beside it mean.

**Reviews in `.afk/REVIEW-288.md`.** `/code-review` (high) found two; one real and fixed here —
`invalidateSettlement` was invalidating **`['settlement','worklist']`, a key nothing registers**
(270's spelling, renamed to `orphans` by 274 everywhere but this line), so every post, cancel and
close-out left the wrong-money lane serving cache for up to a minute. `/standards-review`: **no
hard standards violation**; both axes independently found the signpost **re-spelling
`openTabSearch` inline**, which put this screen's URL grammar in two places and left the new pure
test asserting a builder the component did not call — fixed, and the drive now proves the scope
and the tab through **both** links.

## Boundaries

No new endpoint — reuses [285](285-open-entries-list-oldest-first.md)'s call and
[286](286-prepared-receipt-shows-how-long-it-waited.md)'s if that tab has landed; the cash-waiting
count is simply absent until it has, rather than shown as zero. New keys in the existing `settlement`
namespace.

## Done when

The settlement door shows three counted links through to the lane, the counts match what the tabs
show, and a failed read renders em-dashes with the failure sentence rather than zeroes.

## Blocked by

[285](285-open-entries-list-oldest-first.md) — there is nothing to count or link to until the lane
exists.
