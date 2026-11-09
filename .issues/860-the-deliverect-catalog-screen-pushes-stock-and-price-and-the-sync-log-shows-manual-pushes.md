---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\3481-deliverect-stock-and-price-pushed-on-demand-without-the-catalog-spec.md
blocked-by: BackOffice 3483, BackOffice 3485
---

# 860 — The Deliverect catalog screen pushes stock and price, and the store sync log shows manual pushes

## What to build

- **Whitelist import:** a "Push stock & price now" option, **on by default**, sent as `pushStock`.
  After the import, show the answer's `push` block: per account, the stores reached, the rows sent
  and the status. If the push was skipped, say why (over 200, option off). A failed push is shown
  as a warning, not as a failed import.
- **Push now:** an action on the whitelist for chosen materials (up to 200), with a reason, calling
  `POST DeliverectWeb/Stock/Push`. Show the per-account results, and the door's refusals: not
  whitelisted (with the materials named), empty or over the cap, no reason. Only visible with
  `canManageCatalog`.
- **Store sync log:** a manual push (sync type `M`) is labelled as such and shows who pushed it
  (`requestedBy`).
- The catalog push button, if one is shown, handles the refusal while BackOffice's
  `Deliverect:CatalogPush` is off (BackOffice 3486). Prefer hiding it.

Contract: BackOffice `.issues/assets/2615-deliverect-web-door-contract.md` (Catalog and Stock sync
sections, as amended by BackOffice 3483, 3485 and 3486).

## Spine reach

UI → SIS.Api doors

## Proof (→ `tdd` red-green cycles)

- [x] Import with the option on and off sends `pushStock` and renders the `push` block, including a skipped and a failed push
- [x] Push now renders per-account results and each refusal
- [x] The sync log labels `M` and shows the requester
- [x] typecheck + lint + build clean

## Boundaries

oms-react only. It reads the amended contract.

## Done when

A category manager can add items with an immediate push, push chosen items again, and see the
manual push on each store's log.

## Blocked by

- BackOffice [3483](C:/Work/DMSCO/BackOffice/.issues/3483-push-now-sends-chosen-materials-to-every-linked-unpaused-deliverect-store-logged-as-manual.md)
- BackOffice [3485](C:/Work/DMSCO/BackOffice/.issues/3485-a-whitelist-import-pushes-the-imported-materials-stock-and-price-at-once.md)

## Comments

**Done 2026-11-09 (stubbed — no live SIS.Api walk yet).**

- **Import:** "Push stock & price now", ticked by default, sent as `pushStock`. The answer's `push`
  block renders under the import's counts: per account (stores, rows, file id, `S`/`E` with the
  error), skipped with why (`pushStockOff`, `overCap`, `noKnownMaterials`, or a generic line for a
  reason the contract doesn't name), and a failed push as a **warning** beside a saved import.
  Over 200 materials the dialog warns before sending that the push *may* be skipped (the server
  counts known materials only).
- **Push now:** ticked grid rows fill an editable list (paste also works), capped at 200 on screen,
  then `POST Stock/Push` with a reason. Results are per account. DLV-00004 shows the server's
  sentence plus the refused materials, picked back out of `message`; DLV-00015 shows under the
  list, DLV-00009 under the reason. The toast warns, rather than reporting success, when an account
  is `E` or no store was reached. ⚠ Ticks are page-local (the grid's own selection): paging drops
  them. A paste covers larger or cross-page sets.
- **Catalog push removed** (BackOffice 3486 / ADR 0131): the button, its dialog and the
  `Catalog/Push` api call are gone. The model types stay as the contract has them.
- **Sync log:** `M` reads Manual with `by <requestedBy>` (Ltr: it is a login id like `updatedBy`).
  The lines sheet header shows the requester too.
- **Proof:** `stock-push.test.ts` (20), the `sync-health` / i18n key tests, the full suite
  **720 files / 9904 tests** green. `deliverect-catalog-drive` **112/112**: §3b import on/off,
  pushed, skipped, failed, over-cap; §7 Push now with every refusal, and `Catalog/Push` never
  called; RTL isolates. `deliverect-stores-drive`: the new §14/§15 Manual + requester checks pass.
  Typecheck, build, and lint gates 2–5 are clean.
- ⚠ **Not mine, already on main:** lint gate 1 (boundaries) fails on 4 imports in
  `insurance-rules/aliases/door-shapes.test.ts` (e9243c46). `deliverect-stores-drive` §21 (push
  lines) times out intermittently under load, the same at HEAD's app plus HEAD's drive, checked in
  a temporary worktree. I fixed menu drift in both drives: the group header is uppercased by CSS
  and starts expanded.
- **Live walk owed:** on staging, with Deliverect having created one product keyed by our material
  number, import with the push and then Push now, and see the `M` row on the store's log.

