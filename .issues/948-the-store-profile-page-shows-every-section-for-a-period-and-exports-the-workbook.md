---
status: done
spec: BackOffice 4165
blocked-by: 947, BO 4177
---

# 948 — The store profile page shows every section for a period and exports the workbook

Spec: BackOffice `E:\Projects\BackOffice\.issues\4165-retail-command-center-phase-1-the-overnight-store-scorecard-product-health-and-morning-brief-spec.md`.

## What to build

- Opened from the scorecard panel, a scorecard list or a link.
- **Period:** the rolling 4 weeks with last year beside them by default; year-to-date; or dates.
- **Sections** as the server sends them: headline and peers; mix by category, payer type and private label; by
  month, weekday and hour; basket shape; customers; discounts; sales by insurer and credit customer; the full
  product list; observations as sentences.
- Every money figure is labelled "incl. VAT". A section the server marks "not available yet" says so with its reason.
- The category mix links to the category profile, already filtered to this pharmacy.
- **Export** downloads the server's workbook for the same pharmacy and period.
- English and Arabic, as the home.

## Spine reach

route → page

## Proof (→ `tdd` red-green cycles)

- [x] the page opens on the rolling 4 weeks and a period change asks the server again · vitest
- [x] a not-available-yet section shows its reason · vitest
- [x] the category mix links to the category profile filtered to the pharmacy · vitest
- [x] Export asks for the same pharmacy and period · vitest

## Boundaries

Front end only.

## Done when

The tests are green, and on dev one pharmacy's profile opens from the map and exports.

## Blocked by

[947](947-the-kingdom-map-shades-the-regions-shows-each-pharmacy-as-a-point-and-opens-a-pharmacys-sco.md),
BackOffice 4177
(`E:\Projects\BackOffice\.issues\4177-a-store-profile-is-read-for-a-period-and-exported-as-a-workbook.md`)

## Comments

**2026-11-22 — done (stubbed; live walk owed, BO 4177 unbuilt).** The store profile at
`/analytics/command-center/store/:storeCode` (`?period=ytd` / `?period=dates&from=&to=`, `?lang=` — the query
`storeProfileHref` writes, so 947's "Open the store profile" link lands on it), behind the home's gate
(`canOpenCommandCenter`), in English or Arabic the way the home is (`useCcLang`, `dir` on the page root). Header: a trail
to the home, the pharmacy's title as one machine-led pair (`Ltr`), the period's label as the server wrote it with its
range and last year's range beside it. `PeriodPicker.tsx` (core `Chip`s; for dates two core date `Input`s and Apply,
enabled once both ends are typed and in order) moves the URL (`withPeriod`); the URL is the request, so a change asks the
server again under its own query key. A URL naming no period, an unknown one, or dates missing an end opens on the
rolling 4 weeks, and the server is asked for `period=rolling4` by name. Sections render through 949's `ProfileSection`
in the server's order (money columns footnoted "include VAT", the 80% cut, observations as sentences, "Not available
yet" with the reason). A category cell opens the category profile already narrowed to this pharmacy
(`storeTargetHref` → `categoryProfileHref({…, scope: { kind: 'store', storeCode } })`, unless the server names a
narrowing); a pharmacy cell its own store profile. Export downloads the server's workbook through `api.blob` with the
read's own params (`storeProfileParams`), saved with `saveBlob`; a failure toasts through `notify.apiError`.
Proof: `store-profile.test.ts` (the four boxes; static render with a seeded cache, `api.get`/`api.blob` stubbed), the
en/ar mirror in `i18n-keys.test.ts`. The second box went green on its first run: the not-available rendering is 949's
shared `ProfileSection`, so that cycle pins the reuse rather than drives new code. Typecheck, `npm test` and five of six
lint gates green; the boundary gate is red only on the pre-existing `insurance-rules/aliases/door-shapes.test.ts`.

**BackOffice follow-ups:**
- **BO 4177 is unbuilt.** The route `GET CommandCenter/StoreProfile`, its query (`storeCode, period, from, to, lang`)
  and shape (`CcStoreProfile`, appended under the `// 948` banner in `core/models/command-center.ts`) are this client's
  proposal; `title` is marked `⚠ proposed`, and the sections use 946's shared (proposed) `CcProfileSection`. The export
  is assumed to be `GET CommandCenter/StoreProfile/Export` with the read's query.
- **The custom date range has no stated maximum.** BO 4177 names "dates" but no longest window and no refusal code;
  the product list is ~3,700 rows for 4 weeks against the door's 10,000-row cap. The page sends whatever two dates are
  typed and shows the server's refusal as the load failure. BO 4177 should state a maximum (and a code), and the picker
  can then cap it.
- **Live walk owed:** on dev, one pharmacy's profile opens from the map's scorecard panel and exports, in both
  languages, once 4177 and `commandCenterOn` are deployed.
