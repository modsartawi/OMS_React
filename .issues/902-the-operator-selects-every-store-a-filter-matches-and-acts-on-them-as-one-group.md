---
status: done
spec: BackOffice 3913
blocked-by: 900, BO 3916, BO 3917
---

# 902 — The operator selects every store a filter matches and acts on them as one group

## What to build

BackOffice spec 3913, "Select all matching" (doors: BackOffice 3917's `GET ActionSync/Fleet/Codes` and
`closedNotDisabled`, BackOffice 3916's `POST ActionSync/Stores/Control/Bulk`).

- **"Select all matching".** A button on the Fleet page selects every code the current filter matches, past the 50 cap,
  by reading `Fleet/Codes` with the same filter. The 50 cap still applies to clicking rows one by one.
- **Routing.** A selection over 50 sends its bulk-bar action (Pause, Resume, Disable in the normal view; Enable in the
  disabled view) through the **bulk door**. A selection of 50 or fewer keeps today's door.
- **Results.** The per-store results list the refusals with their codes (`DISABLED` included), as `ControlResults` does
  today.
- **"Closed, not disabled" tile.** A new tile filters on `closedNotDisabled`. The intended use: that tile → select all
  matching → Disable.
- **Audit.** Rows sharing a `batchId` are grouped as one event, with the chunk count.
- Both languages for every new string.

## Spine reach

UI (Fleet page, selection helpers, bulk routing, audit page)

## Proof (→ `tdd` red-green cycles)

- [x] `selectAllMatching_takesEveryCode_uncapped` · control-helpers.test.ts
- [x] `controlRoute_over50_usesBulkDoor_else50Door` · control-helpers.test.ts
- [x] `auditGrouping_byBatchId` · control-helpers.test.ts
- [x] `tiles_includeClosedNotDisabled` · helpers.test.ts

## Boundaries

—

## Done when

The proofs are green, and a staging walk shows: the "Closed, not disabled" tile → select all → Disable on more than 50
stores lands as one batch.

## Blocked by

900, BackOffice 3916, BackOffice 3917

## Comments

**2026-11-16, implementer (branch `ticket/3913-902`, worktree `C:\Playground\oms-react-t902`), commits `cc0ded8e`
(the slice), `8fbec998` (merge of `spec/3913-disabled-stores` tip `7f476d8e`, with 901 and 904), `072ca59f` (drive
stubs 901's preview).** Built against stubs: BackOffice 3916/3917 are unbuilt and the 2523 contract is not amended,
so the shapes come from 3913/3916/3917.

- **Select all matching** (Fleet bulk bar, `data-select-all`): reads `GET ActionSync/Fleet/Codes` with the table's
  filter (`fleetCodesQuery`: tiles, host, q, `disabled=only`; no sort/page) and replaces the selection with every
  code (`selectAllMatching`), past 50. One-by-one ticks keep the cap (`selectionCap` only shrinks an over-cap
  selection).
- **Routing**: `controlRoute(n)`: over 50 → `bulk`. `syncConsoleApi.controlBulk(body: StoreControlRequest):
  Promise<StoreBulkControlResponse>` posts `ActionSync/Stores/Control/Bulk`; `syncConsoleApi.sendControl(body):
  Promise<ControlAnswer>` (`{ batchId | null, results }`) routes by size, and `ControlDialog` sends through it.
  The toast names the batch; refusals (`DISABLED` included) list as `ControlResults` already did. 903 should reuse
  `controlBulk` (or `sendControl`).
- **Over 50** the bar offers only Pause, Resume, Disable (Enable in the disabled view): Move, Hand back and Re-push
  are not offered for groups (3913). A note says the batch goes 50 at a time and finishes if the page closes.
- **Tile** "Closed, not disabled" (`closedNotDisabled`, warn), last in the row.
- **Audit**: `groupAuditByBatch` folds a batch's chunk rows into one event where its newest chunk sits, with
  "N chunks" and every chunk's stores in send order.
- en + ar strings for every new word (ar plural forms for the chunk count).
- **Tests**: the four proofs + Fleet/Codes query string; whole suite green after the merge (777 files / 10,716
  tests); typecheck clean; lint gates grid-base, contrast, palette, controls clean (boundaries fails only on the known
  insurance-rules test).
- **Drive** `tools/sync-console-select-all-drive.mjs`, stubbed: **39/39** (post-merge). Re-run: controls 113/113,
  disabled 63/63 (post-merge), commands 69/69, fleet 87/88 (only the known menu-order check; the fleet drive now
  expects the fourteenth tile).

**Contract guesses (check against 3916/3917 when they land):**
1. `Fleet/Codes` answers a bare `string[]`; `{ codes }` is read too.
2. `Fleet/Codes` takes the same params as Fleet minus `sort`/`page`/`pageSize`.
3. The bulk door answers `{ batchId, results }` (results as `Stores/Control`'s, request order; no `auditId`).
4. The Summary's tile count is `counts.closedNotDisabled` (optional; a pre-3917 door shows the tile with no figure).
5. `closedNotDisabled` is a `StoreState` sent in `states[]` and accepted as a `state` filter.

**Judgement calls / limits:**
- Select all matching replaces the selection (it does not add to it).
- Audit grouping is per page: a batch cut by the door's 50-row paging shows its part on each page.
- After a bulk answer every store page is invalidated (one prefix), not 300 one by one.
- The reason dialog lists every code (70 in the drive); for thousands it will be long but scrolls.
- Post-merge note for 901: its Disable dialog crashes the dialog if the preview answers without `stores` (seen
  when this drive's stub returned `[]`); the drive now stubs the preview. Worth a guard in 901's review.

**Owed:** the staging walk on BO 3916/3917: "Closed, not disabled" tile → Select all matching → Disable on more than
50 stores lands as one batch (audit shows one event with its chunk count).
