---
status: done
spec: 590
blocked-by: 597
---

# 598 — The rest of campaigns runs on the shared controls

From spec [590](590-the-back-office-wears-the-dmsco-theme-spec.md) (map 580).

## What to build

**Migrate** the `campaigns (all but the workspace)` screens onto the shared controls (spec 590 §Shared controls). This is a
pure restyle: nothing about behaviour, arrangement, copy or density changes.

- **Fields** (text, number, date, search, select, textarea) move onto `Input` / `Select` /
  `Textarea`. A label, hint or error beside a field becomes `Field`. Any local `INPUT`-style
  constant in the area is replaced by the shared control, and the constant is deleted once the
  area no longer uses it.
- **Buttons:**
  - Icon-only buttons become `IconButton`.
  - Chips, toggles and tab bars become `Chip`.
  - Outlined look-alikes and buttons that carry a variant's colours become `Button`.
  - Text-style buttons that navigate take the link look.
- **Restyled in place:** one-offs, row or tile pickers, grid-cell actions and non-navigating text
  buttons are rewritten to tokens and the new radius, and listed in the ratchet's allowlist with a
  one-line reason.
- **Checkboxes and radios** stay native with `accent-color: var(--primary)`.
- **Untouched:** anything under `__prototype__`, and the printed facsimiles' ink.

583's inventory (`assets/583-control-inventory/`) lists every occurrence by file and bucket. Re-run
its script before and after, and paste both counts in the ticket.

## Spine reach

component/route (campaigns (all but the workspace)) · test

## Proof (→ `tdd` red-green cycles)

- [x] `dmsco-theme-drive` gains the heaviest campaigns (all but the workspace) screen(s): light, dark and RTL screenshots; every field labelled, every icon button named, role tokens resolved · flow (Playwright)
- [x] the area's existing drives stay green unchanged (colour checks are by role after 593) · flow (Playwright)
- [x] the lint ratchet shows `campaigns (all but the workspace)` at its allowlist (documented one-offs and pickers only) · lint gate

React Testing Library is still not installed (spec 083), so shared controls are proven through the
drive; verify via typecheck + drive.

## Boundaries

- **No new i18n keys,** except an accessible name an icon button was missing (add it in the
  feature's own namespace).
- **All rules stand:** logical Tailwind, bidi isolation, zero literals.
- **A restyle only.** If a screen seems to need a behaviour change, stop and write it under
  Open questions.
- **Runs AFK** (`/afk-loop`) once 597's pattern note exists.

## Done when

Every campaigns (all but the workspace) feature is at its allowlist, its drives are green, and the theme drive covers its heaviest screen.

## Blocked by

[597](597-the-campaign-workspace-runs-on-the-shared-controls.md)

## Comments

**2026-10-26 — built (branch `impl/590-598`).**

**Counts.**

| feature | ratchet before → after | 583 inventory before → after |
|---|---:|---:|
| campaigns/simulator | 17 → 1 | 21 → 5 |
| campaigns/promotions | 11 → 1 | 17 → 7 |
| campaigns/uploads | 7 → 3 | 9 → 5 |
| campaigns/sessions | 7 → 0 | 7 → 0 |
| campaigns/priority | 5 → 0 | 6 → 1 |
| campaigns/customers | 3 → 1 | 3 → 1 |
| campaigns/coupon-finder | 1 → 0 | 1 → 0 |
| **total** | **51 → 6** (= the allowlist) | **64 → 19** |

The 583 "after" count is what spec 590 keeps: 10 native checkboxes, radios and file inputs, plus the
6 allowlisted buttons. Links are not counted in either column. Before this ticket the area had
these local field styles: `RULE_INPUT` on 25 fields, Priority's `SELECT` constant, and hand class
strings on the promotions dialogs, the cancel reason, the review note, the uploads filters and the
group-name inputs. All of them are now `Input` / `Select` / `Textarea`. `SELECT` (priority) is
deleted. No feature in the area imports `RULE_INPUT` any more (606 deletes it).

What became what:
- **Labels above a field became `Field`.** Three local wrappers were rewritten:
  - Simulator's render-prop `Field`: deleted, and its call sites use the core one.
  - PromotionFormDialog's `Field`: renamed `PromotionField`, and its body renders the core `Field`.
  - CreateCampaignDialog's `NameField` and FromTemplate's `TextField` / `Placeholder`: their bodies
    render the core `Field`.
  
  Drive hooks moved onto `<span>`s inside `error` / `hint`: `data-create-problem`,
  `data-promotion-problem`, `data-template-problem`, `data-template-name-problem`,
  `data-review-note-required` and `data-session-cancel-reason-hint`. The cancel reason's counter
  line is the Field `hint`. Once Confirm has been tried it becomes the `error`, and the hook
  keeps its value (`''`, `required` or `tooLong`).
- **Label-beside layouts kept their label (597 Q1)** and only swapped the control: Priority's
  "Move to" `<label>` and the Read report's "Sheet" filter.
- **Search boxes:** the hand-built ones (Assign dialog, promotion campaigns, basket item search)
  are now `<Input type="search">`, and their `Search` icons are gone.
- **`IconButton`:**
  - Priority's move up/down (were ghost `Button`s with an `aria-label`).
  - Priority's group delete: `danger`, with `title` set only for the "holds campaigns" reason.
  - The basket line remove: `danger compact`.
  - The JSON drawer close: the hand `title` dropped, because it equalled the label.
- **`Chip`:**
  - The promotion campaigns' status and mechanic chips: the local `Chip` is deleted.
  - Three tab bars use `Chip variant="tab"` inside their existing `tablist`: the Create dialog's
    tabs, the session page's tabs and the simulator result's tabs. The underline bar's
    `border-b` went with the underline look.
- **`Button variant="outlined"`:** the basket's item-hit pills (the "matches a Button variant"
  bucket).

