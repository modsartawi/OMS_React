---
status: done
spec: 995
blocked-by: BackOffice 4461, 4462
---

# 998: A bundle offer names the item the caller still needs

Found on the 2026-11-28 walk. OMS000004508, *50% off 106429 and 50% off 103436, bought together*, showed
these problems with 106429 alone on the order:

- the headline was the author's description, *50% OFF*;
- "How it works" was half a sentence about the first arm;
- the card had no action.

It also showed *"That offer is not a near-miss on this order any more"*, which was the server's ResolvePrereq
bug (BackOffice 4461).

## Built

- **Model:** `OfferDefinition.getItems` / `getAll` and `OfferGetItem` (BackOffice 4462). CONTRACT.md §3.1
  example and a §10 row.
- **`offer-bundle.ts`:** `offerBundle(definition)` returns the bundle only for `getAll` with no buy side and
  every arm naming one item. Each item is held or still to add (`have` against `qty`, a count, never money),
  with the shared percent when every arm has the same one. `bundleNext` picks the first missing item.
- **Headline:** *50% off each of 2, bought together* (`headline.bundlePercent`), or *Buy these 2 together*.
- **Card:**
  - a list of the items, each ✓ *on the order* or *add N*, in place of the unit strip;
  - the action *Add SUPER FIBER 30 SACHET*, one add of the first missing item through the existing add
    plan;
  - the Say line *Add SUPER FIBER 30 SACHET as well and «50% OFF» applies to both.*
- **Sheet:**
  - "How it works" says *Get 50% off each of these 2 items when they are all on the order*, then the
    item list and a bar of items held;
  - the add rows name the missing item from the near-miss.
- **i18n:** en and ar.

## Proof

- [x] `offer-bundle.test.ts` (6) covers:
  - the walk case;
  - OR and a buy side are not bundles;
  - a server without 4462 is not a bundle;
  - arms with different discounts have no shared value;
  - the headline;
  - "How it works" with its list.
- [x] typecheck, vitest 829/829, lint.
- [x] Live on the walk order after *Resume this order*: the card reads *50% off each of 2, bought together*,
  with ✓ STONALI *on the order*, + SUPER FIBER *add 1*, *Add SUPER FIBER 30 SACHET*, and the Say line in
  both languages.
- [ ] The owner pressing *Add SUPER FIBER 30 SACHET* and seeing the offer fire (not done by the agent on the
  owner's order).
