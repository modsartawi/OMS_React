---
status: done
spec: 380
blocked-by: 397
---

# 399 — The search is a bar of tokens

## What to build

The Deliveries list's criteria panel (`FilterPanel`) becomes a **query bar** across the top of the
centre column.

- **Tokens.** Each active criterion is a token that reads `Field: value`. Clicking a token opens a
  popover with that field's own control:
  - **Enter searches.** Its Enter is `preventDefault`ed and owned, so it never bubbles into the
    grid's Enter-opens (368 finding).
  - **Done** closes without searching.
  - **×** drops the token.
- **+ Filter.** A dashed control that lists **all 14 `DeliveryFilterCriteria`** in four groups:
  **When · Find one · Narrow · Rows**. Criteria already in the search are marked "in search".
- **Date.** The From/To pair becomes **one Date entry** with **relative presets**: Today,
  Yesterday, Last 3 days, Last 7 days, Custom. The relative choice is kept as such, so 400's saved
  views store it relative.
- **Limit.** The Limit token is **always shown**, editable and never removable.
- **Search** (primary) sits at the inline-end edge.
- **Unapplied edits are flagged until Search runs:**
  - an edited token goes **dashed amber**;
  - a removed token stays as a **struck-through ghost** with a restore button;
  - a note reads **"N changes not searched · Discard"**, and Discard restores the last-run criteria;
  - Search carries an **amber dot**.
- **`/`** (a list single key, behind the switch) focuses the query bar, with `preventDefault` so
  Firefox's quick-find stays shut. Enter in the bar is the deliberate search.
- **Returning from Details** still restores the in-memory search (`search-store`).

**Implements:** spec 380 **L8**, and the `/` part of **L16**.

**Rulings:** [368](368-the-deliveries-list-as-one-screen.md) §1 (the query bar), the 368 Enter
finding, [365](365-keyboard-shortcuts-that-work-for-everyone.md) §5 (`/`), and the carried-forward
rule from cancelled 355 that all 14 filters stay reachable and applied filters stay visible.
Prototype: branch `prototype/368-deliveries-list` (`9b7f32c`), variant A, with captures
`A-token-edit.png`, `A-filter-menu.png` and `A-pending.png`.

## Spine reach

store/logic (a pure token model: criteria ↔ tokens, relative date → concrete range at search time,
pending-diff vs the last-run criteria) · component/route (the query bar, the token popovers and
+ Filter replacing `FilterPanel`) · i18n (`deliveries:query.*`) · test

## Proof (→ `tdd` red-green cycles)

- [x] `criteriaRoundTripThroughTokens`: each of the 14 criteria maps to a token and back unchanged,
  and Date is one relative token · pure
- [x] `relativeDateResolvesAtSearchTime`: "Last 3 days" resolves to a concrete From/To against an
  injected "now", and stays relative in the model · pure
- [x] `pendingDiffFlagsEditsAndRemovals`: editing, removing and adding tokens against the last-run
  criteria gives the edited/ghost/added sets and the "N changes" count. Discard restores · pure
- [x] `tools/deliveries-list-drive.mjs`, extended. + Filter lists the 14 in four groups. Enter in a
  token popover searches **and does not open Details**. The amber flags show until Search. `/`
  focuses the bar. The drive runs in light, dark and RTL · flow (Playwright)

## Boundaries

- No new API endpoint. The same list read and the same 14 criteria.
- New `deliveries:query.*` keys.
- `FilterPanel` is replaced, not kept beside the bar.

## Done when

The query bar drives every search with all 14 criteria reachable and unapplied edits flagged, and
the proof tests and the drive are green.

## Blocked by

[397](397-the-selected-row-shows-in-a-resizable-inspector.md).

## Comments

**Built 2026-10-03 (AFK).**

- **Pure module `query-model.ts`.**
  - The 14 `DeliveryFilterCriteria` are 13 bar entries, with From/To as one **Date**. The entries
    sit in four groups (When · Find one · Narrow · Rows). Each knows its control and how its value
    reads (an ID in mono and LTR, a machine value in LTR, free text in a `<bdi>`, or a word).
  - `QueryCriteria` keeps the Date **relative** (`today`, `yesterday`, `last3`, `last7`, or
    `custom` with two `yyyy-MM-dd` days). `toFilterCriteria(query, now)` resolves it to local
    midnights at search time, and `buildDeliveryQuery` is unchanged. 400 can store a
    `QueryCriteria` as it is.
  - `tokensOf` and `queryOfTokens` round-trip.
  - `pendingDiff` and `barTokens` compare the draft with the last search that came back, giving
    applied, edited, added and ghost tokens. A padded box or a cleared Limit (still 200) is not an
    edit.
  - `restoreField` and `discardedDraft` are the restore and Discard actions.
  - A Custom range missing an end is no criterion: no token, no flag and nothing sent.
- **The search store** holds the `draft` and the last `query`. `setResult` records the query, so a
  **failed search keeps its edits flagged**. Returning from Details restores both.
- **`QueryBar.tsx` / `QueryToken.tsx`** replace `FilterPanel` (deleted).
  - Tokens read `Field: value`.
  - A token's popover holds the field's own control. Enter searches, and the press is prevented
    so the key layer and the grid never see it (368). Done closes without a request, and Esc
    closes it through `takesEscape`.
  - × drops a token, and a dropped token stays as a struck ghost with a restore.
  - + Filter (dashed) lists all 14 criteria in four groups and marks "in search".
  - The Limit token is always shown and has no ×.
  - The amber flags are: dashed `--attention` tokens, the note "N changes not searched" with
    Discard, and the dot on Search.
  - The coded dropdowns still read the session lookups, and a failed lookup warns once. Their
    `<option>` labels are isolated with `fsi` (string-only sink).
- **`/`** is a registered command (`Slash`, "Focus the search bar") that focuses + Filter. It sits
  behind the single-key switch and the key layer prevents it. + Filter carries
  `aria-keyshortcuts` and the hint in its tooltip.
- **i18n.** New keys are under `deliveries:query.*`. `filters.*` and `actions.*` are removed, and
  `emptyPrompt` no longer names Load.
- **Proof.**
  - `query-model.test.ts`: 24 tests.
  - `tools/deliveries-list-drive.mjs`: 218/218 in light, dark, LTR and RTL, network stubbed. It
    checks + Filter's groups, the amber flags and their colour, Done with no request, ghost,
    restore and Discard, a failed search kept flagged, Enter in a popover searching once without
    opening Details while a row is current, Last 3 days sent as today-2..today and still reading
    relative, the Limit, `/` focusing and prevented, and Back restoring the tokens.
  - The drives that clicked "Load" now click Search: command-palette 366/366, grid-theme 125/125,
    oms-access 28/28, and foundation 1294/1302 (its 8 pre-existing topbar and bell failures).
  - `palette-drive` and `screen1-smoke` need a live SIS.Api login, so they were updated but not
    run.
  - `npm test` 3412 passed, `npm run lint` passes all four gates, and `npm run build` is green.
- **Outstanding (owner):** the S3 live sign-off, including a human eye on Arabic rendering. Not a
  blocker here. Decisions are logged in `.afk/HITL-399.md`.
