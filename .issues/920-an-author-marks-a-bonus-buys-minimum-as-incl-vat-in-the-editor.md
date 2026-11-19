---
status: done
spec: BackOffice 4040
blocked-by: BO 4043
---

# 920 — An author marks a bonus buy's minimum as incl. VAT in the editor

## What to build

The bonus-buy maintenance editor's buy panel gets an **"incl. VAT"** checkbox (EN/AR) beside the minimum-value field.
Its rules:

- It is off on a new bonus buy.
- It is enabled only while the minimum is on and has a value. Turning the minimum off clears it.
- It is read-only on a Tested or Activated bonus buy, like every other field.
- It maps to `minValueInclVat` on the request and back from the document, and copies with the bonus buy.

The server refusal while HQ's switch is off (BackOffice 4043) is shown like any other validation refusal.

Spec: `C:\Work\DMSCO\BackOffice\.issues\4040-a-bonus-buys-minimum-value-can-be-including-vat-spec.md`.

## Spine reach

UI (editor state, request mapping, buy panel)

## Proof (→ `tdd` red-green cycles)

- [x] new editor state has the mark off; `toRequest` sends `minValueInclVat: false` · `bonus-buy-maintenance/editor.test.ts`
- [x] the mark is enabled only with the minimum on, and turning the minimum off clears it · `editor.test.ts` (`buyPanelLayout`)
- [x] round-trip: a document with `minValueInclVat: true` loads into the state and maps back to true · `editor.test.ts`
- [x] read-only on Tested/Activated · `editor.test.ts`

## Boundaries

Needs BackOffice 4043's contract (`minValueInclVat` on the request and the document).

## Done when

The Proof tests are green, and a stubbed drive shows the checkbox's states and the switch-off refusal.

## Blocked by

BackOffice [4043](C:\Work\DMSCO\BackOffice\.issues\4043-an-authored-bonus-buy-marked-incl-vat-prices-on-that-basis-through-the-host-repository-and-the-simulator.md)

## Comments

- 2026-11-19 (`/implement-spec`): **done, stubbed** on branch `spec/4040-min-incl-vat` (2eed2f82; review fixes 6e891ebe), not merged to main. BackOffice 4043 is still open, so the live walk is owed once it ships. Drive `tools/bby-maintenance-drive.mjs` 249/249 (stubbed).
  - Guessed contract: `minValueInclVat?: boolean` on the bonus-buy wire; absent reads as off. Refusal code `BBY-MIN-INCL-VAT-OFF` exists only in the drive stub; the client shows the server's EN/AR refusal as-is.
  - The mark is enabled only with the minimum ticked **and** an amount above 0 (the ticket's rule; the spec only says "minimum on"). It clears whenever the amount stops being positive, and `fromDocument` reads it off when the minimum is 0. So a mark with no minimum is sent as `false` and never reaches the server's zero-minimum refusal.
  - **AR deferred:** `bonus-buy-maintenance` has no `src/locales/ar/` namespace (pre-existing), so "incl. VAT" is EN-only until that namespace exists.
  - Copy happens on the server (`BonusBuy/Copy`); no client work.
