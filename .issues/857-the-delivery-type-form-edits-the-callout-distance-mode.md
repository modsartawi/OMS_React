---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\3460-a-qc-callout-measures-its-radius-by-road-spec.md
blocked-by: BackOffice 3471
---

# 857 — The delivery-type form edits the callout distance mode

## What to build

In the delivery-type form under doc-type-config, add a **Callout distance** select beside the radius and wider-radius
fields. Its values are Off / Shadow / On, read and saved through BackOffice 3471's admin door. Each value has a short
helper line in English and Arabic:

- **Off:** straight line.
- **Shadow:** measure by road, but decide by straight line.
- **On:** decide by road.

The pure form module validates the value against the three codes. The server stays the authority, and its
bilingual refusal is shown as the form already shows refusals.

## Spine reach

UI (form, types, locales) → web API client → SIS.Api (3471)

## Proof (→ `tdd` red-green cycles)

- [x] `delivery-type-form.test.ts`: the mode round-trips, and an unknown value is refused by the pure module
- [x] Both locale files carry the three labels and their helpers

## Boundaries

oms-react only. 🚩 Do not deploy before BackOffice 3471.

## Done when

The proof tests are green and the field edits the mode on staging.

## Blocked by

BackOffice 3471

## Comments

**2026-11-08 — built against BackOffice branch `spec3460` (e9988aba7), not yet merged or deployed.** The wire names
are real, not guessed: `calloutDistanceMode` on `SdDeliveryDocumentTypeSettings` holds `OFF` | `SHADOW` | `ON`. A
refusal comes back on field `CalloutDistanceMode` with `SDC-00053` (`DeliveryTypeValueInvalid`) and a bilingual
message, which the dialog shows on the field like every other refused setting.

- **Pure module** (`delivery-type-form.ts`): `CALLOUT_DISTANCE_MODES`, plus `calloutDistanceMode()`, which trims and
  upper-cases a held value as the server's `Code()` does. `setDeliveryField` refuses anything else and leaves the
  draft unchanged. The field sits in the callouts group right after the wider radius.
- **Ruled:** a blank value (a type 3471's migration has not reached) reads as Off, the column's default. The select
  shows it as Off, and picking Off there is no change in the diff, so no write is sent. An unknown held value stays
  visible as its raw code, so opening the form never changes it behind the user.
- **Dialog:** a core `Select` (no hand-written control). Under it is the helper line for the current mode. The detail
  page and the diff show the mode's label in words.
- `maxLength: 10` on the def is nominal. The select never takes free text, and the column width was not checked.
- **Owed:** the staging check that the field edits the mode, once 3471 is on the host. 🚩 Don't deploy before
  BackOffice 3471 ships.
- **Review fixes (2026-11-08):** a copy sends a blank mode as `OFF` (BO validates every rule on a copy; an edit's untouched blank is excused, so save is unchanged); a host that sends no mode (before 3471) shows the field disabled with a not-available helper, and the detail says so; an unknown held code is `fsi()`-isolated in its native option; Arabic Shadow is "وضع الظل".
