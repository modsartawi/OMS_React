---
status: done
spec: BackOffice 4016
blocked-by: BO 4031, 915
---

# 916 — The store page shows readings, history chart, largest tables and Not checked

## What to build

Opening a store from the tab shows the **Readings** panel from `GET StoreDatabase/Store`: plain-word latest
reading (engine, cap, used, allocated, free inside file, log size/used, recovery model, drive free, machine,
uptime, last backup), days to cap with its growth rate, a daily chart of used / allocated / log / drive free
(dataviz conventions), the 10 largest tables, and a Not checked banner with the last error. Side copies listed when
BO 4038 sends them.

## Spine reach

UI

## Proof (→ `tdd` red-green cycles)

- [x] component test: Not checked banner shows the last error (`store-db/reading-helpers.test.ts` `notCheckedBanner` + drive check 9)
- [x] chart renders from a fixture history (`historyRows` over `__fixtures__/store.json` + drive check 5)

## Boundaries

—

## Done when

The dev store's page renders against a local SIS.Api.

## Blocked by

BackOffice 4031, 915

## Comments

**2026-11-18 — built, STUBBED (BO 4031 unbuilt).** Branch `t916-store-db-readings` off `spec/4016-store-database`.

What was built:
- `StoreDbStorePage.tsx` reads `GET StoreDatabase/Store?code=` once (`storeDbStoreQuery`, key = `storeDbStoreKey(code)`
  exactly, so 917's Check now can `setQueryData` it) and draws: the header (code, name, state chip, read time, and an
  empty `data-store-db-actions` slot for store-wide actions), the **Not checked** banner (server's last error, `<bdi>`),
  a `NO_STORE` not-found card, and the panel strip.
- Panel strip `StoreDbPanels.tsx` (`?panel=`, `Chip variant="tab"`, the `StoreTabs` pattern; Refresh invalidates
  `storeDbStoreKey(code)`). Order lives in `panels.ts` (`STORE_DB_PANELS`, pure + tested); a panel is SHOWN once it is
  mounted in `panel-views.tsx` — one commented import line and one commented map line per later panel, blank-line
  separated, so 917/918/919 each un-comment their own lines. Every panel gets `{ store }` (`StoreDbPanelProps`).
- `ReadingsPanel.tsx`: latest reading in plain words (`readingLines`: engine · version · edition · bitness, cap, used of
  cap, allocated, free inside the file = allocated − used, log used of size, recovery model, drive free on its drive,
  machine, uptime = SQL start → reading time, last full backup + size), days to cap with its growth rate + window
  (`growth`), `HistoryChart.tsx` (two `core/charts` line charts — files in MB with the cap as an ink dashed reference,
  drive free in GB on its own chart, never a second axis; a missed day is a gap), `LargestTables.tsx`, `SideCopies.tsx`
  (read-only, only when the door sends some).
- Locale: `storeDb.panels` (all seven panel names, so 917/918 need no label edit) and `storeDb.readings`, en + ar.
  The later tickets' empty objects (`live`, `health`, `space`, …) are now blank-line separated so their edits never
  touch adjacent lines.

Proof: `store-db/reading-helpers.test.ts` 22/22 (banner, chart rows from the fixture history, reading lines, growth),
`store-db/panels.test.ts` 3/3, `locales.test.ts` still green over the new keys. Full suite 823 files / 11,192 tests green;
typecheck green; lint: grid-base, contrast, palette, controls (no new raw control), map-build green; `check-boundaries`
only the 4 PRE-EXISTING insurance-rules violations. Drive `tools/store-db-store-drive.mjs` 37/37 (port 5216).

🚩 GUESSES (reconcile with BO's brief): every `StoreDbStore` / `StoreDbReading` field name (models §916); `reading` = the
latest SUCCESSFUL reading and `lastAttempt` = the latest attempt (the banner shows on `NotChecked` OR a failed attempt);
history as `{ day, usedKb, allocatedKb, logKb, driveFreeKb }[]`; `growthKbPerDay` (+ `growthWindowDays`); refusal
`NO_STORE` for an unknown store; `sideCopies` absent before 4038 reads as `[]`.

**Owed:** "Done when" — the dev store's page against a local SIS.Api — waits on BO 4031.

**2026-11-19 — 4016 review: stories 15 and 16 added.** The Readings lines now carry, beside machine and uptime,
the CPU count and physical memory (story 15) and the longest open transaction's age and the blocked-session count
(story 16), all from the one Store door's reading (spec D5). 🚩 GUESSED field names on `StoreDbReading`:
`cpuCount`, `physicalMemoryKb` (KB like every size), `longestOpenTransactionSeconds` (`0` = none open → "None open"),
`blockedSessions`. A door that omits them reads "Not read". Lines are now 15 (drive updated); the line list is shared
with the Space panel (`LineValue.tsx`).
