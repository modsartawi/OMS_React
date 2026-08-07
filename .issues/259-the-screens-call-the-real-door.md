---
status: open
spec: 249
blocked-by: 257, 258
---

# 259 — The screens call the real door

## What to build

**The wave-joining event.** Every fixture is swapped for a real call through `@/core/api` to the
`CollectionWeb` door, and the two waves meet for the first time.

⚠ **This is a verification, not a checkbox**, and it is why the ticket exists separately.
[245 §8](245-the-shape-of-a-print-ready-document.md) names it: the fixtures prove **rendering** and can
prove nothing else. They cannot prove the door exists, the grant filter admits the right session, the
cookie marker is present, or that `ar-SA` resolves on net8.0 under IIS rather than degrading to a
silent English `Thursday` on an Arabic form.

**What changes:** seven mocked calls become real ones —
`CollectionWeb/{Access,Collections,Receipt/{id},Acrs,AcrForm/{acrId},Deposits,Attempts}`. Nothing about
the screens or the documents changes shape; the fixtures stay in the repo as test data.

**Refusals, per [245 §7](245-the-shape-of-a-print-ready-document.md) and the `api-envelope` rule:**

| Code | Meaning | UI |
|---|---|---|
| `AcrNotFound` | unknown `acrId` — **reused**, no second code for the same fact | the print route's "this document no longer exists" state |
| `CollectionReceiptNotFound` | **new** — unknown id *or* zero rows (indistinguishable on a lookup over the inquiry) | same |

⚠ **Never a blank A4 sheet** — a blank sheet prints as convincingly as a real one, so a miss must be
unmistakably a miss. Branch on `apiErrorCode`, display with `apiErrorMessage`; never flatten an
`ApiError` into a bare `.message`.

⚠ **Empty is not a miss.** An ACR with no linked collections is a **200 with one page and `rows: []`**
— `Paginate`'s own behaviour. Only an unknown id refuses. Getting this backwards would turn an idle
ACR into an error screen.

**Three things to verify against live data that no fixture could catch:**

1. **Live data is not ordered or complete like the fixture.** `pages` is never empty but `rows` may
   be; `closedAtText`, `notes`, `pharmacistName` and `pharmacistId` are all legitimately `''`.
2. **Page order is the server's** — `OpenedAt` ascending, which decides which shift is `-1` on a
   multi-shift receipt. Confirm a real multi-shift receipt stamps `-1`/`-2` in shift order.
3. **The two culture-formatted strings actually arrived formatted** — `shiftDayName` as an Arabic
   weekday and `hijriText` as an Umm al-Qura date. ⚠ If globalization degraded, the failure is **not a
   crash**: it is `Thursday` quietly appearing on an Arabic form. Look at them.

**And the standing boundary, worth re-reading before this ticket rather than after:** if a string
needed on screen is not on the wire, **the answer is a server change, not a client one**. No
`toFixed`, no `Intl.NumberFormat`, no date formatting, no tafqeet, no page chunking, no deriving the
match mark. The temptation is highest here, when live data reveals a gap and the fixture had papered
over it.

## Spine reach

api · logic (error branching) · component (miss state) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `tools/collection-drive.mjs` and `tools/collection-print-drive.mjs` run **green against a live
      SIS.Api**, not the fixtures — all four screens load, both documents render, the access probe
      drives the menu · flow (Playwright)
- [ ] A **hand-typed unknown** `acrId` and `collectionReceiptId` each render the "no longer exists"
      state — ⚠ assert the sheet is **not blank**, since that is the failure mode that ships silently ·
      flow (Playwright)
- [ ] An ACR with **no linked collections** renders one page with no rows and totals `0.00` — a
      success, not a refusal · flow (Playwright)
- [ ] A **real multi-shift receipt** prints its pages stamped `-1`/`-2` in `OpenedAt` order · manual,
      recorded in the ticket
- [ ] `shiftDayName` and `hijriText` render **Arabic**, not `Thursday` and not a Gregorian date ·
      manual, recorded in the ticket

## Boundaries

- **Depends on the entire backend wave** —
  [1089](file:///C:/Work/DMSCO/BackOffice/.issues/1089-a-collection-receipt-has-an-identity-on-the-wire.md),
  [1090](file:///C:/Work/DMSCO/BackOffice/.issues/1090-a-browser-reaches-the-four-collection-inquiries.md),
  [1091](file:///C:/Work/DMSCO/BackOffice/.issues/1091-the-receipt-door-stamps-a-multi-shift-receipt-as-a-set.md),
  [1092](file:///C:/Work/DMSCO/BackOffice/.issues/1092-the-acr-builder-speaks-the-signed-off-form.md),
  [1093](file:///C:/Work/DMSCO/BackOffice/.issues/1093-the-acr-door-hands-over-pages.md). It cannot
  start until they are deployed somewhere reachable.
- Needs a **live SIS.Api** and a session holding the four grants. ⚠ Until 1090 lands, every route
  answers a browser **403** — a deliberate 403 rather than a 401, so a missed cookie marker breaks one
  screen instead of logging the whole tab out. A 403 here means the marker is missing, not that the
  grant is.
- New envelope code to handle: `CollectionReceiptNotFound`. `AcrNotFound` already exists server-side.
- The fixtures **stay** in the repo as test data — they are test-pinned transcriptions of the fidelity
  inventory and remain the drives' input.

## Done when

All four screens and both documents run against the real door with the real grants; misses show the
refusal state and never a blank sheet; an empty ACR is a success; a real multi-shift receipt stamps in
shift order; both culture-formatted strings arrive in Arabic; the drives are green against live.

## Blocked by

- [257](257-a-row-opens-its-document.md) — the whole client surface must exist before it is joined.
- [258](258-the-export-writes-a-summable-file.md) — likewise.
- The backend wave, in `C:\Work\DMSCO\BackOffice\.issues\` (1089–1093).

## Open questions

- **Where does the frontend point at a deployed SIS.Api carrying the new door?** Dev proxies `/api` to
  `:5111`; whoever runs this ticket needs the backend wave running locally or on a shared box, and a
  session holding the four grants. Settle this before starting rather than discovering it mid-ticket.
