---
status: done
spec: C:\Work\DMSCO\BackOffice-2994\.issues\2994-prescription-session-spec.md
blocked-by: 545 (live: BackOffice 3015 + 3014 on branch spec2994)
---

# 547 — HQ searches ended prescription sessions by date and reads their sales and after-close events

## What to build

The **Ended** tab of the HQ prescription-session screen (545's page; BackOffice spec 2994 story 71, hand-offs in
`C:\Work\DMSCO\BackOffice-2994\.issues\3015-the-hq-list-and-close-without-invoice.md` and
`...\3014-after-close-events-and-re-sales.md`).

- **Model** (core): an ended row `{ sessionId, displayId, sourceKind, holdingStore, state, route, createdAt,
  dispensedAt, endedAt, endedBy, endReason, endNote, invoiceOwedAt, saleNos[], wasInvoiced, afterClose[] }`;
  `afterClose` is 544's `PrescriptionSessionAfterClose`.
- **Door** `GET PrescriptionSessionWeb/Ended?from&to&store&state` (`BackOfficeScreen[PrescriptionSessionHq, 03]`).
- **Search:** from / to (default: the last 7 days; the server's widest range is 92 days — check it client-side before
  sending), store, state (CLOSED, ABANDONED, WRITTEN_OFF). All in the URL.
- **Rows:** display id, source, holding store, state, route, created / dispensed / ended at, ended by, the end reason
  in words (abandon reasons INVALID, REJECTED, PATIENT_WITHDREW, DUPLICATE, LAPSED; write-off reasons PAYER_REFUSED,
  SALE_LOST, GOODS_NEVER_LEFT, OTHER) + note, "was owed" when `invoiceOwedAt` is set, the sales (or "never invoiced"
  when `saleNos` is empty), and under each row its after-close lines — the **same** core lines 544 renders on Details.
- Bare 403 / `PSES-00223` (a reversed or missing range) as 545.

## Spine reach

model · api · logic (range check, end-reason words, row view) · tab · i18n EN + AR · test

## Proof (→ `tdd` red-green cycles)

- [x] range: default range, a reversed range and one wider than 92 days refused before sending; filters round-trip
      the URL (vitest, pure)
- [x] row view: every end reason has words, an unknown one renders itself; never invoiced vs its sales; was owed;
      after-close lines reuse 544's (vitest, pure)
- [x] drive script, LTR and RTL, against a stub: a closed session with a return and a re-sale, an abandoned one, a
      written-off one with an Arabic note, an empty answer
- [x] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

- Door: BackOffice 3015 (+ 3014's after-close array, SQL 019), stubbed until 549. Read only.
- End reasons share the core words with 548's write-off dialog — add them to core, not twice.

## Done when

The Proof boxes are ticked: on the running app (stubbed), HQ searches ended sessions over a date range and reads each
one's end, sales and after-close events.

## Blocked by

- [545](545-hq-lists-open-prescription-sessions-across-stores-filters-them-and-opens-the-owed-list.md)

## Comments

**2026-10-24 — built (stubbed; live walk is 549).**

What was built:
- Model `PrescriptionSessionHqEndedRow` appended to `core/models/prescription-session.ts` (`afterClose` is 544's
  `PrescriptionSessionAfterClose`).
- **End-reason words in core** (`core/prescription-session/words.ts`, `prescription-session` EN + AR) — **548 uses
  these, does not add its own:** `WRITE_OFF_REASONS` (`PAYER_REFUSED, SALE_LOST, GOODS_NEVER_LEFT, OTHER`, server
  order) + type `PrescriptionWriteOffReason` + `writeOffReasonWord` → keys `writeOffReason.*`; `ABANDON_REASONS` +
  `PrescriptionAbandonReason` + `abandonReasonWord` → `abandonReason.*`; `endReasonWord(state, reason)` (own state's
  list first, then either; unknown → itself; blank → `null`).
- `ended-filter.ts` — `EndedFilter {from,to,store,state}` ↔ URL (always `tab=ended`), `defaultEndedFilter(today)`
  (last 7 days, today included), `endedRangeProblem` (`missing | reversed | tooWide`, mirroring the server's
  `(to − from).Days >= 92`), `endedRequest`, `ENDED_STATES`, `ENDED_ROW_CAP`.
- `ended-row.ts` — `endedRow` (state/source/route words, end reason + note, was owed, sales / never invoiced,
  after-close via 544's `afterCloseLine`).
- `prescriptionSessionsApi.ended()` in `api.ts`; `EndedTab.tsx` body replaced (reuses `Denied.tsx`); `ended.*` keys in
  `prescription-sessions` EN + AR (`ended.placeholder` removed).
- 545's drive now waits for `[data-ps-ended]` instead of the Ended placeholder (one line).

Judgement calls (overrulable):
- **Not a grid**: a plain table with one follow-up row per session holding its after-close lines (544's
  `AfterCloseText`), since AG Grid Community has no detail rows. No column sorting; server order (earliest ended first).
- An address without dates reads as the last 7 days of the reader's day; dates reach the address only on Search /
  Reset. A bad date or a non-end state in a pasted address reads as the default. A pasted bad range keeps its dates,
  asks nothing and says why.
- The range is checked on Search before the address is written; the server's `PSES-00223` stays a backstop shown
  beside the filters as in 545.
- The door returns a bare list capped at 2,000 with no flag: at exactly 2,000 rows a notice says only the first
  2,000 to end are shown.
- "Never invoiced" is read from `saleNos` being empty (the fact `wasInvoiced` is derived from), not the flag.
- "Was owed" is a warn badge beside the sales; ended by is free text (`<bdi>`); the store filter is labelled
  "Holding store" (this door matches the holding store only, unlike Open).

Proof:
- vitest: `ended-filter.test.ts` 14, `ended-row.test.ts` 10, `core/prescription-session/end-reason-words.test.ts` 5 =
  29 new; full suite 5976/5976.
- Drive `tools/prescription-sessions-ended-drive.mjs` (`npx vite --port 5214 --strictPort`, then
  `DRIVE_PORT=5214 node tools/prescription-sessions-ended-drive.mjs`): **74/74** (LTR + RTL) — default range on the
  wire, closed with return + re-sale, abandoned, written off with an Arabic note, isolation, filters round-trip,
  reversed / 93-day refused before sending (92 sent), pasted reversed, empty, bare 403, `PSES-00223`. 545's drive
  re-run 112/112.
- `npm run typecheck`, `npm run lint` (4 gates) green.
