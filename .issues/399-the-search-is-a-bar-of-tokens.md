---
status: open
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

- [ ] `criteriaRoundTripThroughTokens`: each of the 14 criteria maps to a token and back unchanged,
  and Date is one relative token · pure
- [ ] `relativeDateResolvesAtSearchTime`: "Last 3 days" resolves to a concrete From/To against an
  injected "now", and stays relative in the model · pure
- [ ] `pendingDiffFlagsEditsAndRemovals`: editing, removing and adding tokens against the last-run
  criteria gives the edited/ghost/added sets and the "N changes" count. Discard restores · pure
- [ ] `tools/deliveries-list-drive.mjs`, extended. + Filter lists the 14 in four groups. Enter in a
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
