# HITL — ticket 420 (Engine Rules paste boxes)

## Q: Where does the 3000 cap flip when BackOffice 2403 ships?
**Decision taken:** It stays 50 for now, as two named constants, one per box:
- `ORIGIN_FILTER_MAX` in `src/features/pricing/bonus-buy-maintenance/editor.ts`, which feeds `ENGINE_LIST_MAX.originFilter`.
- `TEMPLATE_ORIGIN_FILTER_MAX` in `src/features/pricing/coupons/helpers.ts`.

When 2403 ships, flip both to 3000 and update the two "origin filter cap follows the shipped width" tests (`editor.test.ts`, `coupons/helpers.test.ts`) plus drive steps 39 and 41, which assert `/ 50 characters`.
**Why:** The wave ruling. The ticket says to ship 3000 only with or after BackOffice 2403, and until then the validator refuses anything past 50.
**Revisit if:** BackOffice 2403 lands.

## Q: Is the coupon template's shipped width really 50?
**Decision taken:** The box shows 50, per the ruling. Over the cap it only warns ("Over the 50-character limit."). It does not block the save, and it does not claim the server will refuse.
**Why:** BackOffice `Coupons/V2/Sql/003_widen_coupon_originfilter.sql` widens HQ `CouponTemplate.OriginFilter` to `VARCHAR(300)`, and I found no server width check on the coupon admin writer. Blocking at 50 could stop a save that works today.
**Revisit if:** The owner confirms the coupon column is 300 everywhere it is read. In that case `TEMPLATE_ORIGIN_FILTER_MAX` may be 300 until 2403. Or the owner wants a hard client block.

## Q: Should a list past its cap block Save?
**Decision taken:** No. The meter turns to the danger tone, adds "Over the {{max}}-character limit. The server will refuse it." and lets the server's in-band width refusal decide (the editor's standing rule: the client never decides a value is acceptable).
**Why:** It needs the least new client logic, and the server refusal already names the field in EN and AR.
**Revisit if:** The owner wants Save disabled while any list is over its cap.

## Q: The other five lists' caps (500) do not match the server (spec review finding)
**Decision taken:** Kept at 500 per the wave ruling ("the other five lists keep their current caps").
**Why:** The ruling is explicit. The old `maxLength` 500 had the same mismatch.
**Revisit if:** The owner agrees with the review. `BbyMaintainWidths` is 300 for Includes, Excludes, StackingExcludes and LoyGroups, and 10 for LoyTiers (spec 2396 flags tiers: "capped at 10 from a sandbox reading against a DDL of 500"). So a 301–500 character list now reads "under the cap" and is refused on save. Fix by changing those four entries to 300 and `loyTiers` to 10 in `ENGINE_LIST_MAX` (`editor.ts`), and their assertion in the cap test.

## Q: Does the client send the normalised list, or the raw text?
**Decision taken:** The normalised comma list, for all six bonus-buy lists (`toRequest`) and the coupon template origin filter (create and update). The box itself keeps the text as pasted.
**Why:** A pasted column survives even on a server without BackOffice 2400's `\r \n \t` separators, and it is byte-identical to what 2400 stores.
**Revisit if:** BackOffice wants the raw text.

## Note: a flaky step in 419's drive block
Step "28. Tested alone: Activate is offered" failed once in four runs. It reads `isEnabled()` straight after an uncheck, with no wait. The drive was 156/156 on the other three runs. I did not change it, because it is 419's block.

## Outstanding (not AFK-able)
- Owner walk: paste a 500-row Excel column of store codes into the origin filter, see 500 codes, and save. This needs a dev SIS.Api with BackOffice 2400 and 2403 (both OPEN). Until 2403, 500 codes (about 2500 characters) are past the 50 cap.
- The 3000 cap itself (gated on BackOffice 2403).
