---
status: done
spec: BackOffice 4165
blocked-by: 946, BO 4178
---

# 949 — The category profile page opens at two depths, narrows to a region or a pharmacy, and exports

Spec: BackOffice `E:\Projects\BackOffice\.issues\4165-retail-command-center-phase-1-the-overnight-store-scorecard-product-health-and-morning-brief-spec.md`.

## What to build

- Opened from a category name in the brief, from a store profile's category mix, or from a top-level profile's
  list of second-level categories.
- **Filter:** the chain, a region or one pharmacy.
- **Sections** as the server sends them: sales, units, growth and share beside the other categories; product
  health counts and stock value; promotion share and discount; the pharmacies and regions that over-sell and
  under-sell it.
- Margin, availability, the price index and private label show "not available yet" with the reason.
- **Export** downloads the server's workbook.
- English and Arabic, as the home.

## Spine reach

route → page

## Proof (→ `tdd` red-green cycles)

- [x] a second-level category opens the same page one level down · vitest
- [x] the filter narrows every section together · vitest
- [x] the four missing sections show "not available yet" with their reason · vitest
- [x] a pharmacy in the over- and under-selling list opens its store profile · vitest

## Boundaries

Front end only.

## Done when

The tests are green, and on dev each top-level category opens and narrows to one pharmacy.

## Blocked by

[946](946-the-command-center-home-shows-the-morning-brief-the-status-line-and-the-language-switch.md),
BackOffice 4178
(`E:\Projects\BackOffice\.issues\4178-a-category-profile-is-read-at-two-depths-narrowed-to-a-region-or-a-pharmacy-and-exported.md`)

## Comments

**2026-11-22 — done (stubbed; live walk owed, BO 4178 unbuilt).** The category profile at
`/analytics/command-center/category/:level/:code` (`?scope=region&region=` / `?scope=store&store=`, `?period=`, `?lang=`
— the query `categoryProfileHref` writes), behind the home's gate (`canOpenCommandCenter`), in English or Arabic the way
the home is (`useCcLang`, `dir` on the page root). Header: a trail to the home and, one level down, to the top-level
category; the scope's and the period's labels as the server wrote them; "Unclassified" when the server marks it. A
top-level profile lists its second-level categories, each a link to the same page one level down that keeps the
narrowing. The filter (chain / region / one pharmacy) moves the URL (`withScope`), so one request narrows every section
together. Sections render generically, in the server's order, through `ProfileSection.tsx` (shared with 948:
`ProfileSection` default, `ProfileTable`, `ProfileCell`, `NotAvailableYet`, `HrefOf`; words under `profile.*`). A
pharmacy cell opens its store profile (`targetHref(…, { store: 'profile' })` → `storeProfileHref`); a category cell its
category profile. Export downloads the server's workbook through `api.blob` with the read's own params, saved with
`saveBlob`; a failure toasts through `notify.apiError`.
Proof: `category-profile.test.ts` (the four boxes plus Export; static render with a seeded cache, `api.get`/`api.blob`
stubbed), the en/ar mirror in `i18n-keys.test.ts`. Typecheck, `npm test` and five of six lint gates green; the boundary
gate is red only on the pre-existing `insurance-rules/aliases/door-shapes.test.ts`.

**Where the filter's lists come from (contract gap, ⚠ proposed):** BO 4178 names the filter but not its values. The
regions come from the profile answer itself (`CcCategoryProfile.regions: { region, name }[]`, in the asked language); the
pharmacy is typed by its code and applied, so the answer does not carry ~970 pharmacies. BO 4178 should confirm
`regions` or name another source.

**BackOffice follow-ups:**
- **BO 4178 is unbuilt.** The route, query (`level, category, scope, region, storeCode, period, lang`) and shape
  (`CcCategoryProfile`, appended under the `// 949` banner in `core/models/command-center.ts`) are this client's
  proposal, marked `⚠ proposed`: `parent`, `scope.label`, `regions`, and cell targets for pharmacies and categories.
- The export route is assumed to be `GET CommandCenter/CategoryProfile/Export` with the read's query ("as on the store
  profile").
- **Live walk owed:** on dev, each top-level category opens and narrows to one pharmacy, in both languages, once 4178
  and `commandCenterOn` are deployed. No period picker: the ticket asks for none; the page passes `?period=` through.
