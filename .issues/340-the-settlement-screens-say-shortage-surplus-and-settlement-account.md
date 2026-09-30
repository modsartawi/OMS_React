---
status: done
spec: 334
blocked-by: —
---

# 340 — The settlement screens say Shortage, Surplus and Settlement Account

BackOffice spec 2149 D13; web spec 334 item 6. Web only. Owner, 2026-09-30: "I saw owed and owned, why not keep it surplus/short as before".

## What to build

One vocabulary on the web's settlement screens.

- The open-settlements tabs "Owing" and "Owed" become "Shortage" and "Surplus". Their empty states lose the owing / owed wording.
- The headline says Shortage and Surplus without "owed" / "owes" ("Shortage owed", "this branch owes head office" and the like are reworded).
- The menu entry and page title read "Settlement Account".
- The accountant's text is labelled "Description" everywhere; "Reason" is kept only for the rejection and cancel reasons.
- Kind labels read Shortage · عجز and Surplus · فائض.
- **Labels only.** Tab keys in the address (`?tab=owing`), code identifiers and wire fields may stay as they are, so saved links keep working. If a key is renamed, the old one must still resolve.
- Sweep the whole settlement locale file for owe / owed / owes / owing in user-facing strings, not only the ones named here.

## Spine reach

oms-react screen / wire model / vitest

## Proof (→ `tdd` red-green cycles)

- [x] `open settlements tabs are labelled Shortage and Surplus` · vitest — `src/features/collection/settlement/vocabulary.test.ts`
- [x] `no user-facing settlement string says owed, owes or owing` · vitest over the locale file — same file; walks every value in `src/locales/en/settlement.json`
- [x] `the old tab address still opens the shortage tab` · vitest — same file; `?tab=owing` still resolves to the key labelled Shortage, and shortages are still counted under it (likewise `?tab=owed` / Surplus)
- [x] `menu and title read Settlement Account` · vitest — `src/layout/menu-model.test.ts`

Driven as well (network stubbed at Playwright, vite on :5199): `tools/settlement-drive.mjs` 291/291, `settlement-approval-drive.mjs` 42/42, `settlement-supervision-drive.mjs` 41/41, `settlement-description-drive.mjs` 41/41. The drives' selectors and check titles were moved to the new labels; the settlement drive still opens the Surplus tab at `?tab=owed`.

Outstanding (not AFK's): nothing here was driven against a live SIS.Api. Wording decisions are logged in `.afk/HITL-340.md` for the owner to read.

## Boundaries

Web only. English locale only (Arabic appears inline where labels already carry it). No new dependency.

## Done when

Nobody reading the settlement screens has to work out who owes whom.

## Blocked by

None — can start immediately
