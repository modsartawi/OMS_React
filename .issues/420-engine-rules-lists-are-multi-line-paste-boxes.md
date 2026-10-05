---
status: done
spec: C:/Work/DMSCO/BackOffice/.issues/2396-an-oms-bonus-buy-is-tested-before-it-goes-live-and-authoring-scales-to-real-campaigns-spec.md
blocked-by: 417
---

# 420 — Engine Rules lists are multi-line paste boxes that keep a pasted Excel column whole

**Source:** BackOffice spec 2396.

## What to build

Today the six Engine Rules lists are single-line inputs, and a pasted Excel column loses its newlines (`1186⏎1188` becomes
`11861188`).

- All six lists (includes, excludes, origin filter, stacking excludes, loyalty groups, loyalty tiers) become **multi-line
  textareas**, and pasting keeps newlines and tabs.
- The client normalises the list the way the server does: `, ; |` space, newline and tab become commas, and the result is trimmed.
  It shows **how many codes** the box holds.
- `LIST_MAX.originFilter` becomes **3000**. ⚠ Ship that cap only with or after BackOffice 2403; until then keep 50.
- A coupon template's origin filter (`CouponDetailPane`) gets the same box, normaliser and cap.

## Spine reach

UI (Engine Rules tab, coupon detail) · pure normaliser

## Proof (→ `tdd` red-green cycles)

- [x] `a pasted column with CRLF, LF or tabs normalises to a comma list` · vitest (`src/core/util/code-list.test.ts`; `editor.test.ts` for the save body)
- [x] `the code count matches the normalised list` · vitest (`code-list.test.ts`, `editor.test.ts`)
- [x] `origin filter cap follows the shipped width` · vitest, at **50** (`editor.test.ts`, `coupons/helpers.test.ts`)
- [x] drive: `tools/bby-maintenance-drive.mjs` steps 37–41, **156/156 STUBBED**
- [ ] OWNER: paste a 500-row Excel column into the origin filter, see 500 codes, save (needs BackOffice 2400 + 2403 on a dev SIS.Api)
- [ ] the 3000 cap (deploy-gated on BackOffice 2403)

## Boundaries

The normaliser must match BackOffice 2400's separator set exactly. The 3000 cap is deploy-gated behind BackOffice 2403.

## Done when

The owner pastes a 500-row Excel column of store codes into the origin filter, sees 500 codes, and saves.

## Blocked by

417 (+ BackOffice 2400; BackOffice 2403 for the 3000 cap)

## Comments

**Built 2026-10-05 (AFK).** No new door. The normaliser is `src/core/util/code-list.ts` (`normaliseCodeList`, `codeListCount`,
`codeListMeter`). It lives in core because two features use it. It matches `BbyMaintainValidator.List` with 2400's separators:
split on `, ; |` space and CR, LF, tab, then trim, drop empties, join `,`, no de-duplication. Loyalty groups and tiers are upper-cased.

- `editor.ts`: `ENGINE_LISTS`, `ENGINE_LIST_MAX` and `engineListMeter`. `toRequest` sends every list normalised, so a pasted
  column is whole even before 2400 ships.
- `EngineRulesTab.tsx`: the six lists are `<textarea>`s with **no `maxLength`**, since a browser cap would cut a paste. Each shows
  its code count and its stored length against the cap. Past the cap it turns to the danger tone and says the server will refuse it.
  It does not block the save.
- Coupon template: the editable box is in `TemplatesWorkspace.tsx`. `CouponDetailPane` only displays the stored comma list and
  is unchanged. It gets the same box, count and cap (`TEMPLATE_ORIGIN_FILTER_MAX`, `coupons/helpers.ts`). Create and update
  send the normalised list.
- **Cap ruling:** the cap stays **50**. When BackOffice 2403 ships, flip `ORIGIN_FILTER_MAX` (`editor.ts`) and
  `TEMPLATE_ORIGIN_FILTER_MAX` (`coupons/helpers.ts`) to 3000, along with the two cap tests and drive steps 39/41.
  The other five lists keep their caps (500). The spec review notes the server is 300 (10 for tiers); that is logged for the owner in `.afk/HITL-420.md`.

**Proof:** vitest whole suite 3703/3703. Typecheck, lint (4 gates) and build are green. The drive is 156/156 STUBBED, with
block 37–41 added and a real clipboard paste of a 500-row CRLF column. One earlier step (419's step 28) failed once in four runs
on a wait-less `isEnabled()`. It was not changed and is noted in HITL.

**Outstanding:** the owner walk (BackOffice 2400 + 2403 on a dev SIS.Api) and the 3000 cap.
