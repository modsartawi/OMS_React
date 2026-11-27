---
type: spec
status: ready
---

# 995: The agent reads an offer the way the caller hears it

Settled on 2026-11-27, during the production walk of the web call center (BackOffice session). The owner
asked for an offer view like the POS Simulation's *Bonus Buy · Display*, but easier for the agent to read:
"organizations not that important for the agent, so just important things that can help to convince the
customer".

The reference mock-ups are on the private canvas *Call center offer card for agents*
(https://claude.ai/artifact/LLZXLQqKgJGwnuq5s2eiub):
- **A**: the pitch card in the promotions panel.
- **B**: the offer sheet.
- **C**: compact rows.
- **D**: the card after the offer fires.

The owner chose **A + B + D**. C is used only when four or more offers compete for the space. The canvas is
a picture of the target, not a source of figures.

The wire is the call-center session contract (`assets/136-cc-contract/CONTRACT.md`). This spec proposes
**v1.14, additive**: decisions C1–C4, served by BackOffice tickets. The Wasfaty/Nphies work moves to v1.15.

## Problem Statement

The promotions panel (983 D7) names an offer by its author's label ("3+1") and counts progress in
*prerequisites met* ("0/1 · add 1 more"), while the offer needs **3 units** and the caller has one. It cannot
list the qualifying items, because every live bonus buy in production (962 of 962) has a blank
`BbyHeader.OfferId` (BackOffice 859), so the card says *"This offer arrived without an id"*.

The agent cannot see any of the things that persuade a caller:
- what the caller gets, in words;
- what it is worth;
- when it ends;
- that it is a phone-only offer;
- that the caller's tier qualifies.

The Simulation's display has all the facts, but it is laid out for the person who **authored** the bonus
buy: organisation, POS numbers, condition types (`ZB03`), and link And/Or.

## Solution

One offer, said simply, in three faces:

- **A · Pitch card** (*One step away* column):
  - A plain headline built from the definition: *"Buy 3, get the 4th free"*.
  - The item.
  - Badges:
    - *Phone orders only* when the offer is call-center-only.
    - *Silver members ✓ caller is Silver* when the offer is tier-limited.
    - *Ends Thu 3 Dec · 6 days left*.
  - A **unit strip**: one slot per unit of the completed offer. Each slot shows *in basket*, *add* or
    *FREE*.
  - One primary action: *"Add 3 more, 1 of them free"*, with stock at the order's store beside it.
  - A **Say** line in English and Arabic.
- **B · Offer sheet**: opens beside the basket from the card. It holds the same facts at full size:
  - **Saves**, **Each works out** and **Ends**. The money comes from the engine what-if (C3) and shows
    only once that read answers.
  - **How it works**, with a progress bar.
  - **Add to the order**: the items that complete the offer, ranked by `ResolvePrereq` and stock-checked.
  - **Who gets it**.
  - **What to say**, as a longer script.
  - The BBY number as a small copyable chip *"for support"*.
- **D · Applied**: the fired card. It shows:
  - the engine's amount;
  - the arithmetic (*4 × 98.00 = 392.00 · caller pays 294.00*);
  - *Removing one takes the free one away*;
  - a Say line.

**Left out on purpose:** organisation, POS and condition numbers, condition types, link categories, promo
numbers, scale and pricing rows. The BBY number stays only as the support chip.

## User Stories

1. As an agent, each offer card tells me in one line what the caller gets ("Buy 3, get the 4th free"), not
   the author's label.
2. As an agent, progress counts **units** ("1 of 4 in the basket"), and the action names exactly how many to
   add ("Add 3 more, 1 of them free").
3. As an agent, I can see at a glance that an offer is phone-only, that the caller's tier qualifies, and how
   many days it has left, so I can say "this is only for phone orders and it ends Thursday".
4. As an agent, one click adds the missing quantity of the qualifying item, stock-checked at the order's
   store. For a grouping, the sheet lists the ranked items to choose from.
5. As an agent, opening an offer shows what the caller would actually save and what the total would become,
   computed by the engine on this basket, before I suggest it.
6. As an agent, every card has a sentence I can read out, in the console's language and in Arabic.
7. As an agent, once the offer fires, the card turns into what was saved, with the arithmetic, and warns me
   that removing a unit loses the free one.
8. As an agent, when an offer cannot be resolved I still see its headline, badges and progress. Only the item
   list is missing, and the card says so plainly.

## Implementation Decisions

- **D1: A + B + D.** The card (A) replaces the near-miss card in the *One step away* column of the
  promotions panel (983 D7) and keeps its verbs. The sheet (B) is a side panel over the summary column,
  opened from the card's title or *Open*. Esc closes it and focus returns to the card. The applied card
  (D) replaces the *Applied* column's card. Rows (C) are used only when four or more near-misses are
  present.
- **D2: The headline is built from the definition, never from `description`.** The headline comes from
  `offer.definition` (C2): `buyQty`, `getQty`, `getSameItem`, `discountType` (`percent` | `amount` |
  `price`), and `discountValue`. These are i18n keys with plurals, for example:
  - `100%` + `getQty 1` + `getSameItem` → *"Buy 3, get the 4th free"*;
  - `percent 20` → *"Buy 2, 20% off"*.

  The author's `description` becomes a small subtitle. With no definition (an unknown shape), the card falls
  back to `description` alone.
- **D3: Progress is units** (C2 `progress.unitsHave` / `unitsNeed`), and the strip is
  `unitsNeed + getQty` slots. The old prerequisite counter (`have`/`need`) stays on the wire for the guidance
  strip, and the card stops reading it.
- **D4: The badges are server facts, never client rules.**
  - *Phone orders only* ⇐ `audience.channelOnly`.
  - The tier badge ⇐ `audience.tiers[]` plus `audience.callerQualifies`.
  - *Ends* ⇐ `endsOn`. Days left is computed against the console's local clock and shows only when it is 14
    days or fewer.
- **D5: The money comes from the what-if only** (C3; the owner's amendment of 574 US26, recorded below).
  - The card shows no money until the agent opens the offer.
  - The sheet calls `OfferWhatIf` once per open (react-query, keyed by transaction, offer and **basket
    version**, so any basket change marks it stale) and shows **Saves**, **Each works out** and **Total
    becomes**.
  - While it loads, the sheet shows the definition. If the read fails, it shows the definition and *"Couldn't
    price this right now"*, never a client figure.
- **D6: Add.**
  - For a material offer, *Add* is one `addItem` of the missing quantity (`whatIf.adds[0]`), through the
    normal add path and its refusals.
  - For a grouping, the sheet's ranked list (`ResolvePrereq`) adds one at a time.
  - After any add the what-if is stale, and the sheet re-reads it.
- **D7: Say lines are i18n keys filled from server facts.**
  - The keys are `callcenter:offer.say.*`, in English and Arabic, and the Arabic is its own sentence, not word
    order translated.
  - The phone-only clause appears only when `channelOnly`.
  - The deadline clause appears only within 14 days.
- **D8: The BBY number is the address** (859, C1). It is shown only in the sheet footer, as a copyable chip.
- **D9: Theme.**
  - Tokens come from `app/global.css`: IBM Plex Sans and IBM Plex Sans Arabic, navy primary, the
    success/attention tints, and the gold focus ring.
  - Touch targets are at least 40 px.
  - The card's number column uses tabular numerals.
  - Below 1280 px the sheet is a full-height overlay.

### Contract v1.14 (additive): BackOffice asks

- **C1: `nearMisses[].offerId` is never blank** (859). It is `OfferId` when that is set, otherwise the
  **BbyNumber**, the key `ResolvePrereq` already looks up. Every live offer in production has a blank
  `OfferId`. This is a §9 amendment, as an owner ruling. → BackOffice
  [859](C:\Work\DMSCO\BackOffice\.issues\859-near-miss-offer-id-is-blank.md).
- **C2: `nearMisses[]` gains the offer's facts:**
  - `definition { buyQty, buyUom, getQty, getSameItem, discountType, discountValue }`;
  - `progress.unitsHave` and `progress.unitsNeed` (single-prerequisite quantity offers; null otherwise);
  - `endsOn` (a date);
  - `audience { channelOnly, tiers[], callerQualifies }`.

  All of these come from the bonus buy record (`BbyHeader` / prereqs / conditions) and the engine's
  found quantities. → BackOffice
  [4458](C:\Work\DMSCO\BackOffice\.issues\4458-near-miss-offers-carry-their-definition-units-end-date-and-audience.md).
- **C3: `GET CallCenterWeb/OfferWhatIf?transactionId=&offerId=`** prices the order's basket **as if** the
  missing quantity were added, in one claim-free engine run (the price check's sibling), and returns:
  - `adds[] { itemNumber, qty }`;
  - `fires` (bool);
  - `saving` (VAT-inclusive, the offer's own conditions only);
  - `payableBefore` and `payableAfter`;
  - `unitAfter`, the VAT-inclusive price per unit of the offer's item after it fires (single-item offers
    only, otherwise null), so the client never divides.

  It writes nothing. Refusals: the session's own, plus `ITEM_NOT_FOUND` when the offer is no longer a
  near-miss. → BackOffice
  [4459](C:\Work\DMSCO\BackOffice\.issues\4459-callcenter-offer-what-if-read.md).
- **C4: No other wire change.** Fired promotions, `ResolvePrereq`, stock and `addItem` are live today.

### Owner amendment of 574 US26 (2026-11-27)

US26 and 138's promise said that the offers region carries the definition and never a figure formatted as
money. **Amended:** the offer **sheet** may show money, and only the engine's own what-if (C3), read on
demand when the agent opens the offer. The *card* stays definition-only. No client arithmetic produces a
saving anywhere. Recorded in CONTRACT.md's §9 amendment table with C1.

## Testing Decisions

- Pure modules, each with a vitest beside it:
  - `offer-headline.ts`: definition → key + params, including fallbacks.
  - `offer-strip.ts`: units → slots.
  - `offer-badges.ts`: audience and end date → badges, against a fixed clock.
  - `offer-say.ts`.
- One Playwright drive on v1.14 stubs:
  1. Open the sheet.
  2. The what-if answers.
  3. Add.
  4. The what-if goes stale and re-reads.
  5. The offer fires.
  6. Card D shows.
- Live verification on the walk set-up (local SIS.Api on production, engine on OMS-HQ) with the owner's
  case: caller tier S, 509366 × 1 at P721, OMS000004571. It must show:
  - *Buy 3, get the 4th free*;
  - 1 of 4 in the basket;
  - phone only;
  - Silver ✓;
  - ends Thu 3 Dec;
  - a what-if saving equal to the fired amount after adding 3.

## Out of Scope

- Wasfaty / Nphies order types (v1.15).
- Offers the caller *holds* (coupons not applied, the *Could still use* column): a separate read.
- Product images.
- Editing or explaining the bonus buy's authoring fields.
- Fanning the what-if out over every near-miss (D5: on open only).

## Further Notes

Found on the same walk and already fixed, uncommitted:
- **The web attach passed no loyalty tier to the engine**, so every tier-limited bonus buy was refused on
  every web order. Fixed by BackOffice
  [4460](C:\Work\DMSCO\BackOffice\.issues\4460-web-attach-passes-the-loyalty-tier.md).
- **The walk's engine store was a stale local DB.** It now points at OMS-HQ. The cutover runbook names
  OMS-HQ as `CallCenterStore`.
