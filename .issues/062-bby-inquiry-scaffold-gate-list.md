---
status: done
spec: 061
blocked-by: —
---

# 062 — bonusBuyInquiryGatesAndListsActiveBonusBuysByDefault

## What to build

The tracer bullet: a new, permission-gated **BBY Inquiry** screen in the Pricing area that, on open,
lists the **currently-active** Bonus Buys in a minimal grid. This is the thinnest end-to-end run from
the `Bby/*` envelope to rendered rows, retiring the three biggest unknowns at once — the access gate,
the `Bby/List` envelope shape, and the AG-Grid wiring.

- **Feature scaffold** (feature-structure rule, 4 touch-points):
  `src/features/pricing/bonus-buy-inquiry/` with `BonusBuyInquiryPage.tsx` (default export) + `api.ts`;
  `src/locales/en/bonus-buy-inquiry.json` registered in `src/core/i18n.ts`; a lazy route
  `pricing/bonus-buy-inquiry` in `src/app/router.tsx`; a Pricing-group menu leaf in
  `src/layout/menu-model.ts` (label `bonus-buy-inquiry:menu.bbyInquiry`, lucide `Search`,
  `activePrefix: '/pricing/bonus-buy-inquiry'`).
- **Access gate** mirroring the sibling `bonus-buy-download`: `api.ts` exposes
  `access(): Promise<{ screenAllowed: boolean }>` calling **`GET Bby/Access`**; one shared
  `accessProbe` keyed `['bonus-buy-inquiry','access']` (`visible: r => r.screenAllowed === true`)
  drives both the nav-hide and the in-page denied card. **Fail open (screen shown)** while the probe
  is absent (404 / network) — the list endpoint's `403 ACCESS_DENIED` is the real boundary.
- **`Bby/List` default fetch**: on open, call `GET Bby/List` with `buildListParams({})` ⇒
  `{ activeOnly: true }` (no other params). Render `{ rows, capReached }` into a **minimal** AG-Grid
  (identity/number + description + status + validFrom, ~4 columns) newest-first, with a **loading**
  shimmer and a **no-results** empty state. Full 28-field grid, chips, search, export, and the modal
  are later slices.

`buildListParams` starts here as the pure params builder (empty-criteria branch); slice 064 completes it.

## Spine reach

model/api (`core/models/bonus-buy-inquiry`, `api.ts` `access()` + `list()`) · logic (pure
`buildListParams`) · component/route (`BonusBuyInquiryPage`, router entry, menu leaf, denied card) ·
i18n (new `bonus-buy-inquiry` namespace) · test (pure harness + app-drive).

## Proof (→ `tdd` red-green cycles)

- [x] `buildListParams` with empty criteria returns `{ activeOnly: true }` and nothing else · **pure** (in-memory harness, `node` native TS — 10/10, incl. number/date-range force `activeOnly:false`, half-open ranges, trim)
- [x] the screen renders active rows from a mocked `Bby/List` envelope; loading shows the shimmer, an empty `rows:[]` shows the empty state · **flow** — drove the real app (`tools/bby-inquiry-drive.mjs`, Playwright) against mocked `Bby/*` envelopes at `/pricing/bonus-buy-inquiry` (14/14: 2 rows render, identity number, active marker, `A`→Activated, date `2026-01-01`, empty state)
- [x] with the probe mocked 404 the screen is **shown**; with `screenAllowed:false` the menu leaf hides and the deep-link shows the denied card · **flow** — driven (404 → grid + leaf shown/fail-open; `screenAllowed:false` → denied card, no grid, leaf hidden)

## Boundaries

New endpoints **`GET Bby/Access`** and **`GET Bby/List`** (designed contracts, built later on SIS.Api —
runtime-blocked; handle `403 ACCESS_DENIED`). New i18n namespace `bonus-buy-inquiry`. Gated nav,
**fail-open** while `Bby/Access` 404s. Does **not** bootstrap the vitest runner (deferred).

## Done when

`/pricing/bonus-buy-inquiry` gates like its siblings (leaf + denied card, fail-open pre-build) and,
when allowed, lists active BBYs from a mocked `Bby/List` in a minimal grid with loading/empty states;
`buildListParams` empty-criteria harness green; `npm run typecheck` + `npm run build` green.

## Blocked by

None — can start immediately.
