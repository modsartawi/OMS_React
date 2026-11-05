---
status: done
spec: 766
blocked-by: 775
---

# 776 — Saving my own item saves in place; anyone else's saves as my copy; a clash is refused

## What to build

- **Own items** save in place with `PUT Analytics/Item/{id}` and `baseRevision`.
- **`ANALYTICS-403`** opens **Save as my copy** (`POST …/Copy`). The copy is Personal and records its
  source.
- **Shared and Certified items** also offer an explicit "Save as copy".
- **`ANALYTICS-405`** names who saved last and when, and offers a copy or a reload.
- **A copy** shows "the original changed since you copied it" when the source has moved on.

## Spine reach

model/api (`PUT`, `Copy`) · store/logic (tier → actions) · component · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `tier and actions: owner × tier × curator → save in place | save as copy | read only` · pure (vitest)
- [x] `edit a Shared view you do not own → Save as my copy; a stale save shows the 405 message and offers a copy` · flow (Playwright, `tools/analytics-drive.mjs`, stubbed envelopes)

## Boundaries

Stubbed: the wire is spec 766 §C, owned by BackOffice 3378 (a `400` on the first live call is a drift report).

## Done when

The drive proves save, copy and conflict.

## Blocked by

[775](775-an-hq-user-builds-a-view-from-the-model-and-is-offered-only-the-chart-types-that-fit.md)

## Outcome

- Pure: `boards/item-actions.ts` (`itemActions(standing, actor)` → `{ save, actions }`, vitest), `boards/item-save.ts`
  (`saveRefusal` 403/405, `EditingItem`, `sourceMovedOn`, vitest), seed `item` + `editItemLink` in `boards/editor.ts`.
- Kind-agnostic save path `boards/use-item-save.ts` (`useItemSave({ kind, editing, onSaved })`, `useItemActor`) and
  `boards/SaveNotes.tsx` (`SaveStanding`, `SaveRefusalNote`, `SourceMovedOn`); doors `analyticsApi.update` / `.copy`.
- Drive `DRIVE_ONLY=776`: 47/47 (copy en+ar, in place, 405 en+ar with reload and copy, 403, tiers, moved-on copy).
- Rulings (⚠, BackOffice 3378 to confirm): PUT carries `title`/`subtitle` beside `{ definition, baseRevision }`;
  Copy's body is `{ revision, title, subtitle, definition }` (one call copies with edits); 405's who/when ride in
  refusal `data.updatedBy` / `data.updatedAt`; owner matched case-insensitively against the session `userId`;
  someone else's Personal item is read only (no Edit, no copy).
