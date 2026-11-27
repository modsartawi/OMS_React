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

- [ ] `whatIfIsReadOnlyOnOpen`: a closed card makes no call · component
- [ ] `basketChangeMakesTheWhatIfStale`: version bump → one re-read · component
- [ ] `failedWhatIfShowsTheDefinitionNotAFigure` · component
- [ ] Playwright: open → saving shown → Add 3 → re-read → fires → sheet says *Applied* and closes to card D

## Live

Owner's case: the sheet for OMS000004571 with 1 × 509366 shows Saves = the engine's what-if, and after
Add 3 the fired amount equals the what-if saving.
