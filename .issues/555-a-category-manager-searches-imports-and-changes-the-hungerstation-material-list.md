---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\3028-hungerstation-follow-up-on-oms-react-spec.md
blocked-by: 551 (live: BackOffice 3035)
---

# 555 — A category manager searches, imports and changes the HungerStation material list

## What to build

The WPF HungerStation material inquiry and import, on the web. It is the list of materials offered to
HungerStation, flagged disabled or deleted.

- **Registration:** the feature `features/hungerstation/materials`, the namespace `hungerstation-materials`
  in EN and AR, and the route `/hungerstation/materials`. Its menu entry fills 551's placeholder under
  `canManageCatalog`.
- **Materials page** (AG Grid), **server-paged** (`skip`/`take`, `total`):
  - Columns: material number, SKU, name EN, name AR, disabled, deleted, updated at/by.
  - Filters: state (active, the default / disabled / deleted / any) and text (the start of a material
    number or SKU, or either name). Filters round-trip through the URL.
  - `updatedAt` renders blank when `null`.
- **Change one** material: set disabled and deleted, with a mandatory reason. The door returns the row, and
  the grid updates it in place. DHS-00009 shows inline.
- **Import**: paste or `.xlsx`, up to 5000 rows. Each row is a material number plus disabled and deleted.
  The X marks of the WPF sheet become booleans, so accept `X`/blank as well as true/false. A mandatory
  reason.
  - Show a preview before sending: rows, repeats (the last one wins), and any row that isn't a material
    number. Refuse locally over 5000.
  - The answer shows added, updated and the **unknown** numbers (not in the material master, not added) as a
    copyable list.
  - DHS-00010 shows inline.

Wire shapes: `C:\Work\DMSCO\BackOffice\.issues\assets\3028-hungerstation-web-door-contract.md`, section
Materials.

## Spine reach

UI → app (BackOffice doors, stubbed until 557)

## Proof (→ `tdd` red-green cycles)

- [ ] `materialImport`: X/blank and true/false parse to booleans, the last repeat wins, a non-number is
  flagged, 5000 is allowed and 5001 refused (vitest)
- [ ] `materialsQuery`: filters ⇄ URL ⇄ door, server paging (vitest)
- [ ] `tools/hungerstation-materials-drive.mjs`, against stubs, LTR and RTL:
  - list, filter, page;
  - change one with a reason;
  - import a paste and an xlsx, the preview, the answer with unknowns;
  - the refusals inline;
  - the menu entry hidden when `canManageCatalog` is false.
- [ ] typecheck, lint, test green

## Boundaries

oms-react only. Gate: `canManageCatalog`. Reuse the Deliverect catalog's import pieces (`material-list`)
where they fit rather than copying them.

## Done when

The helpers and the drive are green; the live check rides 557.

## Blocked by

- [551](551-an-hq-user-lists-onboards-and-edits-hungerstation-stores-with-a-reason.md)

(live: BackOffice 3035)
