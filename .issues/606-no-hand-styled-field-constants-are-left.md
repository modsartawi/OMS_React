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

### 2026-10-27 — Code review fixes (branch `impl/590-review`)

The code review of spec 590 at the integration tip `4bb436c1`. Each finding and what was done:

| ID | Finding | Done |
| --- | --- | --- |
| S1 | `controlWiring(useFieldWiring(), {…})` repeated in Input/Select/Textarea | One hook, `useControlWiring(own)` in `core/ui/field-control.ts`; `useFieldWiring` is gone. |
| S2 | `rounded-full` (buttons) vs `rounded-md` "follows the token" (fields) contradicted; two disabled strings | One rationale: every one-line control is `rounded-full`, so a `--radius` change cannot un-pill it; `--radius` shapes cards and panels. `LINE_CONTROL` is now `rounded-full` (same 14px corner at h-7 today, no visual change; no caller grows a line control). `control-classes.ts` exports `DISABLED`; the fields use it. Both comments rewritten to agree. |
| S3 | AddressForm's `LABEL` copy and hand-drawn search icons | `core/ui/Field` exports `FIELD_LABEL`, used by the two hand labels. `Input` gained `searchIcon` (the search icon on a non-search type): the city/district comboboxes keep `type="text"` (603's reason: no native clear button / Esc-clears) and drop the hand icon and `ps-8`. |
| S4 | `TemplateField`, `Question` pure pass-throughs | Inlined as `Field`; both helpers deleted. |
| S5 | Dead ratchet paths since 606 | Removed the unswept `ceiling` branch, `lowerable`, `lowerBaseline`, `formatBaseline`, `--init`, `--lower`. A feature with no allowlist now fails on ANY control and lists `file:line` of each. Tests updated (15), baseline header, `CLAUDE.md` and a note under 596's Comments. |
| S6 | Rail rows repeat hover + pill | `RAIL_HOVER` and `RAIL_ROW` beside `ACTIVE_PILL`; the eight rows use them. The two lockup links keep their own hover (no ink change on the artwork). |
| S7 | `className` on a wrapper only for search | `className` is always on the `<input>`; a new `wrapperClassName` sizes the search wrapper. All 24 `<Input type="search">` call sites moved `className` → `wrapperClassName` (by parser, not by hand), so nothing moves on screen. |
| S8 | Explicit `aria-invalid={false}` ignored inside an invalid Field | `controlWiring`: the control's own value wins, `false` included (renders no attribute). Red first in `field-control.test.ts`. |
| S9 | Hand copies of `buttonClass`; unisolated `trxNumber` | Loy Invoices' Resend and Retail invoice's Download are now `<Button variant="outlined">`; their allowlist lines are deleted (`loy/member` 2→1, `reports/retail-invoice` 1→0). The Download aria-label isolates `fsi(row.trxNumber)`; `invoice-drive` now matches the isolated number. |
| P1 | Raw fields left in core; ratchet scans features only | ReasonDialog, ImportDialog, AttachmentAdd, AttachmentWithdrawDialog, central-invoice `raise`, ReleaseLockDialog → `Field` + `Textarea`/`Input`; DiagnosisPanel's timeline filters → `Select`/`Input` (label-beside layout kept, 597 Q1). nphies `ListPager` → `Button outlined`; LookupPicks' chip remove → `IconButton danger compact`. The ratchet now also scans `src/core/**` minus `core/ui` (`core/<module>` blocks, red first in `control-ratchet.test.mjs`). Left by name with reasons: CommandPalette's borderless query line (one-off, the field look would draw a box in the box), the attachments slip-row picker, the bonus-buy detail's members pill and section disclosure, LookupPicks' hit rows. Ratchet: 39 features, 148 controls, all allowlisted. |
| P2 | Links copying the old outlined look | `buttonClass('outlined')`: PromotionPage's `LINK`, data-sync `ChangesLink`, the deposit slip links (collection inquiry), nphies "Open the refusal" and "Back to list"; `buttonClass('secondary')` (they sat on a ground): Material detail's Simulator link, nphies SubmitAct's two links; `iconButtonClass('outlined')`: the document header's back link. SettlementDoor's tab signposts are tiles with a count and stay. |
| P3 | `expectLabelled` passed aria-label-only fields | It now requires a real association (`el.labels` — `label[for]` or a wrapping label — or a resolving `aria-labelledby`). An aria-label-only field passes only when `ARIA_LABEL_ONLY` lists it for its screen, with why. **22 exemptions on 14 screens**: 9 search boxes / toolbar filters (601/604's placeholder-named boxes, pending the owner), 5 table/grid-cell fields under column heads, 8 composite rows (a bilingual pair, the time range's "to" half, the group rows, the basket line, the caller bar's numbers, the country-code picker, the min-value amount beside its checkbox, the store panel's select). Selectors are structural (RTL runs in Arabic); one data hook added (`data-bby-min-amount`). |
| P4 | A control with its own id inside Field broke `htmlFor` | The control claims its id through the Field context (`claimId`, a layout effect), and the label, hint and error ids follow it (`fieldControlId`: claimed ?? Field `id` ?? made). Red first in `field-control.test.ts`. |
| Drives | Assertions on looks the theme removed | `foundation-drive`: a `rad(page, expr)` helper resolves radii by role — Button a full pill at 28px, toasts `--radius`, the bell/store/chooser panels `--radius-lg`, the Modal and Save-view dialog `--radius + 2px`, toast buttons `--radius-md`, the bell tag `--radius-sm`, central-invoice textareas the shared Textarea's `--radius-lg`. Its screens stub now answers the sync console's objects (`ActionSync/Workers`, `Fleet/Summary`, `Fleet/LastHour`, paged `Fleet/Audit/Commands`): `/admin/sync` no longer crashes. `sim-process-drive`: the run controls are full pills. `bby-maintenance-drive` step 20: Max value is editable with its hint — **confirmed on main**: `120b8f1e` (2026-10-19, "Max value on Engine Rules is an ordinary editable field") is an ancestor of `6e39c3af` (the spec 590 commit). |

