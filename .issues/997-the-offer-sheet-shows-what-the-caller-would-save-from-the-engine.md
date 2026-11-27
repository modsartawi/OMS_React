---
status: open
spec: 995
blocked-by: 996, 4459 (BackOffice)
---

# 997: The offer sheet shows what the caller would save, from the engine

Slice of [spec 995](995-the-agent-reads-an-offer-the-way-the-caller-hears-it-spec.md). Reference picture:
canvas *Call center offer card for agents*, artboard **B** (offer sheet).

## What to build

The card's title or *Open* opens a side sheet over the summary column. Below 1280 px it is a full-height
overlay. Esc closes it and focus returns to the card (D1).

The sheet has these sections:
- **Header:** *Offer · phone orders only*, the headline and the item.
- **Three figures from `OfferWhatIf` (C3):**
  - **Saves** (`saving`);
  - **Each works out** (`payableAfter` spread only as the server words it: the server returns `unitAfter`
    when the offer is a single item, and the client never divides);
  - **Ends** (days left and the date).

  Until the read answers, it shows the definition (*100% off 1*). If the read fails, it shows *"Couldn't price
  this right now"* and the definition. A client-computed figure never appears.
- **How it works:** the buy side and the get side in words, plus a progress bar in units.
- **Add to the order:**
  - material: one row with *Add N* (`whatIf.adds`);
  - grouping: `ResolvePrereq`'s ranked rows, stock-checked, adding one at a time.
- **Who gets it:** the tiers with ✓ for the caller, and *Phone orders*.
- **What to say:** the long script in English and Arabic.
- **Footer:** the BBY number as a copyable chip *"for support"* (D8).

The what-if query key is the transaction, the offer and the basket version, so any basket change marks it
stale and the open sheet re-reads it once (D5, D6). It is never prefetched for closed cards.

## Spine reach

contract doc (§3.x OfferWhatIf, v1.14) · model · api (`offerWhatIf`) · component (`OfferSheet`) · i18n en/ar · test

## Proof (→ `tdd` red-green cycles)

- [x] `whatIfIsReadOnlyOnOpen`: a closed card makes no call · component
- [x] `basketChangeMakesTheWhatIfStale`: version bump → one re-read · component
- [x] `failedWhatIfShowsTheDefinitionNotAFigure` · component
- [x] Playwright: open → saving shown → Add 3 → re-read → fires → sheet says *Applied* and closes to card D

## Live

Owner's case: the sheet for OMS000004571 with 1 × 509366 shows Saves = the engine's what-if, and after
Add 3 the fired amount equals the what-if saving.

## Comments

**2026-11-27 — built on `spec/995-offer-card`, on stubs; live walk owed (status stays open).**

Built: the `OfferWhatIf` model and `callCenterApi.offerWhatIf` + `offerWhatIfKey(transactionId, offerId,
version)`; `offer-sheet.ts` (the query's key and `enabled`, the figure state, the definition as a figure,
how it works, who gets it, the longer script) with its vitest; `OfferSheet.tsx`; the card's title and
*Open* (and a grouping's *Choose the items*) open it through `GuidanceActions.onOpenOffer`, wired in
`ConsoleShell`; `callcenter:offer.sheet.*` / `offer.say.qualifies|wouldSave` in en and ar; CONTRACT.md
§1.1 verb row, §3.9 `OfferWhatIf` and a §10 v1.14 row.

**How each proof is taken** (RTL is not installed, spec 083):
- the three "component" proofs are pure-module vitests of what the sheet's `useQuery` reads
  (`whatIfQuery`'s key and `enabled`) and of the figure model it draws (`sheetFigures`), in
  `offer-sheet.test.ts`;
- and again in `tools/callcenter-offer-sheet-drive.mjs` (36/36) by counting real requests: 0 what-if
  calls with the card closed; 1 on open; a `ChangeQty` on another line with the sheet open → exactly 1
  re-read; Add 3 → one `AddItem` 509366 × 3 → *Applied* → closes to card D, which takes focus, and no read
  after it fired; a 500 → *Couldn't price this right now* and *100% off 1*, no money anywhere in the
  figures; Escape closes and focus returns to the card's title; below 1280 px a full-height overlay.

**Guessed, because the server half (BackOffice 4459, and 859/4458 under it) is unbuilt:**
- every field name is 4459's: `adds[] { itemNumber, qty }`, `fires`, `saving` (positive), `payableBefore`,
  `payableAfter`, `unitAfter` (null for several items), plus an `offerId` echo;
- the drive's figures (98.00 saved, 73.50 each, 108.00 → 304.00 with a second 10.00 line) are what the
  owner's case should answer, not an engine run.

**Decided here:**
- **The sheet is not modal** (so not core's `SideSheet`): it opens *beside* the basket (spec B) and the
  basket stays usable, which is the case D5's version-keyed re-read exists for. Escape (unless a modal,
  e.g. the below-ATP confirm, is over it) closes it; focus goes into it on open and back to the card's
  title (or card D) on close.
- The card's title and *Open* open the sheet; the card's own disclosure (its stock pill, list and BBY link)
  moved to a chevron beside them, so the 171–415 open/closed behaviour and its drives stand.
- *Each works out* is `unitAfter` only; with `unitAfter: null` that box says *Total becomes* with
  `payableAfter` — never a division. Under the figures: *The order goes from {before} to {after}*, and
  *the engine says it would not apply yet* when `fires` is false.
- *Ends* shows the day and days left however far away (the card's badge keeps D4's 14-day rule);
  `offer-badges.ts` gained `offerEnds` for it.
- The material row adds `whatIf.adds` once the read answers, the card's own add (`offer-strip.ts`) before
  that, so *Add* is never withheld while pricing.
- *Applied* shows the fired promotion's own amount for 1.5 s, then the sheet closes to card D.
- The tier line says *caller qualifies*, not *caller is Silver*: the session carries no caller tier (996).

**Owed:** the live walk once 859, 4458 and 4459 deploy — the owner's case (OMS000004571, 1 × 509366 at
P721): Saves = the engine's what-if, and after Add 3 the fired amount equals that saving (−98.00). 4459's
timing target (< 500 ms warm) is recorded there.
