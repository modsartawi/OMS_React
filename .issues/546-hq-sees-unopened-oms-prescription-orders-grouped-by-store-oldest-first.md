---
status: done
spec: C:\Work\DMSCO\BackOffice-2994\.issues\2994-prescription-session-spec.md
blocked-by: 545 (live: BackOffice 3015 on branch spec2994)
---

# 546 — HQ sees the unopened OMS prescription orders grouped by store, oldest first

## What to build

The **To open** tab of the HQ prescription-session screen (545's page; BackOffice spec 2994 story 70, hand-off in
`C:\Work\DMSCO\BackOffice-2994\.issues\3015-the-hq-list-and-close-without-invoice.md`).

- **Model** (core, beside 545's): `PrescriptionSessionHqToOpen { stores[], total, byUpload }`; a store
  `{ storeCode, count, oldestAgeDays, oldestOrderedAt, orders[] }`; an order `{ documentNo, documentType, sourceKind,
  documentSource, patientId, approvalNumber, orderedAt, ageDays }`.
- **Door** `GET PrescriptionSessionWeb/ToOpen?store` (`BackOfficeScreen[PrescriptionSessionHq, 03]`).
- **View:** one folded group per store, oldest first, each header showing the store, its count and its oldest age;
  unfolded, its orders (document no linking to the order's Details, type, source, a `BKOF` "bulk upload" marker from
  `documentSource`, patient id, approval number, ordered at, age). A store filter in the URL; `total` at the top.
- The per-store `orders` are capped across the whole read while `count` is exact — when a group lists fewer orders
  than its count, say so.
- **Group by store only.** `byUpload` is always `false` today (the NUPCO upload stamps no batch reference — 3015's
  recorded finding); don't build an upload grouping. If `byUpload` ever comes back `true`, ignore it until a ticket
  adds the batch reference.
- Bare 403 / `PSES-00223` as 545.

## Spine reach

model · api · logic (groups, capped-group notice) · tab · i18n EN + AR · test

## Proof (→ `tdd` red-green cycles)

- [x] group view: stores oldest first, the capped-group notice only when `orders.length < count`, the BKOF marker
      (vitest, pure)
- [x] drive script, LTR and RTL, against a stub: several stores, a capped group, an empty answer, the store filter,
      the link to an order's Details
- [x] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

- Door: BackOffice 3015, stubbed until 549. Read only — opening a session is the till's act, not the web's.
- Upload-batch grouping is a BackOffice follow-up (a batch reference on `SdDocumentHeader`), not built here.

## Done when

The Proof boxes are ticked: on the running app (stubbed), the To open tab lists each store's unopened prescription
orders, oldest first.

## Blocked by

- [545](545-hq-lists-open-prescription-sessions-across-stores-filters-them-and-opens-the-owed-list.md)

## Comments

**2026-10-24 — built (stubbed; live walk is 549).**

What was built:
- Model `PrescriptionSessionHqToOpen` / `…Store` / `…Order` appended to `core/models/prescription-session.ts`.
- `to-open.ts` (pure): `ToOpenFilter` ↔ URL (`tab=toOpen&store=…`, the tab key always written back) ↔
  `toOpenRequest` (`PrescriptionSessionWeb/ToOpen`, `store` only when set); `toOpenGroups` — stores oldest unopened
  order first (by `oldestOrderedAt`, then store code), each order's source word + `bulkUpload` (`documentSource` BKOF,
  trimmed, case-blind), `capped: { shown, count }` only when `orders.length < count`. `byUpload` is never read.
- `prescriptionSessionsApi.toOpen()` in `api.ts`; `ToOpenTab.tsx` replaces the placeholder: store field + Search /
  Reset, `total` at the top, one folded group per store (button `aria-expanded`; header = store, count, oldest age, each
  isolated), unfolded = the capped notice (when capped) + a table of the orders (order no → `/oms/document/{no}`, type,
  source + Bulk upload badge, patient id, approval number, ordered at, age). Bare 403 → 545's `Denied`.
- `toOpen.*` keys in `prescription-sessions` EN + AR (the placeholder key removed; AR has all six plural forms).

Judgement calls (overrulable):
- Plain table per group, not AG Grid: a handful of orders per store, folded by default; no sort/filter/export needed.
- Every group starts folded (ticket: "one folded group per store"); fold state is per visit, not in the URL.
- Stores are re-sorted client-side even though the server already sends them oldest first (the Proof asks for it).
- The store filter is a draft promoted by Search, like 545's bar; it filters the order's store only (no hint text).
- A failed read other than the bare 403 shows the usual `ErrorBanner`; no `PSES-00223` path (the door takes no filter
  it could refuse).
- The order link goes to Document Details (`/oms/document/…`) for every `documentType` — the door sends only orders.

Proof:
- vitest: `to-open.test.ts` 10 new; full suite 5957/5957.
- Drive `tools/prescription-sessions-to-open-drive.mjs` (`npx vite --port 5211 --strictPort`, then `DRIVE_PORT=5211
  node tools/prescription-sessions-to-open-drive.mjs`): **72/72** (LTR + RTL; RTL keeps `lng: 'en'`) — several stores
  out of order, folded/unfolded, isolates, BKOF marker, capped notice on one group only, `byUpload: true` ignored, store
  filter bar → address → wire + pasted address + Reset, empty answer, bare 403, the link opening Details. Stubbed door.
- `npm run typecheck`, `npm run lint` (4 gates) green.

Left for the integrator: 545's `tools/prescription-sessions-hq-drive.mjs` still waits on
`[data-ps-tab-placeholder="toOpen"]` (lines ~324/330), which this ticket removed; point those two checks at
`[data-ps-to-open]` (not edited here to avoid colliding with 547's edit of the neighbouring Ended lines).

### Review fixes (2026-10-24, branch `impl/review-fixes`)

- Search no longer asks twice: a changed store writes the address (new query key, fetches by itself); only an
  unchanged one `refetch()`es. To-open drive re-run 72/72.