Not touched (owner rulings pending): the rail head's aria-label, the link-underline scope,
`BEFORE_THEME_ROWS=15`, the 1.6:1 pill floor, QueryToken's Limit invalid state, From/To labels,
601's search buttons, 602's danger edge, lens chip aria.

**Gates** (worktree `C:\Playground\oms-react-590-review`, Vite :5610; the tip in a scratch worktree on :5611):
- `npm run typecheck` clean; `npm run lint` 5/5 (ratchet 39 features / 148 controls); `npm test` 424 files / 6732 tests.
- `dmsco-theme-drive` full run, every screen, every mode: **2546/2555**, and the 9 misses were
  retried: `collection-assignment/dark`, `remaining-delivery-rails/light,dark` and
  `deliveries-filter/dark,rtl,expanded` (goto/selector timeouts under machine load) all pass on a
  re-run (`deliveries-filter` light/dark/rtl 84/84). Left: `deliveries-filter` in the three
  phone-drawer modes, the pre-existing failure 606 recorded.
- `foundation-drive` full: **1526/1558** (was 1450/1558 at 593). The 32 left are all categories 593
  recorded as pre-existing and not colour: granted-group sets (collapsed rail, drawer, tree heads),
  the top bar's controls, drawer navigation focus, header clipping on the two statistics grids, the
  time's count isolate. Every radius check and `/admin/sync` + `/campaigns/priority` pass.
- Area drives, review vs tip: campaigns 689/689, campaign-promotions 284/284, pick-support 290/290,
  dispatch-board 116/116, delivery-callout 96/96, geography 122/122, data-sync-changes 50/50,
  materials-detail 67/67, nphies-authorization-session 192/192, document-header 292/292 (crashed
  before 593), order-attachments 243/243, slip-withdraw 68/68, collection 264/264,
  callcenter-location 363/363, coupon-template-limits 22/22, loy-invoices 29/29,
  sim-process 51/51, bby-maintenance 210/210. Same as the tip (pre-existing): document-source-users
  74/76 (menu order), invoice 77/79 (Reports leaf), nphies-authorizations 119/121, central-invoice
  63/65, document-rtl 52/53 (593's isolate), nphies-eligibility (nav-leaf fail then crash at
  l.436, both), deliverect-stores (a lines-drawer `waitForFunction` timeout in both, at varying
  lines). The first runs of several drives timed out on `page.goto` under load and passed on a
  retry; bby-maintenance's 5c failed only against a Vite server that had served for hours and
  passed on a fresh one.
- Screenshot assets the foundation drive rewrote (`.issues/assets/391-shots/`) were checked back out.
