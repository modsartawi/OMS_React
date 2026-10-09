---
status: open
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

- [ ] `scanBuffer`: Enter commits a scan; FNC1/GS and `#` are preserved; pasted lines become
  separate scans; the 501st is refused (vitest)
- [ ] `verdictView`: each status, batch value and material reason maps to a label key and a
  severity (vitest)
- [ ] `historyOnDemand`: no history request until a row is expanded, and one request per unit after
  that (vitest)
- [ ] `tools/materials-gs1-drive.mjs`, run against stubs:
  - a valid unit shows SOLD with its history and a lot-mismatch row highlighted;
  - a malformed code shows its issues;
  - a duplicate is flagged;
  - the sync note shows;
  - export works;
  - the menu entry is hidden when `canCheckGs1` is false.
- [ ] `npm run typecheck`, `npm run lint` and `npm test` green

## Boundaries

oms-react only, against stubs until 455. The page never decides validity itself; the server's
verdict is shown as given.

## Done when

The named helpers and the drive are green.

## Blocked by

[451](451-an-hq-user-searches-materials-with-the-smart-box-and-the-level-filters.md)
