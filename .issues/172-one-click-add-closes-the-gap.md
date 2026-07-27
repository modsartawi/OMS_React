---
status: done
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

- [x] `anAddIsClassifiedByWhatTheEngineDid` — pure: comparing the states before and after an add
      yields fired / fired-a-different-offer / did-not-fire, and the did-not-fire case **keeps the
      offer** with its meter advanced · pure
- [x] `theGetSideNoticeIsAPropertyOfTheSurface` — pure: present while no get-side near-miss can
      arrive, gone the moment one does, with nothing else in the view model changing · pure
- [x] `oneClickAddSaysWhatHappened` — drive: the handful is three; the row shows `Adding…` and does
      not move; each of the three outcomes renders its own banner; `Search the other N` lands in the
      item search filtered to the offer; the qualifying row carries Arabic on the meta line · flow
      (Playwright, extends `tools/callcenter-guidance-drive.mjs`)
      → **103/103, no page errors** (171's 59 plus this ticket's 44), at 1440×900, over fixture 03's
      own `resolve` block. The pure tiers are `add-outcome.test.ts` (the classification and the
      qualifying rows) and the new `theGetSideNoticeIsAPropertyOfTheSurface` block in
      `guidance-view.test.ts`, which proves the notice's disappearance by flipping ONE field of one
      offer (`prereq.kind: grouping → condition`) and asserting the whole view model is otherwise
      byte-identical. 🚩 The drive asserts what is **visible inside the clamp** for exactly the two
      things 138 watched fall below the fold — the third qualifying item and `Search the other N` —
      at three offers *and* at seven, plus the 45%-of-centre budget with the items open.

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

## As built — what the reviews surfaced

- 🚩 **`ItemSearch` needs an optional `offerId`, and the console already sends one.** The hand-off is
  the one ruling with no wire behind it: §1.1 spells the search as `?transactionId=&query=`, so
  `Search the other 994` narrows nothing until BackOffice
  [799](C:\Work\DMSCO\BackOffice\.issues\799-cc-item-search-endpoint.md) accepts the param. The
  client takes it as **additive and server-first**, exactly as 171 took `NearMiss.discount` — and it
  **degrades honestly**: the panel's chip says *narrowed to this offer* and names it, rather than
  claiming *filtered*, so a server that ignores the param leaves the agent with a wider list and no
  lie on screen. **The first integration must land it**, or the route to the rest of a 997-strong set
  is a search box with a label.
- **`truncated` is what says there IS a rest — not the arithmetic.** Drawn first as
  `eligibleCount − shown`, which on an untruncated answer routes the agent after rows the server
  deliberately withheld: the resolution is availability-filtered (§3.3), so 42 qualifying against
  three drawn does not mean 39 are waiting. The population supplies the FIGURE; `truncated` supplies
  the permission. Where the two contradict each other, the route is offered without a figure.
- **The handful is not sliced, and the drive proves it by over-feeding the console.** Given four
  ranked rows the card draws four. Three is the ruling and it is the **server's `topN`** — a client
  slice of a server ranking is a second opinion about which three are worth showing. 🚩 So `topN: 3`
  is a BackOffice 787 obligation, and the frozen fixture still says `25`.
- **The resolution is not re-fetched while an add runs, by cache key.** `prereqKey` deliberately
  omits `version`: the row that launched the add must not move under the cursor, and a key that
  changed with every re-price would re-rank the list mid-click. The **outcome banner**, not a
  silently re-ordered list, is what says what happened.
- **Two affordances neither the ticket nor 138 asked for, kept deliberately.** The outcome banner is
  **dismissible** (it lives outside the clamp, where an unclearable banner becomes furniture by the
  third call — the same reasoning as 167's refusal banner), and the search scope carries **focus plus
  a way back to the whole catalogue** (a scope with no exit is the dead end 162's ruling exists to
  prevent). Both are drawn, both are in the drive.
- **The read is the strip's own `useQuery`, not the page's.** Every *mutating* verb on this screen is
  the page's because it returns the whole `SessionState`; `ResolvePrereq` returns none, is asked only
  when a card is open, and follows `ItemSearchPanel`'s precedent for a pure read owned by the surface
  that needs it.

## Blocked by

[171](171-guidance-strip-three-classes.md) — the cards must exist before they resolve their items.
