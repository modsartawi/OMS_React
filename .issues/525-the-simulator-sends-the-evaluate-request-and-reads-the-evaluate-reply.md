---
status: open
spec: BO 2737 (brief § Doors → Rules/Authoring/Simulate; § The evaluate reply)
blocked-by: 522
---

# 525 — The simulator sends the evaluate request and reads the evaluate reply

Split out of [520](520-the-rule-campaign-screens-call-the-real-doors-on-staging.md) on 2026-10-17.

## What to build

Re-point 514 from `RuleCampaign/Simulate` to **`POST Rules/Authoring/Simulate`**:

- **Request:** `{ storeCode, country, channel, currency, decimals, lines: [cartLine], profile: { loyaltyId,
  … }, coupons, flags, requestedPoints }`, plus **one of** `campaign` (unsaved JSON) or `draft` (a saved
  draft's id). Send neither for the newest version alone. Sending both is `RULES_BAD_REQUEST`. Optional:
  `tree?`, `csv?` in place of `lines`, and `at?` (local; absent = now). A cart line is `{ lineNumber, article,
  quantity, unit, baseUnitQuantity, gross, netBeforePromotion, vatRate, category, fee, attributes }`.
- **The CSV goes to HQ as `csv`**, which reports a bad file as `RULES_BAD_BASKET` by file line. 514's
  client-side "used only when every row is good" check can stay as a pre-check, or go. Decide while
  building.
- **Reply:** `{ basedOnVersion, campaign, at, lines: [{ lineNumber, article, quantity, net, discount,
  netAfter, effects }], reply }`, where `reply` is the evaluate reply: `effects` per **unit**, `points`,
  `nearMisses[].gaps` (`check, path, amount, unit, currency, text, says`), `trace` (`status` and `code`),
  `prompts`, `refusals`, `messages` and `offers`. Rewrite `sim-result.ts` over it. Two of 514's open asks
  are answered: near-miss gaps carry `path` + `says`, and points totals come from `reply.points`.
- `RULES_INVALID_CAMPAIGN` arrives pointed at blocks: show it the way the checks pill shows its issues.

## Spine reach

model (evaluate shapes) · logic (`sim-result`, `basket`) · api · component (SimResults) · test

## Proof (→ `tdd` red-green cycles)

- [ ] `simResult_sumsUnitsPerLine`, trace order, and near-miss gaps from a real-shaped reply · pure
- [ ] simulator drive re-stubbed, green · flow

## Done when

The simulator sends and reads the real shapes, and its drive is green stubbed.
