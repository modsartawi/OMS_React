---
status: done
spec: BO 3126 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3126-oms-react-insurance-rules-brief.md); owner ask 2026-10-29
blocked-by: 610
---

# 655 — An item list's field takes a column of codes pasted from Excel

## What to build

On the Lists screen's item-list editor (610), each field row gets a **Paste codes** button next to its codes. It
opens the paste box Bonus Buy Maintenance already has (420's Paste materials): paste a column or row from Excel,
or codes separated by commas, spaces or new lines. The box says how many codes it adds and how many it skips
(already in the field, or repeated in the paste); OK adds them to the field in pasted order.

The owner's ask (2026-10-29): target a group of items the way Bonus Buy does, by pasting a list. With an
**Item number** field in the registry (`ItemInfo.ItemNumber`, added on the Fields screen — no release), a list
can then be "Item number is any of <pasted column>", combined with or taken out of category lists. Preview
already reports the codes no item has.

The paste box moves to `@/core/ui/PasteCodesDialog` (a feature may not import another); Bonus Buy's
`PasteMaterialsDialog` is now that box in its own words, and `pastedMaterials` is core's `pastedCodes`.

## Spine reach

ui · test

## Proof (→ `tdd` red-green cycles)

- [x] `pastedCodes`: an Excel column in pasted order, once each, skipping what the target holds (`code-list.test.ts`)
- [x] lists drive step 2, LTR + RTL: the box counts 2 to add and 2 skipped; the pasted codes join the field in order
- [x] Bonus Buy Maintenance drive unchanged: 233/233 (its 19b paste steps included)

## Boundaries

No backend change: the item-list filter already holds any codes; the registry already takes any `ItemInfo` column
as a field. Rules: `feature-structure`, `i18n-zero-literal` (EN + AR, Arabic's six plural forms), `bidi`.

## Done when

An item list's field can be filled from a pasted Excel column, in English and Arabic, and Bonus Buy's paste still works.

## Comments

- 2026-10-29: built. typecheck, lint and 195 unit tests pass; lists drive 202/204 — the two reds are 4b "a new
  class list is POSTed … and opened", which also fails without this change (the flake 618 noted); bby drive 233/233.
