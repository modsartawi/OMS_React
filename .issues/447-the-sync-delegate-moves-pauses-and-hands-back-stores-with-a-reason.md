---
status: done
spec: 444
blocked-by: 446
---

# 447 — The sync delegate moves, pauses and hands back stores, each with a reason

## What to build

The lasting controls and the audit trail:

- **One reason dialog** shared by every control. The reason is required and the confirm button
  stays disabled until it is filled.
- **Store page controls by host and grant:**
  - a worker store offers Pause/Resume and Hand back;
  - a WPF store offers only Move to worker;
  - without `canOperate`, no controls render.
- **Fleet bulk:** a row selection capped at 50 drives Move, Hand back, Pause and Resume in one
  call. The results come back per row; failures are listed with their code, and successes refetch.
- **Pending badge:** after a control, the store shows "pending" until `controlPending` clears on
  refetch.
- **Feeds:** the Audit tab on the Store page, and the fleet-wide **Audit** page
  (`/admin/sync/audit`, filters from/to/who/code). Each entry shows who, when, the action, the
  stores or batch, before → after, and the reason.
- Refusals (`TOO_MANY_STORES`, `REASON_REQUIRED`, `NOT_ON_WORKER`, `NO_STORE`) show through
  `apiErrorMessage`/`apiErrorCode`.

The wire shapes come from the door contract, `C:\Work\DMSCO\BackOffice\.issues\assets\2523-sync-console-door-contract.md`. The layout comes from the
[prototype](https://claude.ai/artifact/557hsB6V9zt9zV1XVrZPVd).

## Spine reach

UI → app (BackOffice control door, audit door)

## Proof (→ `tdd` red-green cycles)

- [x] `allowedControls(row, access)`: exact sets for worker, paused worker, WPF, and no operate grant (vitest).
- [x] `selectionCap`: the 51st selection is refused with a message key (vitest).
- [x] `controlResultSummary`: per-row results become one toast sentence plus a failure list (vitest).
- [x] `tools/sync-console-controls-drive.mjs`: with stubs, a single pause with a reason, bulk move of 3, a refused row shown, the pending badge, and the audit feed filters.
- [x] `npm run typecheck`, `npm run lint` and `npm test` green.

## Boundaries

oms-react only. The BackOffice side (BackOffice 2539, 2540) is built in parallel; until it lands, prove the screen
against stubs of the contract.

## Done when

The named helpers and the drive are green.

## Blocked by

[446](446-the-sync-delegate-opens-one-store-s-sync-history-counters-and-scripts.md)

## Comments

**Done 2026-10-09 (AFK).** Built in `src/features/admin/sync-console/`:
- `ReasonDialog` — the ONE reason dialog, on `@/core/ui/Modal`. The reason is required (trimmed,
  not blank) and Confirm stays disabled until it is filled. A whole refusal (`REASON_REQUIRED`,
  `TOO_MANY_STORES`, `NO_STORES`) shows in the dialog through `apiErrorMessage` and `apiErrorCode`,
  and the dialog stays open.
- `ControlDialog` — `POST ActionSync/Stores/Control` behind that dialog. It shows one toast
  sentence, and refetches the fleet, the stores in the request and the audit feed.
- `ControlResults` — the refused rows, each with its code: the code's words when the bundle has
  them, the raw code otherwise.
- `StoreControls` — on the store page:
  - a worker store gets Pause or Resume, and Hand back;
  - a WPF store gets Move to worker;
  - without `canOperate`, nothing renders.
- **Fleet:** a checkbox selection kept as codes across pages, capped at 50 by `selectionCap`, with
  a bulk bar (Move / Hand back / Pause / Resume, one call). Without `canOperate`, neither renders.
- **Audit:**
  - `AuditFeed` + `audit-columns`, shared by the store's Audit tab (`AuditTab`, `code=`) and the
    new `/admin/sync/audit` page (`AuditPage`, filters from/to/who/code, applied on Search, a bad
    range refused);
  - `ConsoleNav` (Fleet · Audit) is the console's page bar, which 448 and 449 extend.
- **Pure helpers:** `control-helpers.ts`. The model gains `StoreControlRequest/Result/Response`,
  `SyncAudit` and `CONTROL_ACTIONS`, field for field with the contract. The pending badge still
  reads only the door's `controlPending`.

Proof:
- **vitest:** `control-helpers.test.ts`, 27 tests:
  - `allowedControls`: worker, paused worker and WPF; no grant and a malformed answer give none;
  - `selectionCap`: the 50th is taken; the 51st is refused with `selection.capped`; a page-wide
    select fills up to the cap; removals always go through;
  - `controlResultSummary`: all done, some failed, all failed and empty; a raw-code fallback; the
    command-id variant;
  - `reasonReady`, `auditQuery` and `auditRangeValid`, and `auditActionKey`.
- **drive:** `tools/sync-console-controls-drive.mjs`, **67/67**, against STUBBED contract envelopes
  on vite :5199:
  - a single Pause with a reason: Confirm gated, the POST sends the reason trimmed, one toast;
  - the pending badge appears after the refetch, and clears when the door clears it;
  - the Audit tab shows the new entry;
  - the controls by host, a paused worker store, and a WPF store with Move only;
  - a `REASON_REQUIRED` whole refusal;
  - view only: no control, no checkbox and no bulk bar;
  - a bulk Move of 3 in one call, with the refused `NO_STORE` row listed and Pending on the moved
    rows;
  - a bulk Pause that lists `NOT_ON_WORKER`;
  - the 51st selection refused across pages;
  - the Audit page entries and all four filters.

  The 445 and 446 drives still pass (38/38 and 65/65). The store drive now stubs the audit feed
  instead of checking a placeholder, and the fleet drive's menu check ignores the console page bar.
- **Gates:** `typecheck` clean; `npm test` 231 files and 4226 tests; `lint` four gates clean;
  `build` green.

**Reviews:**
- `/code-review` (medium) returned 10 findings. 7 are fixed:
  - controls are keyed per store;
  - only the requested stores are refetched;
  - the hint's cap is interpolated;
  - one checkbox re-sync path;
  - one control-action list;
  - an `AuditAction` `Record`;
  - a locale list separator.

  The `to` inclusivity and WPF-has-no-Audit-tab findings are logged in HITL-447. The dialog's
  `onShow` reset is kept and documented for 448/449 callers that keep it mounted.
- `/standards-review` found no hard violations. One button-variant map is now shared, and two
  copy fixes are applied.

**Owner sign-off wanted:** the bulk bar offers all four controls for any selection, including an
all-WPF one, against spec story 13 (see HITL-447). Decisions and contract gaps are in
`.afk/HITL-447.md`.

**Outstanding (not AFK):**
- the live walk against BackOffice 2539/2540 (ticket 450);
- an owner eye against the prototype.

The named helpers and the drive are green.
