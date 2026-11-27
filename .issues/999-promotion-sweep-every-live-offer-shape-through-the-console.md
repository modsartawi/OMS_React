---
status: needs-triage
spec: 995
blocked-by: —
---

# 999: Promotion sweep: every live offer shape through the console

Asked by the owner on 2026-11-28: *"check all combinations of the promotion, delete items then try different
combination of promotion to make sure our engine know how to read promotions"*.

## How it ran

- **Census.** `assets/999-promotion-sweep/live-offers.sql` read production read-only. 915 offers are valid on
  2026-11-28. `shape.py` grouped them by structure into **36 shapes**:
  - the buy side: none, an item, a group, or a coupon, and its quantity;
  - the get side: number of conditions, `%` / `P` / `R`, scale, reference, one item or many, and its quantity;
  - the header: min/max value, limit, target type and tiers.
- **Live run.** `runner.js` ran through the walk console against production (P001, origin C, a customer
  attached) on the owner's test order `06H1XYE64VRB6KKQT6S29T0R23`. Per shape it:
  1. empties the order and adds one buy item (or one get item);
  2. reads the near-miss and the console's wording;
  3. asks the what-if, then applies its adds the way the console does (`guidanceAddPlan`);
  4. checks the offer fired, by `offerId`;
  5. **takes the last line away again** and checks the offer stops firing and comes back as a near-miss.
- The order was restored afterwards: 103436×1, 106429×2, 108331×1, with both 50% offers fired.
- Results: `assets/999-promotion-sweep/result-2026-11-28.json`.

## What holds (the engine reads every shape)

| Covers | Shapes | Result |
|---|---|---|
| 430 offers: simple % off, fixed price, one item or a group, no buy side | 4 | Fire on the first item, as expected. Not near-misses. |
| 435 offers: 1+1, 2+1, 3+1, 5+1, 2+2, 2nd at X%, 2nd at a fixed price, 4 pcs @ price, 2-item bundles | 15 | The what-if said `fires: true` **15 of 15 times**, and every one fired after its adds. Taking a line away un-fired it and brought the near-miss back, **15 of 15**. |
| 13 offers that lose to another offer on the same items | 4 | The what-if said `fires: false`, and after its adds they did not fire: the other offer did (finding 2). |
| 32 offers gated on a coupon (`COUPxxxx` buy side) | 8 | Near-miss with `prereq.kind: coupon`. The what-if adds nothing and says `fires: false`, correctly. |
| 5 coupon offers on the order total (`CondReference 1`) | 5 | Not reachable by adding items; they need a coupon code. **Not tested.** |

- **Saving.** The what-if `saving` is VAT-inclusive and the fired amount ex-VAT, 1.15 apart on VAT items
  (36.00 / 31.30) and equal on zero-VAT medicines (23.30 / 23.30), as the contract says.

## Findings

1. **Fixed by BackOffice 4463: fired promotions had a blank `offerId`.** The near-miss was
   `OMS000004508` and the fired promotion `""`, so nothing could tie the two. The first pass matched by
   description and wrongly showed two bundles firing.

2. **A near-miss that can never fire still asks for items.** Four of the tested shapes behaved this way:
   - OMS000004588 *28% off each of 5, bought together* and OMS000004590 *33% off each of 4*. With every
     item on the order they do not fire: single-item offers on the same products win (OMS000004565,
     OMS000004262) and give the caller the same 28% / 33% anyway. The card still says *add 4 more items*.
   - OMS000004558 HUMANA MILK 3 *3+1* loses to OMS000004571, the same 3+1 on the same item.
   - OMS000003820 *1+2* loses to OMS000003725.

   The what-if knows this (`fires: false` with adds) and the sheet says it. The card does not.
   **Owner decision:**
   - hide such a card;
   - mark it *another offer already covers this*;
   - or leave it.

   Also a master-data question for the promotions team: the bundles duplicate the single offers.

3. **Fixed-price offers (`P`) have no wording:** about 170 offers, for example *HERO BISCUITS - 2 pcs @ 44*
   and *SWISSLAC - 3 pcs @ 260*.
   - The headline falls back to the author's description, and "How it works" has no get line.
   - The definition's `discountValue` is the ex-VAT unit price of the discounted piece (13.04, which is
     15.00 with VAT), not the "44" the caller hears.
   - A sentence such as *Buy 1, get the 2nd for 15.00* needs a VAT-inclusive figure from the server.

4. **Coupon-gated offers are worded as a purchase:** 32 offers. *Huggies 35% Coupon* reads *Buy 1 of this
   item, and get 1 of the offer's item at 35% off*. The buy side is coupon COUP1096, not an item, and the
   what-if rightly adds nothing. It should read *With the coupon: 35% off …*.

5. **Fixed: a group buy side said "this item".** Where any member of a group counts (`prereq.kind: grouping`), "How it works" now names the selection and suggests no item: *Buy any 2 from this selection, and get 1 more from the selection free* (`buyGroup`, `getGroupFree`, `getGroupPercent`, English and Arabic). A get side on another item keeps *the offer's item*. Owner, 2026-11-28: *"make the wording about groups without suggest an items"*. Proof: `offer-sheet.test.ts` *a grouping buy side is the selection*; typecheck, vitest 830/830, lint.

## Next

- **Server-side wording** (owner, 2026-11-28: an AI agent will create call-center orders): build the
  phrases on the server as `{key, params}` plus English and Arabic text, so the console and an agent read
  the same sentence. Findings 3–5 belong in that work: the server holds the VAT-inclusive price and the
  coupon's identity.
- **Finding 2** waits on the owner's decision.
- **Re-run the sweep** after any engine (SIS.Pos) or promotion-model change:
  1. run `live-offers.sql`, then `shape.py`;
  2. serve the candidates;
  3. run `runner.js`;
  4. compare with `result-2026-11-28.json`.
