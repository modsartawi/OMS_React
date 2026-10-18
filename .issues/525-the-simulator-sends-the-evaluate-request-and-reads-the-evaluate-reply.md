---
status: done
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

- [x] `simResult_sumsUnitsPerLine`, trace order, and near-miss gaps from a real-shaped reply · pure
- [x] simulator drive re-stubbed, green · flow

## Done when

The simulator sends and reads the real shapes, and its drive is green stubbed.

## Comments

### 2026-10-18: AFK, done

**Results.**
- Typecheck is clean.
- Vitest passes: 340 files, 5625 tests. The simulator's own files hold 29: `basket.test.ts` and `sim-result.test.ts`. They include `simResult_sumsUnitsPerLine`, the trace kept in HQ's order and counted by status, near-miss gaps carrying `path` and `says`, and `basketCsv_readsHqColumns_andFlagsBadLinesByFileLine`.
- All four lint gates are clean, and the build is green.
- Drives, all stubbed in the real envelope, never a live SIS.Api:
  - `simulator-drive` 71/71
  - `campaigns-drive` 625/625
  - `priority-drive` 50/50
  - `sessions-drive` 73/73

**What moved.** The simulator calls `POST Rules/Authoring/Simulate`. The invented `RuleCampaign/Simulate` and every `RuleSim*` type are gone, along with the door's PROVISIONAL mark.
- **Request.** The `evaluate` request: `storeCode`, `country`, `channel`, `currency`, `decimals`, cart `lines`, `profile`, `coupons`, `flags`, `requestedPoints`, `at` (local `yyyy-MM-ddTHH:mm`), plus `draft` from `?draft=`. Or a `csv` in place of the lines.
- **Reply.** `RuleSimulation` reads `{ basedOnVersion, campaign, at, lines, reply }`, where `reply` is the evaluate reply. Unit effects are summed per line and per campaign / rule / effect; points, created coupons, messages, prompts, offers and refusals sit on the whole sale. Near misses show their gaps (text, the "not met" `says`, `path`); the trace is in HQ's order with its status and code.
- **Refusals.** `RULES_INVALID_CAMPAIGN` lists its blocks as where → what plus the path, as the checks pill does, and links to the campaign. `RULES_BAD_BASKET` lists its file lines. A bare 403 names the missing grant. `apiErrorDetails` was added to `core/api.ts` to read a refusal's detail lines.
- **Reuse.** The model reuses 527's `rule-session.ts` types (`RuleUnitEffect`, `RulePointsEffect`, `RuleCartLine`, `RuleCreatedCoupon`, `RuleSessionRefusal`).

**UI the shapes forced** (decisions in `.afk/HITL-525.md`):
- a unit price per typed line, and the category from the materials lookup;
- a Country select that sets the currency and decimals;
- earning / first-purchase checkboxes, coupons, and points to redeem;
- the offers' "customer says yes";
- the file basket shown read-only.

**Drive assertions re-cut, with reasons.**
- **1.** "No probe" now means no rule-door probe. Other screens' menu probes are not this screen's.
- **2.** The channel lookup check went in 523 (fixed list).
- **4.** The request body is the real evaluate request.
- **5.** These checks are replaced, because the real trace has no campaign names, rules or condition rows: per-rule `ran`, per-condition met / not met, both names in the trace, and the group mode wording. The replacements cover:
  - the trace order;
  - status and code words;
  - HQ's reason in both languages;
  - group ids, lost, and money given;
  - gaps with path and says;
  - a coupon refusal.
- **7.**
  - The unknown-SKU row is gone: HQ does not look SKUs up in a basket file, and the per-row materials lookups are gone.
  - The semicolon file is now comma-only, because HQ splits on commas.
  - "Add to it" is gone: HQ refuses lines and a csv together.
  - Added: a header without net, HQ's `RULES_DUPLICATE_LINE`, and `RULES_BAD_BASKET` by file line.
- **8.** The `;` upload became a comma file. The bonus-buy note moved here (M01 is BonusBuy in the lookup).
- **10.**
  - `includeDrafts` is gone: the contract has no "every working copy".
  - Added: `draft` sent, the "ran as its draft" line, the prompt (the real home of GIFT-POUCH's "scan a pouch"), the offer flag round-trip, and a campaign with no saved draft running live.
- **11.** The refused run is a bare 403 now, not an invented `RULE_SIM_UNKNOWN_STORE`.
- **13 (new).** `RULES_INVALID_CAMPAIGN` pointed at blocks.

**Shared fixture.** In `tools/campaigns-fixtures.mjs`, the materials `detail` was re-cut from "A002" to HQ's real "A002 Beauty Care" form. The campaigns, priority and sessions drives were re-run green.

**Reviews.**
- /code-review raised 10 findings, and these were fixed:
  - prices re-checked at the current decimals;
  - a failed `?draft=` read explained;
  - the trace counted with `Object.hasOwn`;
  - SAR points shown in their own unit;
  - the file basket list capped;
  - the currency reused from `campaignCurrency` / `currencyDecimals`;
  - HQ's empty where / path read;
  - a trailing sign read as .NET does.

  Left open with BO asks: the country does not follow the store, and the stores select tops out at 50 hits.
- /standards-review found no hard violations. These were fixed: an unused key, the points plural and isolation, a shared `RULE_TRACE_CODES`, the stray line number, and the lookup-failure wording.

**Outstanding (not AFK's).**
- The live run against a real SIS.Api (ticket 520).
- Owner sign-off on the settled decisions in HITL-525.
- BO asks: **G** (a material's category code as a field) and **H** (a store's country in the stores lookup).
