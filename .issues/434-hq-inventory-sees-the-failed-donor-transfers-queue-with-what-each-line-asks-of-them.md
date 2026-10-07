---
status: open
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

- [ ] `failedLine` — the job label, the action sentence per case, the `canReRun` truth table (reverse-by-hand / non-FAILED / no outbox ID / no grant → false), and blank unset times · pure
- [ ] `keepsLine` — store matching is trimmed and case-insensitive; the date range; an unset attempt time always kept · pure
- [ ] `tools/failed-donor-transfers-drive.mjs` — load on open, the sentences, filters, both links, the leaf hidden without the flag, RTL · flow

## Boundaries

- A new read door, `SdDocumentWeb/FailedDonorTransfers` (BO-4, not filed), built on a stub.
- A new namespace, `failed-donor-transfers`.
- No re-run (435).

## Done when

The drive is green on the stub, and the gates are green.

## Blocked by

[431](431-an-hq-lead-lists-todays-donor-requests-across-stores-and-filters-them.md) (for the probe flags and the `?request=` seed)
