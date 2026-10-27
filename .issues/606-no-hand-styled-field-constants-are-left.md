---
status: done
spec: 590
blocked-by: 598, 599, 600, 601, 602, 603, 604, 605
---

# 606 — No hand-styled field constants are left

From spec [590](590-the-back-office-wears-the-dmsco-theme-spec.md) (map 580).

## What to build

**Contract**, after every area is swept.

- **Delete the remaining local field constants** (the `INPUT` copies) and core's `RULE_INPUT`,
  once nothing references them.
- **`BrandMark`:** check whether anything outside the shell still uses it (favicon, print headers).
  Delete it if nothing does; otherwise note the remaining use and keep it.
- **Tighten the ratchet:** every feature's baseline equals its documented allowlist, and the
  baseline file records the reason for each allowlisted control.
- **Re-run 583's inventory** and record the before and after totals in the ticket.

## Spine reach

component (shared UI) · test (lint gate)

## Proof (→ `tdd` red-green cycles)

- [x] typecheck + all five lint gates green after the deletions · lint gate (and `npm test` 424 files / 6730 tests)
- [x] `dmsco-theme-drive` full run (every area's screens) green in all three modes · flow (Playwright) — 2761/2770; the misses are pre-existing or environmental (see Comments)

React Testing Library is still not installed (spec 083), so shared controls are proven through the
drive; verify via typecheck + drive.

## Boundaries

- **No behaviour change.**

## Done when

No local field constant remains, the ratchet equals the allowlist everywhere, and the full theme drive is green.

## Blocked by

[598](598-the-rest-of-campaigns-runs-on-the-shared-controls.md), [599](599-the-oms-screens-run-on-the-shared-controls.md), [600](600-the-pricing-screens-run-on-the-shared-controls.md), [601](601-the-admin-screens-run-on-the-shared-controls.md), [602](602-the-collection-screens-run-on-the-shared-controls.md), [603](603-the-call-center-console-runs-on-the-shared-controls.md), [604](604-the-nphies-and-reports-screens-run-on-the-shared-controls.md), [605](605-the-remaining-areas-run-on-the-shared-controls.md)

## Comments

**Built 2026-10-27 on `impl/590-606`.**

- **Field constants.** Only two were left after 598–605: core's `RULE_INPUT`
  (`src/core/rules/LookupPicks.tsx`) and a local `FIELD` in `src/core/pick-support/FixDialog.tsx`.
  Both are gone. LookupPicks' search is now `Input type="search"` (it brings its own icon; the
  icon moves 2px, start-2 → start-2.5). FixDialog's reason/reference are `Textarea` / `Input`
  (the shared 12px field look replaces the old 14px one). No feature held an `INPUT` copy any more.
- **BrandMark: kept.** No favicon (`public/favicon.svg` stands alone) and no print header uses it,
  and the shell does not use it. Its one remaining use is outside the shell: `src/app/HomePage.tsx`
  (the 44px mark on the home page). So it stays in `core/ui` for that one use.
- **Ratchet tightened** (`tools/control-ratchet.mjs`, red-green in `control-ratchet.test.mjs`, 18 tests):
  1. an allowlist line with no reason is a baseline error;
  2. a feature with a non-zero ceiling and no allowlist is a baseline error, so every feature is swept;
  3. a swept feature that holds *fewer* controls than its allowlist names fails, so a stale line
     must be deleted along with its control. The baseline now equals the allowlist exactly.
  No reasons were missing: all 145 allowlisted controls in 36 features already had their reasons
  from 597–605. The header comments in the baseline file and the CLI are updated.
- **Inventory (583's `inventory.mjs`, `src/features/**/*.tsx`, re-run, assets not overwritten):**

  | | 583 (before, 2026-10-26) | after 606 |
  | --- | ---: | ---: |
  | `<button>` | 419 | 196 |
  | `<input>` (incl. native checkbox/radio/file) | 384 | 105 |
  | `<select>` | 123 | 0 |
  | `<textarea>` | 36 | 0 |
  | button buckets (incl. button-styled links) | 435 | 213 |
  | field buckets | 543 | 105 (46 checkbox/radio, 15 file) |
  | shared `<Button>` | 552 | 684 |
  | ratchet-counted (excl. native kinds and `__prototype__`) | — | 145, all allowlisted |

  The rest of the 196 buttons sit in `callcenter/__prototype__`, which the ratchet does not count. 606
  touched only core, so the feature totals before 606 equal those after it.
- **Drives on the quiet machine (branch tip, port 5606):**
  - `deliveries-list-drive` (599/595's leftover): **362/362**.
  - `deliverect-orders-drive` (605's leftover): **91/91**.
  - `campaigns-drive` (LookupPicks callers): **689/689**.
  - `pick-support-drive` (FixDialog): **290/290** on a retry. The first run crashed at test 2's
    `omsLinks`, before any fix dialog opened ("Execution context was destroyed … navigation").
    That is a timing race in the drive, not this change.
  - **`dmsco-theme-drive`, full run (every screen, every mode): 2761/2770, 1 skipped.** Nine misses, none from 606:
    - `deliveries-filter` in the three phone-drawer modes (`drawer`, `dark-drawer`, `rtl-drawer`):
      `locator.click` times out opening a criterion at 400px. **Pre-existing:** the same three fail
      on the untouched integration tip 737ed01b (scratch worktree, `SCREENS=shell,deliveries-filter`
      310/313). The light, dark and RTL desktop modes pass.
    - `shell/dark` (6 checks): the page had not painted (no header or rail) after a slow load.
      **Environmental:** in three re-runs on this branch, one `page.goto` timed out (30s, on the
      `load` event) in a different mode each time (`dark-expanded`, `light`, `dark-expanded`), and
      every shell mode passed in at least one run. The tip run of shell was clean. Neither file
      606 changed is on the shell page.

**Open questions.**
1. **Core still holds raw fields that the ratchet doesn't scan** (it reads `src/features/**` only).
   They are not named constants, so they were out of scope here: `core/attachments/AttachmentAdd`
   (input), `AttachmentWithdrawDialog` (textarea), `core/central-invoice/raise` (textarea),
   `core/commands/CommandPalette` (input), `core/dispatch/ReleaseLockDialog` (textarea),
   `core/import/ImportDialog` (textarea), `core/pick-support/DiagnosisPanel` (select + input) and
   `core/reason/ReasonDialog` (textarea). Should a follow-up sweep these and widen the ratchet to `src/core/**` (minus `core/ui`)?
2. **BrandMark on the home page** is still the al-dawaa gold mark. Should HomePage get the DMSCO
   lockup too, so BrandMark can be deleted?
