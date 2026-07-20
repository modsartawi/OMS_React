---
status: done
spec: 061
blocked-by: 062
---

# 064 — searchingByNumberOrDateClearsActiveOnlyAndFiltersByValidityOverlap

## What to build

The search toolbar that reaches beyond the active default to **all** BBYs, plus the search-side result
states.

- **Toolbar**: exact **BBY-number** field · **"active during"** from/to date pickers · an **Active
  only** toggle (default **on**, sublabel "status A & valid today") · a dismissable **"filtered"** chip
  · **Reset**. Fields AND together (server-side).
- **The `buildListParams` rule (completes the pure module from 062):** empty criteria ⇒
  `{ activeOnly: true }`; a non-empty **number or date range** forces `activeOnly: false` (a keyed/date
  lookup must find inactive/deleted BBYs); dates pass through as raw `yyyyMMdd` for **validity-overlap**
  (`ValidFrom ≤ validTo AND ValidTo ≥ validFrom`, half-open when one bound absent). The client owns this
  UX rule; the endpoint stays a pure function of its params.

  ```ts
  // decision shape (from spec 061 / ticket 057)
  buildListParams({ bbyNumber, validFrom, validTo, activeOnly }) → {
    bbyNumber?, validFrom?, validTo?,
    activeOnly: (bbyNumber || validFrom || validTo) ? false : activeOnly,
  }   // '' / undefined dropped downstream by buildQuery
  ```
- Issuing **Search** re-queries `Bby/List` with the built params, shows the "filtered" chip; **Reset**
  restores the active-only default and clears criteria.
- **Search-side states**: the **cap-reached** amber banner ("first 1,000, newest first — narrow your
  search") when `capReached`, and **business-error** surfacing for malformed/reversed dates
  (`INVALID_DATE_FORMAT` / `INVALID_DATE_RANGE`) via `apiErrorMessage`/`apiErrorCode` — never a bare
  `.message` (api-envelope rule).

## Spine reach

logic (pure `buildListParams` — all branches) · component (toolbar, chip, reset, cap banner, error
surface) · i18n (field labels, toggle sublabel, chip, banner, error copy) · test (pure harness +
app-drive).

## Proof (→ `tdd` red-green cycles)

- [x] `buildListParams` forces `activeOnly:false` when a number **or** either date is present, keeps `true` only for empty criteria, and passes half-open ranges through · **pure** (in-memory node/TS harness — 8/8: empty⇒{activeOnly:true}, number/validFrom/validTo each force false, both-dates + number AND together passthrough, whitespace trims to default)
- [x] searching shows the filtered chip and cap banner (mocked `capReached:true`); Reset returns to the active default · **flow** — drove real app (`tools/bby-inquiry-drive.mjs`, mocked `Bby/*`) 35/35: Search sends `activeOnly=false&bbyNumber=…`, Filtered chip + amber cap banner appear, Reset restores `activeOnly=true` (chip + banner gone)
- [x] a mocked `400 INVALID_DATE_RANGE` envelope surfaces the server message + code, not "unexpected" · **flow** — drove it: ErrorBanner shows the server message ("End date is before start date.") under a code-driven "Check the dates" title (`apiErrorCode` branch), never "unexpected"

## Boundaries

Reuses `Bby/List` (handle `400 INVALID_DATE_FORMAT`/`INVALID_DATE_RANGE`). New i18n keys. No new
endpoint, no vitest bootstrap. Can run in parallel with 063 (both blocked only by 062).

## Done when

Number/date search auto-clears Active-only and filters by validity overlap, the filtered chip + Reset
work, cap banner and date-error messages show; `buildListParams` full-branch harness green; typecheck +
build green.

## Blocked by

[062](062-bby-inquiry-scaffold-gate-list.md)
