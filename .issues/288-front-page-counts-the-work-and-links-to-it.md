---
status: open
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

- [ ] `door: the signpost counts rows, and says nothing it cannot count` — counts per tab from one
      answer; a failed read yields the failure case rather than zeroes · **pure**
- [ ] Drive `tools/settlement-drive.mjs`: the signpost renders its three counts, each link lands on
      its tab with the scope preserved, and a stubbed refusal shows em-dashes plus the failure
      sentence · **flow (Playwright)**

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
