---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\2544-material-master-on-the-web-spec.md
blocked-by: 451 (live: BackOffice 2549)
---

# 454 — A quality user scans GS1 units and reads their history

## What to build

Feature `features/materials/gs1-check` with the route `/materials/gs1`, guarded by `canCheckGs1`
(fill in 451's placeholder menu entry). Its own i18n namespace, EN + AR.

- **Scan input**
  - An always-focused input that takes a scanner's DataMatrix read, FNC1 / GS included, and a
    pasted string with `#` separators.
  - Each Enter adds the scan to the list. Pasting several lines adds them all.
  - New scans are sent to `POST MaterialWeb/Gs1/Check` in batches of up to 500. The list is capped
    at 500, and the cap is shown.
- **Verdict card** for the latest scan:
  - **Well-formed** — ✔, or the issues, each with its category.
  - GTIN, expiry, lot and serial.
  - **Material** — number and EN/AR description. When there is none, the reason: `NOT_PARSED` /
    `GTIN_UNKNOWN`.
  - **Batch** — known / unknown / not applicable. Unknown is shown as a warning.
  - **Status** — SELLABLE / SOLD (store / till / invoice) / HELD (document / store), as a coloured
    badge.
  - A standing note: **"History only covers invoices already synced to HQ"**, shown beside
    SELLABLE.
- **Scan list** (AG Grid), one row per scan: code, material, lot, serial, expiry, well-formed,
  batch, status and history count.
  - **A duplicate scan is flagged** on its row, not silently merged.
  - Expanding a row loads `MaterialWeb/Gs1/History` for that unit, on demand only. History rows
    show date and time, SALE/RETURN, store and name, till, invoice and lot, with
    **`lotMismatch` highlighted**.
  - Clear list.
  - Export the list, with verdicts, to Excel.

Wire shapes: `C:\Work\DMSCO\BackOffice\.issues\assets\2544-material-web-door-contract.md`
(Gs1/Check, Gs1/History).

## Spine reach

UI → app (BackOffice read doors, stubbed until 455)

## Proof (→ `tdd` red-green cycles)

- [x] `scanBuffer`: Enter commits a scan; FNC1/GS and `#` are preserved; pasted lines become
  separate scans; the 501st is refused (vitest)
- [x] `verdictView`: each status, batch value and material reason maps to a label key and a
  severity (vitest)
- [x] `historyOnDemand`: no history request until a row is expanded, and one request per unit after
  that (vitest)
- [x] `tools/materials-gs1-drive.mjs`, run against stubs:
  - a valid unit shows SOLD with its history and a lot-mismatch row highlighted;
  - a malformed code shows its issues;
  - a duplicate is flagged;
  - the sync note shows;
  - export works;
  - the menu entry is hidden when `canCheckGs1` is false.
- [x] `npm run typecheck`, `npm run lint` and `npm test` green

## Boundaries

oms-react only, against stubs until 455. The page never decides validity itself; the server's
verdict is shown as given.

## Done when

The named helpers and the drive are green.

## Blocked by

[451](451-an-hq-user-searches-materials-with-the-smart-box-and-the-level-filters.md)

## Comments

**2026-10-09 — built AFK (stubbed), done.**

- **Feature** `features/materials/gs1-check`: `Gs1CheckPage.tsx` sits behind `canCheckGs1` (the
  ScreenGate backstop) and is routed at the static `/materials/gs1` in place of 451's placeholder.
  The menu leaf and its `materials-search:menu.gs1Check` label are unchanged. Namespace
  `materials-gs1-check`, EN + AR, with all six Arabic plural forms.
- **The screen:** an always-ready scan box (Enter commits; a pasted block adds every line; the raw
  scan kept byte for byte, GS and `#` included, in the list and the request); a verdict card for
  the latest scan (well-formed or its issues by category, GTIN/expiry/lot/serial, material with EN
  and AR descriptions or the reason there is none, batch, status badge with SOLD's store/till/invoice
  or HELD's document/store, the sync note beside SELLABLE); a Community AG Grid scan list (duplicates
  flagged on their own row, never merged; the 501st refused on the client with the cap shown);
  history on demand in a pane under the grid, lot mismatches highlighted through
  `bg-attention-050`; Clear list; xlsx export through `@/core/util/grid-xlsx`.
- **Pure helpers:** `scan-buffer.ts` (split, add, cap, duplicate flag, batches, `visibleScan`),
  `verdict-view.ts` (value → label key + severity), `history-on-demand.ts` (request, key, query).
- **Proof:**
  - vitest: `scan-buffer.test.ts`, `verdict-view.test.ts`, `history-on-demand.test.ts`,
    `i18n-keys.test.ts` (243 files / 4311 tests green);
  - drive `tools/materials-gs1-drive.mjs`: **59/59** on vite :5244, LTR. It covers SOLD with
    history and a highlighted lot-mismatch row, a malformed code's issues, duplicates, the sync
    note, export (GS written as `<GS>`, no control characters, no isolates), the cap, Clear, a
    failed batch with Check again, and the hidden menu leaf without `canCheckGs1`;
  - 451's `tools/materials-search-drive.mjs` (74/74) now proves `/materials/gs1` on the real page,
    and 453's stock drive is still 47/47;
  - typecheck, lint (all four gates) and build are green.
- **Reviews:**
  - `/code-review`: fixed a cleared batch's late answer or error landing on the emptied list, the
    banner losing a failed batch's server message to a later success, history keyed so a re-scan
    whose `historyCount` has grown asks again, and a full-grid redraw on every expand (now only
    the two rows that changed). Findings in 451/453's files were logged, not changed;
  - `/standards-review`: one hard violation fixed (the Arabic sheet name). Also fixed: the two
    "History" headers (the count is now "History count"), an unused key, and a repeated call. A
    retry proof was added to the drive.
- **Decisions and contract gaps** are in `.afk/HITL-454.md`.
- **Outstanding (not this ticket's):** the live walk against BackOffice 2549, the owner walk and
  the Arabic read-through belong to 455.
