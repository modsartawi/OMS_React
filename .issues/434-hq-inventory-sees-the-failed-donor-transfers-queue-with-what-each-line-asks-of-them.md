---
status: done
spec: 430
blocked-by: 431
---

# 434 — HQ inventory sees the failed donor transfers queue with what each line asks of them

## What to build

This is the WPF *Failed donor transfers* work queue, read side (spec 430 D5, D12).

- **Leaf and route.** The "Failed donor transfers" leaf is gated on `canOpenFailedTransfers`. The
  route is `/oms/failed-donor-transfers`, with a page guard. It sits second in the D18 order.
- **Loading.** The screen loads `GET SdDocumentWeb/FailedDonorTransfers` on open (it is a work
  queue). Rows are `FailedDonorTransferRow`, and the model goes in `@/core/models`. A Reload action
  reads it again.
- **The line model** is a pure module lifted from WPF `FailedDonorTransferLine`:
  - **Job label.** FAILED → failed, PENDING → retrying, COMPLETED → completed, anything else → the
    raw status.
  - **Action sentence:**
    - reverse-by-hand: "Reverse STO {sto} in DRS"
    - re-runnable: "Re-run once the cause is fixed"
    - otherwise: "Retrying on its own"
  - **Times.** An unset time (`0001-…`) is blank.
  - **`canReRun`** is computed here (the D12 truth table, including the grant), but no action is
    drawn yet (435).
- **The grid.** It has the WPF columns: action, request, delivery, donor store, order store,
  request state, job, attempts, last attempt, deadline, STO, reverse by hand, and DRS's last error
  (free text, `<bdi>`).
- **Client-side filters** on the loaded lines: donor store, order store (both trimmed and
  case-insensitive), and a last-attempt date range. A line with no attempt time is **never** hidden
  by the date filter.
- **Links.** The request opens `/oms/donor-requests?request=<no>` (431's seed). The delivery opens
  Document Details.

## Spine reach

model/api · logic (line model, filter) · component/route/menu · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `failedLine` — the job label, the action sentence per case, the `canReRun` truth table (reverse-by-hand / non-FAILED / no outbox ID / no grant → false), and blank unset times · pure
- [x] `keepsLine` — store matching is trimmed and case-insensitive; the date range; an unset attempt time always kept · pure
- [x] `tools/failed-donor-transfers-drive.mjs` — load on open, the sentences, filters, both links, the leaf hidden without the flag, RTL · flow

## Boundaries

- A new read door, `SdDocumentWeb/FailedDonorTransfers` (BO-4, not filed), built on a stub.
- A new namespace, `failed-donor-transfers`.
- No re-run (435).

## Done when

The drive is green on the stub, and the gates are green.

## Blocked by

[431](431-an-hq-lead-lists-todays-donor-requests-across-stores-and-filters-them.md) (for the probe flags and the `?request=` seed)

## Comments

**Done 2026-10-07 (AFK).** Built on a STUB of spec 430 D2/D5. The door
`SdDocumentWeb/FailedDonorTransfers` (BO-4, not filed) is NOT built, so nothing was driven against
a live SIS.Api.

- **Proof:**
  - vitest `failed-donor-transfers/failed-line.test.ts`:
    - the job label (WPF letters and D12 words, a raw unknown status)
    - the action sentence per case
    - the `canReRun` truth table (reverse-by-hand, retrying, completed, unknown, no/blank/null outbox ID, no grant → false)
    - blank unset/absent/unreadable times
    - the request state
  - vitest `filter.test.ts`:
    - stores trimmed and case-insensitive, whole-value match
    - the inclusive last-attempt day range
    - an unset attempt time always kept by the dates (never by the stores)
    - the reversed-range check
  - `core/oms/access.test.ts` and `layout/menu-model.test.ts` gained the reader and the D18 position.
  - Full suite: 217 files, 4010 tests green.
  - Drive `tools/failed-donor-transfers-drive.mjs`: 66/66 in LTR and RTL (stubbed).
    - Leaf and denied card: without the flag the leaf is hidden and the URL shows the denied card with no queue call. The leaf sits between Donor requests and Document payments. One probe call.
    - The queue loads on open, once.
    - The sentences: re-run, retrying, "Reverse STO … in DRS" with the STO isolated, a raw unknown job, blank unset times.
    - Isolation: links, stores and counts isolated, DRS's error in `<bdi>`.
    - No Re-run drawn, even for a grant holder.
    - Filters: the store and date filters, with the undated line kept. The "n / m" status bar. The reversed-range note. The no-match empty state.
    - Reload. A failed reload keeps the last good list.
    - Links: the request link seeds Donor requests (`requestNo`, no date bound), and the delivery link lands on Document Details.
    - A refused first load is shown with its own message.
  - typecheck, lint (4 gates) and build are green.
- **Model:** `@/core/models/failed-donor-transfer.ts` is 2371's `FailedDonorTransferRow`, camelCase, with nothing added.
- **Reader:** `canOpenFailedTransfers` is in `@/core/oms/access` (no new flag, no second probe). `canReRun` is computed per line from `canReRunFailedTransfer`, ready for 435.
- **Rulings** logged in `.afk/HITL-434.md`:
  - both status spellings are read
  - the sentence does not hang on the grant
  - the WPF "otherwise retrying" fallthrough is kept
  - a reverse-by-hand line with no STO gets a sentence of its own
  - a reversed range is noted
  - the free-text tooltip stays raw (wave convention)

**Outstanding (not AFK's):**
- a live walk against a real SIS.Api once BO-4 exists (which status spelling arrives, and whether `0001-…` times do)
- the owner's eye on the Arabic strings (`src/locales/ar/failed-donor-transfers.json`) under RTL
- the owner rulings in `.afk/HITL-434.md`
