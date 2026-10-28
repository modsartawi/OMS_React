---
status: done
spec: BackOffice 3157 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md)
blocked-by: 607
---

# 619 — The IDF masters list shows each master's kind, scope, live version and thresholds

## What to build

**Slice 0 (tracer).** A new leaf **IDF masters** in the existing Insurance rules nav group, at
`/insurance-rules/idf/masters`. It lists every IDF priority master from `GET IdfPriority/masters` (doors from
BackOffice 3161; shapes in the [brief](C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md)):

- kind (insurer | store), with the payer code for an insurer master and the store list for a store master (an
  insurer master scoped to a store list shows both);
- the name in the reader's language (`nameEn` / `nameAr`);
- thresholds read as "hard above N, reminder above M";
- the live version: number, by, at (local wall-clock, no `Z`), note. A master with no live version yet says so.

This slice lays the feature out once for 620–627: one feature folder `features/insurance-rules/idf/` (a tight
cluster of screens that all read the masters), its model types in the feature, the namespace `insurance-idf`
(EN + AR mirrored, registered under a new slot in `core/insurance-rules/locales.ts`), the route under a new slot in
`app/insurance-rules-routes.tsx` and the leaf under a new slot in `layout/menu-insurance-rules.ts`. IDF paths live
under `/insurance-rules/idf/*` because `/insurance-rules/exceptions` is already 614's guard exceptions.

## Spine reach

model/api · logic (name by language, threshold sentence) · component/route · i18n (EN+AR) · test + drive

## Proof (→ `tdd` red-green cycles)

- [x] `idf master row reads its scope and thresholds` — insurer / store / insurer+list rows, names by language, defaults 4 and 1 · pure
- [x] `insurance-idf keys mirror EN and AR` — the area's i18n-keys test pattern · pure
- [x] drive `tools/idf-masters-drive.mjs` — stubbed `IdfPriority/masters`: leaf lit, grid rows, AR render, a bare 403 shows "no access" · flow

## Boundaries

- New endpoint `GET IdfPriority/masters` (3161) — **stubbed**; nothing is built on the BackOffice side yet.
- New namespace `insurance-idf` (EN + AR).
- **Ungated** like the rest of the group until 628: a bare 403 shows the page's own "no access" state.
- Builds on the 3126 area (607), which today exists only on `spec/3126-insurance-rules` (worktree
  `oms-react-spec3126`) — build there or after it merges to main.
- Bidi: version number, thresholds, payer code and dates are machine values (`Ltr` / grid base); names are free text.

## Done when

The IDF masters leaf opens from the Insurance rules group and lists the stubbed masters in EN and AR, the tests
above green, `npm run typecheck` + `npm run lint` clean.

## Blocked by

[607](607-the-insurance-rules-area-lists-guard-rules-by-folder-with-their-flags-and-opens-a-rule-rea.md) (the area; done on `spec/3126-insurance-rules`)

## Comments

**2026-10-27 — built (impl/3157-619).** `features/insurance-rules/idf/`: `masters.ts` (types + `masterRow`: scope,
name by language with an English fallback when `nameAr` is blank, thresholds defaulting 4 / 1, live version or
null), `api.ts` (`IdfPriority/masters`, keys under `IDF_KEY = [...INSURANCE_RULES_KEY, 'idf']`), `MastersPage.tsx`
(plain table like the area's other lists; payer, store list, version, thresholds and by · at in `Ltr`; name and note
in `<bdi>`; a bare 403 → `DeniedCard`). Namespace `insurance-idf` (EN + AR) registered under a 619 slot in
`core/insurance-rules/locales.ts`; route `idf` → `idf/masters`; menu leaf `menu.idfMasters`. Proof: `masters.test.ts`
4/4, `i18n-keys.test.ts` 9/9, drive `tools/idf-masters-drive.mjs` 38/38 STUBBED (LTR + RTL); typecheck, test
(6934), lint green.

Decisions for 620–627 (overrulable):
- **Slots.** Per-ticket slot comments in `app/insurance-rules-routes.tsx`, `layout/menu-insurance-rules.ts` (and its
  icon imports), `features/insurance-rules/idf/api.ts` and `tools/idf-stubs.mjs` (`idfStub` chains each slice's
  `…Stub`). ONE namespace `insurance-idf` with a top-level object per leaf: `masters`, `storeLists`, `masterForm`,
  `upload`, `versions`, `exceptions`, `lookup`, `events`, `report` (empty until their ticket), plus `access`.
- **Menu labels pre-laid** in `insurance-rules.json` (EN + AR): `menu.idfMasters`, `idfStoreLists`, `idfExceptions`,
  `idfLookup`, `idfEvents`, so later leaves never touch the area bundle.
- **One file per leaf** beside `masters.ts` for types/logic (`store-lists.ts`, `master-form.ts`, `upload.ts`,
  `versions.ts`, `exceptions.ts`, `lookup.ts`, `events.ts`, `swap-report.ts`), each leaf its own page file.
- **IDF stubs** live in their own `tools/idf-stubs.mjs` (re-exports `envelope`; `bare403` = empty-body 403 like the
  area's), not in the large `insurance-rules-stubs.mjs`.
- **Store list shown as its id** (`storeListId`, `Ltr`): the masters door sends no list name; 620's lists could name
  it later.
- **The RTL pass reads English words**: the app's `lng` stays `en` (Arabic not switched on), `oms.locale=ar` only
  mirrors the page — the house pattern. The Arabic bundle and Arabic names are proven by the pure tests.

