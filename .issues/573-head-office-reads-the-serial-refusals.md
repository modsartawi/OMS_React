---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\3049-head-office-records-every-serial-refusal-spec.md
blocked-by: — (live: BackOffice 3054 deployed + seed)
---

# 573 — Head office reads the serial refusals: who keeps trying to sell packs that are already sold or held

## What to build

`/oms/serial-refusals`, an OMS leaf behind its own probe (`SerialRefusal/Access`, grant
`BackOfficeScreen[SerialRefusal, 03]`), over BackOffice 3054's `SerialRefusal/Report` and `SerialRefusal/Rows`.

- Scope: From / To (30 days by default, at most 92, refused before any call), asking stores (comma list, applied on
  Enter / Apply), answer (sold, held or both). All in the URL.
- Ten totals tiles: refusals, already sold, held, sold elsewhere, sold at the same store, sale not named, staff,
  unknown staff, serials, asking stores.
- Tabs: Staff, Repeat offenders, Serials, Stores, Articles, Held by, Per day, Refusals. A row opens the refusals behind
  it on the Refusals tab (staff / unknown staff → `noStaff`, offender, serial, article, holding store); a store row
  narrows the scope to that store. A drill line names the narrowing with "Show all".
- Blank staff id reads "Unknown staff" (an older till build), never a person.
- Export .xlsx of the open tab, codes as text. EN + AR.

## Proof

- [x] `filters.test.ts`: range, URL round-trip, drill, stores normalising.
- [x] `i18n-keys.test.ts`: EN/AR mirror, six Arabic plural forms, every built key.
- [x] `menu-model.test.ts`: leaf after the scorecard, own probe, fails closed.
- [x] `tools/serial-refusals-drive.mjs`: 42/42 **stubbed**, LTR + RTL (denied, default range, tiles, unknown staff, drills,
      noStaff, Show all, truncated note, store scope, 92-day block, PICK-00301 sentence, export, no page errors).
- [x] typecheck + lint clean.

## Comments

**Done 2026-10-25** (branch `serial-refusal-report`). The drive caught a real bug fixed in this slice: on the
Refusals tab a failed Report read (the tiles) showed no error, because the banner watched only the open tab's read.
Live run waits on BackOffice 3054 deployed, its seed run and the role bound.
