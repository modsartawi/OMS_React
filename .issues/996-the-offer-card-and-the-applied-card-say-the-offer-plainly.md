---
status: open
spec: 995
blocked-by: 859, 4458 (BackOffice)
---

# 996: The offer card and the applied card say the offer plainly

Slice of [spec 995](995-the-agent-reads-an-offer-the-way-the-caller-hears-it-spec.md). Reference picture:
canvas *Call center offer card for agents*, artboards **A** (pitch card) and **D** (after it fires).

## What to build

**The near-miss card in the *One step away* column becomes the pitch card (D1–D4, D7):**
- A headline from `definition`, for example *"Buy 3, get the 4th free"*. The author's `description` becomes
  the subtitle.
- Badges:
  - *Phone orders only* (`audience.channelOnly`).
  - The tier badge with ✓ or ✗ (`audience.tiers`, `callerQualifies`).
  - *Ends <day date> · N days left* (`endsOn`, shown within 14 days).
- **The unit strip:** `unitsNeed + getQty` slots, marked *in basket*, *add* or *FREE*.
- **The primary action:** *Add N more[, 1 of them free]*. It is one `addItem` of the missing quantity for a
  material offer. For a grouping it opens the sheet (997).
- Stock at the order's store beside the action, from `ResolvePrereq`'s top row, read on demand as today.
- A **Say** line in English and Arabic (`offer-say.ts`).
- No money on this card (D5).

**The fired card in the *Applied* column becomes card D:**
- The engine amount.
- The line it landed on and the quantity.
- The arithmetic, `qty × unit gross = before · caller pays after`, using the line's own server figures and no
  new client sums beyond the multiplication the line already shows.
- *Removing one takes the free one away* when `getQty > 0`.
- A Say line.

**Degrading:**
- With no `definition`, the headline is `description`.
- With no `unitsHave`, the strip is hidden and the old `have/need` text shows.

## Spine reach

contract doc (§3.1 v1.14 fields) · model (`NearMiss.definition/audience/endsOn/progress.units*`) · pure (`offer-headline.ts`, `offer-strip.ts`, `offer-badges.ts`, `offer-say.ts`) · components (`OfferCard`, `AppliedOfferCard`) · i18n en/ar · test

## Proof (→ `tdd` red-green cycles)

- [ ] `buy3Get1FreeReadsAsTheFourthFree`: definition {3, 1, sameItem, percent 100} → "Buy 3, get the 4th free" · pure
- [ ] `percentOffWithNoGetSide`: {2, 0, percent 20} → "Buy 2, 20% off" · pure
- [ ] `noDefinitionFallsBackToDescription` · pure
- [ ] `stripIsUnitsPlusFree`: have 1, need 3, get 1 → [in, add, add, FREE] · pure
- [ ] `endsBadgeOnlyWithinFourteenDays`: fixed clock · pure
- [ ] `tierBadgeSaysWhetherTheCallerQualifies` · pure
- [ ] `sayDropsThePhoneClauseWhenNotChannelOnly` · pure
- [ ] Playwright: the card on a v1.14 stub adds 3 with one click and turns into card D on the next state

## Live

Owner's case on the walk: tier S, 509366 × 1 at P721 → OMS000004571 reads *Buy 3, get the 4th free*,
1 of 4, phone only, Silver ✓, ends Thu 3 Dec. Add 3 → card D shows −98.00 (the engine's amount).
