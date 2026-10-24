---
status: open
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

- [ ] group view: stores oldest first, the capped-group notice only when `orders.length < count`, the BKOF marker
      (vitest, pure)
- [ ] drive script, LTR and RTL, against a stub: several stores, a capped group, an empty answer, the store filter,
      the link to an order's Details
- [ ] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

- Door: BackOffice 3015, stubbed until 549. Read only — opening a session is the till's act, not the web's.
- Upload-batch grouping is a BackOffice follow-up (a batch reference on `SdDocumentHeader`), not built here.

## Done when

The Proof boxes are ticked: on the running app (stubbed), the To open tab lists each store's unopened prescription
orders, oldest first.

## Blocked by

- [545](545-hq-lists-open-prescription-sessions-across-stores-filters-them-and-opens-the-owed-list.md)
