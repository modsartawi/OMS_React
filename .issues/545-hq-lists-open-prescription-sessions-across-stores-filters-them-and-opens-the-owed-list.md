---
status: open
spec: C:\Work\DMSCO\BackOffice-2994\.issues\2994-prescription-session-spec.md
blocked-by: 544 (live: BackOffice 3015 on branch spec2994)
---

# 545 — HQ lists open prescription sessions across stores, filters them, and opens the owed list

## What to build

The HQ prescription-session screen's first tab (BackOffice spec 2994 "The HQ list", stories 68–73; hand-off in
`C:\Work\DMSCO\BackOffice-2994\.issues\3015-the-hq-list-and-close-without-invoice.md` `## Comments` — "What was built",
"Judgement calls", "Deferred / hand-off"). Endpoints:
`C:\Work\DMSCO\BackOffice-2994\Services\SIS.Api\Endpoints\PrescriptionSessions\PrescriptionSessionWebEndpoints.cs`;
models `...\Modules\PrescriptionSessions\Models\PrescriptionSessionHqModels.cs`; codes
`...\Constants\PrescriptionSessionHqConstants.cs`.

- **New feature** `features/oms/prescription-sessions` at `/oms/prescription-sessions`, scaffolded with `/new-feature`
  (route, menu leaf in the OMS group, namespace `prescription-sessions` EN + AR registered in `core/i18n.ts`). One page
  with tabs **Open** (this ticket), **To open** (546) and **Ended** (547); the tab lives in the URL.
- **Model** in `core/models/prescription-session.ts` (544's file) — `PrescriptionSessionHqList { rows[], total, stalled,
  aboutToLapse, owed, isTruncated }` and the row: `sessionId, displayId, sourceKind, sourceKey, beneficiaryId,
  beneficiaryName, holdingStore, otherStore, otherStoreReason (DONOR|TRANSFER|null), state, route, orderNo, step,
  createdAt, ageDays, idleSince, idleDays, isStalled, isAboutToLapse, isOwed, lapsesAtEndOf, dispensedAt,
  invoiceOwedAt, openItems[], hasOpenItem`. `step` is 544's `PrescriptionSessionStep`.
- **Doors** `GET PrescriptionSessionWeb/Sessions?store&state&owner&source&minAgeDays&maxAgeDays&flag` and
  `GET PrescriptionSessionWeb/Sessions/Owed?store` (the saved "owed" filter: DISPENSED, not invoiced). Both
  `BackOfficeScreen[PrescriptionSessionHq, 03]`, cookie.
- **Grid** (spreads `OMS_GRID_BASE_COL_DEF`): display id, source + source key, beneficiary, holding store and the other
  store with its reason (donor / transfer), state, route, order no, the step label + owner (+ parked), age, idle days,
  lapses at end of, dispensed at, invoice owed at, open items. Rows come oldest idle first; keep the server's order as
  the default sort.
- **Filters in the URL:** store (matches the holding store OR the other store — say so in the field's hint), state,
  owner, source, age from / to. Three **flag chips** — Stalled, About to lapse, Owed — each with its count from the
  answer; a chip sets `flag`. An **Owed** saved view calls `Sessions/Owed` (store filter only).
- `isTruncated` → a notice that only the oldest-idle 2,000 of `total` are shown (counts are never truncated).
- **Refusals:** a bare 403 (`isBareDenial`) → a named "you don't hold the prescription-session list grant" page (no
  probe route exists); `PSES-00223` (bad filter) → the envelope message beside the filters.
- Codes (state, owner, route, source, other-store reason, open item kind, flags) read through 544's core words; add
  the HQ-only ones (other-store reason, open item kinds, flags) there too or in this namespace as fits.

## Spine reach

model · api · logic (filter ↔ query, flag chips, row view) · route + page + grid · menu · i18n EN + AR · test

## Proof (→ `tdd` red-green cycles)

- [ ] filter ↔ URL ↔ query: every filter round-trips; empty values drop; a flag chip sets `flag`; the Owed view
      sends only `store` to `Sessions/Owed` (vitest, pure)
- [ ] row view: other store + reason, parked step, lapse day only when about to lapse, open items; flag counts read
      from the answer, not counted from the rows (vitest, pure)
- [ ] drive script, LTR and RTL, against a stub: the list, each chip, the Owed view, a truncated answer, a bare 403,
      a `PSES-00223` refusal
- [ ] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

- New namespace `prescription-sessions`; new route + menu leaf, **no access probe** (none was built — the leaf shows
  to everyone and the page names the bare 403, as the campaign upload leaves do).
- Doors: BackOffice 3015 on `spec2994`, not merged / deployed — stubbed until 549. Seed
  `Modules/Authorizations/Sql/Seed-PrescriptionSessionHq-Authorization.sql` on OMS-HQ; nobody is bound yet.
- Read only here; the write-off is 548.
- Times local wall-clock, shown as is. Bidi per rule (beneficiary name `<bdi>`, ids / stores / numbers `Ltr`).

## Done when

The Proof boxes are ticked: on the running app (stubbed), HQ opens `/oms/prescription-sessions`, filters the open
sessions, uses the three flag chips and the Owed view, and a session without the grant sees the named denial.

## Blocked by

- [544](544-an-order-s-or-delivery-s-detail-shows-its-prescription-sessions-read-only.md) (core model + code words)

## Open questions

- Area: placed under `oms` (`/oms/prescription-sessions`), not a new area — the brief said "new HQ area", but the rule
  mints an area folder only with a new nav group / URL prefix. Overrulable.