**Allowlist (6, restyled in place).**
- Customers: the member row picker.
- Promotions: the template tile picker. It is `aria-pressed`, but two lines tall, so it cannot be
  a `Chip`. `border-border/60` became `border-border`.
- Simulator: "Drop draft". Its `rounded` became `rounded-md`. See Q1.
- Uploads: the View and Compare grid-cell actions, and the danger panel's "View" text button. All
  three open the JSON drawer.

**Proof.**
- **Theme drive, screen `campaigns-rest`** (light, dark and RTL): 195/195.
  - Simulator: the sale's Fields, the item search, the hit Buttons, a priced basket line, and
    the result tab Chips after a run.
  - The no-promotion page: search plus status Chips.
  - Its Create dialog: tab Chips and the name Fields.
  - Priority: an added group's Input / Select, and the move and delete IconButtons.
  - Red first: with `src` stashed, light mode passed 35/65. It failed on 36px fields, the
    `border/60` edge, the `--background` ground, the underline tabs and non-square icon buttons.
- **Area drives** (stubbed, port 5598): `campaign-promotions` 284/284, `campaigns` 689/689,
  `campaign-uploads` 272/272, `priority` 50/50, `sessions` 73/73, `simulator` 71/71 and
  `support-lookups` 43/43. The first `campaigns` run timed out waiting for a workspace `[data-rules]`
  page while 6 other drives shared the machine. The retry was green. No drive was edited.
- `npm run lint` passes all 5 gates, `typecheck` is clean, and `npm test` passed 424 files /
  6728 tests.
- **`/campaigns/priority` crash in foundation-drive (597's note): fixed in the drive's stub.**
  `routeScreens` now answers `Rules/Authoring/Order` with an empty shaped tree
  (`{ versionNo: 0, tree: { groups: [], order: [] }, campaigns: [] }`). A scratch Playwright check
  with every other door answering `[]` showed the leaf crash before the fix (no `h1`) and render
  "Priority" after it. The full foundation drive (about 50 min) was not re-run.

**Open questions.**
1. **"Drop draft" (simulator).** It calls `navigate(simulatorPath(), { replace: true })`, which
   strips the draft from the address. It reads as an in-page dismiss (an X and text inside the
   draft note), so it was restyled in place rather than given the link look. Should it be
   `Button variant="link"`?
2. **Tab bars lost their underline rail.** The Create dialog, the session page and the simulator
   result had an underline tab bar on a `border-b`. They are now `Chip variant="tab"` pills with
   no bottom rule. Is that the intended look for a segmented tab bar?
3. **Sizes moved to the shared 28px/12px:**
   - The promotion dialogs, the Assign and campaign search boxes and the review note were
     `h-9 text-sm` (36px/14px).
   - The basket hits went from about 22px to 28px pills.
   
   Field error/hint text is `text-[11px]`, where it was `text-xs`. 597 accepted the same.
