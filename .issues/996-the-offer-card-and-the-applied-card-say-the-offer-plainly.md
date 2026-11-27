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

- [x] `buy3Get1FreeReadsAsTheFourthFree`: definition {3, 1, sameItem, percent 100} → "Buy 3, get the 4th free" · pure
- [x] `percentOffWithNoGetSide`: {2, 0, percent 20} → "Buy 2, 20% off" · pure
- [x] `noDefinitionFallsBackToDescription` · pure
- [x] `stripIsUnitsPlusFree`: have 1, need 3, get 1 → [in, add, add, FREE] · pure
- [x] `endsBadgeOnlyWithinFourteenDays`: fixed clock · pure
- [x] `tierBadgeSaysWhetherTheCallerQualifies` · pure
- [x] `sayDropsThePhoneClauseWhenNotChannelOnly` · pure
- [x] Playwright: the card on a v1.14 stub adds 3 with one click and turns into card D on the next state

## Live

Owner's case on the walk: tier S, 509366 × 1 at P721 → OMS000004571 reads *Buy 3, get the 4th free*,
1 of 4, phone only, Silver ✓, ends Thu 3 Dec. Add 3 → card D shows −98.00 (the engine's amount).

## Comments

**2026-11-27 — built on `spec/995-offer-card`, on stubs; live walk owed (status stays open).**

Built: `offer-headline.ts`, `offer-strip.ts`, `offer-badges.ts`, `offer-say.ts` (each with a vitest), the
v1.14 fields on `NearMiss` (`OfferDefinition`, `OfferAudience`, `progress.unitsHave/unitsNeed`, `endsOn`),
`promotions-panel.ts` (`pitch` per card, card D's `landed` / `keepAll`, `rememberDefinitions`),
`OfferCard.tsx` and `AppliedOfferCard.tsx`, a bilingual `SayLine`, `callcenter:offer.*` in en and ar, and
CONTRACT.md §3.1 (v1.14 fields) plus two §10 rows (the 1.14 fields; the C1 + 574 US26 owner ruling).
Drive: `tools/callcenter-offer-card-drive.mjs` 29/29 on a v1.14 stub of the owner's case;
`tools/callcenter-guidance-drive.mjs` 166/166 (two 987 checks re-worded for card D).

**Guessed, because the server half (BackOffice 859, 4458) is unbuilt:**
- Every field name and value is 4458's table: `discountType` as `percent | amount | price`, `endsOn` as a
  `yyyy-mm-dd` date (a datetime is read by its day), `tiers` as codes `P/G/S` (named Platinum / Gold /
  Silver; an unknown code is shown as itself).
- `firedPromotions[].offerId` is assumed to carry the same id as the near-miss had (C1's BbyNumber), because
  card D's *Removing one takes the free one away* reads the definition the offer had while it was a
  near-miss, remembered for the call in `ConsoleShell` (C4: no wire change on fired promotions). With no
  remembered definition the warning is not shown.
- The tier badge cannot say *caller is Silver*: the session has no caller tier, so it says
  *Platinum, Gold, or Silver members ✓ caller qualifies*, off `callerQualifies`.

**Decided here:**
- The add is `unitsNeed − unitsHave + getQty` when the get side is the same item (the free unit must be on
  the line), else `unitsNeed − unitsHave`; only for a `material` prerequisite with a `materialNumber`.
- Card D's arithmetic is drawn only when the promotion landed on exactly one line; `before` is
  `qty × unitPrice.gross` (the only client figure), `after` is `lineTotal.gross`, the saving is the engine's
  amount. Several lines keep 987's card.
- A grouping's *Choose the items* calls `GuidanceActions.onOpenOffer` (the hook for 997's sheet); until
  that exists it opens the card's own qualifying list.
- The Say line sits under the qualifying list so the route to the rest stays inside the clamp (138
  finding 1); the Arabic line is its own row (`lang="ar" dir="rtl"`).
- English days are said day-first (*Thu 3 Dec*, en-GB).

**Owed:** the live walk on the owner's case once 859 and 4458 deploy (tier S, 509366 × 1 at P721 →
OMS000004571: *Buy 3, get the 4th free*, 1 of 4, phone only, Silver ✓, ends Thu 3 Dec; Add 3 → card D at the
engine's −98.00).

**2026-11-28 — reconciled to the BackOffice server half (pricing2 610d7354a: 859, 4458, contract 1.14).**
Branch `t/995-reconcile`. The wire matched the stub's field names; what changed:
- `audience.channelOnly` is true only when EVERY origin code matches the seat (`C,S` on `C000` is false) —
  the badge reads it verbatim, so only the model doc and CONTRACT §3.1 changed.
- `offerId` is `OfferId` else the BbyNumber; the BbyNumber is not on the wire. `endsOn` is `yyyy-MM-dd`;
  `definition.discountType` null for a type the server does not name (free goods arrive as percent 100).
- The card's add quantity matches the server's (`unitsNeed − unitsHave` + `getQty` when `getSameItem`), and it
  now carries the prerequisite's unit (`definition.buyUom`), as the what-if's `adds[].uom` does.
- 🚩 **An Add for an item already on the order is that line's `changeQty`** (to its qty + the add's), never an
  `addItem`: the console refuses a repeat add (`ITEM_ALREADY_ON_ORDER`, any unit) and 4459 priced the line
  growing. The owner's case (509366 × 1, *Add 3*) is one `ChangeQty` of L10 to 4. `guidanceAddPlan` decides it
  for every guidance add (card, sheet, qualifying rows); its outcome is classified like an add. An item on a line
  in ANOTHER unit than the add's is not sent (the client never converts units): a toast says to change that line.
- 🚩 Card D's amount is `firedPromotions[].amount`, the engine's **ex-VAT** `TotalDiscountValue` (4459), so the
  card now says *before VAT* under it. Its Say line (*You save X*) still quotes that ex-VAT figure.

Gates: typecheck, vitest, lint; drives offer-card 34/34, offer-sheet 58/58, guidance 166/166 (+ callcenter,
basket). **Live walk still owed** on a deployed 1.14 host.

**Owner rulings owed:** (1) the Live line above expects card D at −98.00; on the engine it will read about
−85.22 (ex-VAT), so either the check changes or `firedPromotions` gains a VAT-inclusive figure (a BackOffice
ask); (2) whether card D's Say line may quote an ex-VAT figure as the caller's saving.
