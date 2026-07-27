---
status: open
spec: 160
blocked-by: 171
---

# 172 — oneClickAddClosesTheGapAndSaysWhatHappened

## What to build

The half of the guidance surface that does something. An actionable card resolves its unmet
prerequisite to **actual items the agent can suggest**, and adding one is a single click.

- **A grouping is a set, not an item.** The card states the honest cardinality (`42 qualify`,
  `997 qualify`) and shows a **ranked, availability-filtered handful** — **three**, and three is the
  **server's `topN`, never a client slice**. At five, opening one offer pushed every other offer
  below the fold; three is what keeps "three classes in one list" true once the agent actually uses
  the feature.
- **Each qualifying row carries the item's Arabic name** on the **meta line**, beside the item number
  and the estimate. All three are secondary, the bidi isolate already handles the run, and putting
  Arabic there is what made the ruling **cost zero pixels** rather than pushing the route-to-the-rest
  below the fold.
- **The route to the rest is a hand-off, not a second list**: `Search the other 994` opens the
  console's own item search filtered to that offer. A modal here would be the second screen the
  design ruled out.
- **The add runs on the row that launched it** (`Adding…`) and **the row does not move while it
  runs**.

🚩 **Three outcomes, because the re-price is the engine's and not the card's** — and two of them are
the ones a naive implementation gets wrong:

1. **Fired** — the offer moves to the fired list.
2. **Fired a different offer** — say so (`A better offer fired instead: …`).
3. **Did not fire** — the prerequisite was one of several. The offer **stays**, only its meter moves
   (`1/2 → 2/3`), under a banner naming what was added and what is still needed. Silence here reads
   as a broken button; removing the card reads as a bug.

**Get-side absence is acknowledged once, quietly, at the region's edge** — *buy-one-get-one offers
aren't checked yet — this list covers discounts only.* It is a property of the surface, not of a
card, and it **disappears on its own** when the server starts sending them, with no other change.

## Spine reach

api (`ResolvePrereq`; `AddItem` from a card) · logic (outcome classification: fired / fired-other /
did-not-fire; the get-side notice's presence) · component (qualifying rows, in-flight row, outcome
banner, search hand-off) · i18n · test (pure + flow)

## Proof (→ `tdd` red-green cycles)

- [ ] `anAddIsClassifiedByWhatTheEngineDid` — pure: comparing the states before and after an add
      yields fired / fired-a-different-offer / did-not-fire, and the did-not-fire case **keeps the
      offer** with its meter advanced · pure
- [ ] `theGetSideNoticeIsAPropertyOfTheSurface` — pure: present while no get-side near-miss can
      arrive, gone the moment one does, with nothing else in the view model changing · pure
- [ ] `oneClickAddSaysWhatHappened` — drive: the handful is three; the row shows `Adding…` and does
      not move; each of the three outcomes renders its own banner; `Search the other N` lands in the
      item search filtered to the offer; the qualifying row carries Arabic on the meta line · flow
      (Playwright, extends `tools/callcenter-guidance-drive.mjs`)

## Boundaries

**Endpoint:** `GET CallCenterWeb/ResolvePrereq` (BackOffice
[787](C:\Work\DMSCO\BackOffice\.issues\787-web-cc-promotion-guidance-engine.md)) — resolved on demand,
**never inline** for every near-miss, and **never on `Bby/*`** (which is what keeps 134's one-grant
ruling true). Availability filtering and ranking are server-side; `atp: null` where the stock read
degraded, never a non-200. 🚩 The drive asserts **what is visible** inside the clamped strip, not
just its height.

## Done when

An agent closes a promotion's gap with one click from a suggested item, and is told what the engine
actually did — including when it did nothing.

## Blocked by

[171](171-guidance-strip-three-classes.md) — the cards must exist before they resolve their items.
