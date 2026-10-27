---
status: done
spec: 590
blocked-by: 596
---

# 597 — The campaign workspace runs on the shared controls

From spec [590](590-the-back-office-wears-the-dmsco-theme-spec.md) (map 580).

## What to build

**Migrate** the `campaigns/workspace` screens onto the shared controls (spec 590 §Shared controls). This is a
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

**Built by hand. This ticket sets the pattern** the AFK area tickets copy. Write the pattern down
under `## Comments` when done: which buckets went where, what landed in the allowlist and why, and
any snag. The workspace is the heaviest feature (92 controls, 56 of them fields, 52 already on a
shared constant).

583's inventory (`assets/583-control-inventory/`) lists every occurrence by file and bucket. Re-run
its script before and after, and paste both counts in the ticket.

## Spine reach

component/route (campaigns/workspace) · test

## Proof (→ `tdd` red-green cycles)

- [x] `dmsco-theme-drive` gains the campaign workspace: light, dark and RTL screenshots; every field labelled, every icon button named, role tokens resolved · flow (Playwright)
- [x] the area's existing drives stay green unchanged (colour checks are by role after 593) · flow (Playwright)
- [x] the lint ratchet shows `campaigns/workspace` at its allowlist (documented one-offs and pickers only) · lint gate

React Testing Library is still not installed (spec 083), so shared controls are proven through the
drive; verify via typecheck + drive.

## Boundaries

- **No new i18n keys,** except an accessible name an icon button was missing (add it in the
  feature's own namespace).
- **All rules stand:** logical Tailwind, bidi isolation, zero literals.
- **A restyle only.** If a screen seems to need a behaviour change, stop and write it under
  Open questions.

## Done when

The workspace is on the shared controls at its allowlist, its drives are green, the theme drive shows it in all three modes, and the pattern note is written.

## Blocked by

[596](596-the-lint-check-stops-hand-styled-controls-from-growing-back.md)

## Comments

**2026-10-26 — built (branch `impl/590-597`).**

**Counts.**

| | ratchet (`check-controls`) | 583 inventory: buttons | fields | total |
|---|---:|---:|---:|---:|
| before (integration tip `1f715cd3`) | 82 | 36 | 56 | 92 |
| after | 13 (= the allowlist) | 16 | 7 | 23 |

The 583 "after" row is what spec 590 keeps: 5 checkboxes + 2 file inputs (native), 13 allowlisted
buttons, and 3 `Link`/`NavLink`s of the workspace side menu ("link styled as button" — they already
navigate and are not on the ratchet). Before by bucket: 16 select, 17 text, 7 date, 3 number,
2 search, 4 textarea, 13 icon buttons, 4 chips/toggles, 3 variant look-alikes, 1 outlined
look-alike, 6 text buttons, 2 row pickers, 2 one-offs, 1 menu item, 1 grid-cell action. Every field
and icon button, every chip, the variant look-alikes and the outlined look-alike moved onto the
shared controls; `INPUT` (builder-ui), `SETTINGS_CONTROL`, `SETTINGS_INPUT` and `togglePill`
(settings-ui) are deleted.

**Proof.**
- Theme drive, screen `campaign-workspace` (light/dark/RTL; rule builder with a block panel open,
  Settings > Schedule, Coupons): 84/84 + the day-chip click checks. Red first: with `src` stashed
  the screen failed 12 checks (36px fields, `border/60` edges, `--background` ground, chips off
  the card ground). Full theme drive on this branch: 831/834 — the 3 fails are 595's
  `deliveries-filter` screen in the phone-drawer modes (a click times out), not this ticket's.
- Area drives (stubbed, port 5297): `campaigns-drive` 689/689, `coupon-import-delete-drive` 65/65,
  `coupon-import-file-drive` 30/30, `coupon-template-limits-drive` 22/22. `coupon-159-drive`
  99/103: its 4 fails (the loyalty signup half) are identical with `src` stashed — they come from
  before this ticket.
- `npm run lint` 5/5 (ratchet: `campaigns/workspace 13`, a 13-line allowlist), `typecheck` clean,
  `npm test` 424 files / 6728 tests.

**`/campaigns/priority` crash in foundation-drive (from 593): it is there before this branch, and the
theme did not cause it.** Root cause: foundation's
leaf walk (`routeScreens`) answers every door it doesn't know with `[]`, so `Rules/Authoring/Order`
gets `[]` instead of `{ tree, … }`, and `tidyOrder` (`priority/order.ts:96`) reads `.groups` of
`undefined`. It is the same on the root checkout (a main-based branch). `src/features/campaigns/priority` is
identical on main and on `spec/590-dmsco-theme`. The fix belongs to the drive's stubs (give
`Rules/Authoring/Order` a shaped answer), or to the page (guard a malformed answer). Neither is a theme
change, so neither is made here.

**Open questions.**
1. **Label-beside layouts keep their own helper.** Examples: `SettingsField`, BlockPanel's `FieldRow`,
   FilterEditor's grid. `Field` would move the label above, which is an arrangement change. Their hints
   are still not linked through `aria-describedby`, except where they already were. Should the shared
   `Field` grow a `layout="beside"` variant?
2. **ƒx toggle and coupon kind are restyled in place, not `Chip`.** The ƒx toggle is a disclosure
   (`aria-expanded`) with an open look, and the coupon kinds are `role="radio"` tiles. `Chip` would add
   `aria-pressed`, which is a semantic change. Should `Chip` get a radio/disclosure mode?
3. **Settings and dialog fields went from 36px/14px to 28px/12px** (the shared size from 595). The Coupons
   toolbar's `h-9` overrides on its Buttons and its batch chip went with them, so the row lines up
   again at 28px.

### The pattern (copied to `590-notes/597.md`)

This is the recipe tickets 598–605 follow. It assumes the shared controls of 594 (`Button`,
`IconButton`, `Chip`) and 595 (`Input`, `Select`, `Textarea`, `Field`), and the 596 ratchet. Read
`590-notes/594.md` and `595.md` for their APIs; this note says how to sweep an area with them.

#### 0. Before you start

1. `node tools/check-controls.mjs --list <area>/<feature>` for each feature in the area — the
   work list (`file:line tag (kind)`). This is what the ratchet counts; checkboxes, radios, file
   and hidden inputs are not on it and stay native.
2. Run 583's inventory for the BEFORE count (it needs a TypeScript 5 compiler API; it writes next to
   itself, so run a copy when you do not want its tables rewritten):
   `git archive <base> src .issues/assets/583-control-inventory/inventory.mjs package.json | tar -x -C <tmp>`
   then `node <tmp>/.issues/assets/583-control-inventory/inventory.mjs`, and read the feature's row
   in `<tmp>/.issues/assets/583-control-inventory/inventory.md` (`| <feature> | buttons | fields | total | … |`).
   For AFTER, copy the worktree's `src` + `package.json` + the script into another tmp dir the same way.
3. `grep` the area for its local constants: `INPUT`, `inputCls`, `SETTINGS_*`, `togglePill`,
   `*_CONTROL`, `btn = '…'`. In the workspace they were `INPUT` (= core `RULE_INPUT`, in
   `builder-ui.tsx`), `SETTINGS_CONTROL`, `SETTINGS_INPUT`, `togglePill` (in `settings-ui.tsx`),
   and a per-component `btn` string for icon buttons. All four were deleted at the end.

#### 1. Fields (mechanical first, then by hand)

A first pass can be scripted per file (it was, and it was safe):
- `<select` → `<Select`, `</select>` → `</Select>`; `<textarea` → `<Textarea`.
- `<input` → `<Input` **unless** its `type` is `checkbox | radio | file | hidden`.
- Add `import Input from '@/core/ui/Input'` (etc.) after the last import.

Then, by hand, the `className` of every swapped field:
- Keep **only layout/typography**: `w-*`, `max-w-*`, `min-w-*`, `flex-1`, `font-mono`,
  `font-semibold`, `text-end`, `tabular-nums`. A local constant that carried a width
  (`SETTINGS_INPUT` had `w-full max-w-md`) keeps that width in the caller.
- **Drop** `h-*`, `rounded-*`, `border*`, `bg-*`, `px-*`/`ps-*` (search icon padding), `text-sm/xs`,
  `focus:*`, `outline*`, `disabled:*`, and every conditional `border-danger*` toggle.
- **Invalid is `aria-invalid`.** Where the old code painted `border-danger-border` on a problem, the
  control either already had `aria-invalid={problem ? true : undefined}` (keep it) or gets it via a
  `Field error` (below). Never a colour class.
- A hand-built search box (`<label className="relative">` + absolutely positioned `<Search>` +
  `ps-7/ps-8`) → `<Input type="search" className="w-full …" />`; delete the icon and its wrapper,
  and the now-unused `Search` import. `className` on a search Input lands on the wrapper span.
- Sweep whitespace-only lines a scripted `className` removal leaves behind (`sed -i '/^[ \t]\+$/d'`).

### Labels: when to use `Field`, when not

`Field` renders label ABOVE the control, then hint, then error (`flex-col gap-1`). Use it only where
the screen already had that arrangement — it is a restyle, the arrangement must not change:

| Today | Becomes |
|---|---|
| `<div flex-col><label htmlFor>…</label><control/>{problem && <p id>…}</div>` | `<Field id label error hint>`; delete the hand ids, `aria-describedby`, `aria-invalid` |
| a local wrapper component of that shape (`Field`, `Question`, `CopyField`) | keep the wrapper's call sites; its body renders the core `Field`. Rename a local `Field` (`CouponField`, `CopyField`) so the core one can be imported |
| `<label>text<control/></label>` (implicit label, label above) | `<Field label>` (+ `className="min-w-60"` for the old label's width) |
| a label BESIDE the control on a two-column grid (`SettingsField`, `BlockPanel`'s `FieldRow`, `FilterEditor`) | **keep the layout helper and its `htmlFor`**; only the control inside is swapped. `Field` would move the label above |
| a control with only `aria-label` (inline, no visible label) | keep the `aria-label` on the shared control; no Field |

Error/hint text that a drive reads by `data-*` hook: put the hook (and any `role="alert"`) on a
`<span>` INSIDE the Field's `error`/`hint` prop — `error={problem ? <span role="alert" data-coupon-problem={problem}>…</span> : undefined}`.
The Field's error colour is `text-danger-800` (was `text-danger` in places) — accepted.
`hint` must be `undefined`/`null` when absent — coerce `cond && <x/>` with `|| undefined`, or Field
renders an empty hint paragraph.

#### 2. Buttons — the bucket map, as applied

| Found | Became | Workspace examples |
|---|---|---|
| icon-only `<button>` (lucide child, `aria-label`) at `p-1` + 16px icon | `IconButton` default (h-7) | drawer/palette close, schedule Clear, rule-card chevron (`aria-expanded`/`aria-controls` pass through) |
| icon-only at `p-1` + 14px icon in a dense row/card | `IconButton size="compact"` | move up/down, budget edit |
| remove/delete/X icon | `IconButton variant="danger"` (+ `compact` when dense) | budget delete, block delete, bundle remove, value delete |
| bordered icon trigger | `IconButton variant="outlined"` (`ref`, `aria-haspopup`, `aria-expanded` pass through) | campaign actions menu |
| `aria-pressed` toggle pill (`togglePill(on)`) | `Chip on={…}` — drop `type`, `aria-pressed`, className | audience toggles, weekday chips |
| segmented "tab" group that uses `aria-pressed` + `role="group"` | `Chip` (toggle, not `variant="tab"` — it has no tablist); container `inline-flex gap-1` replaces the bordered segment | ƒx helper's Fields/Functions/Recipes |
| small bordered keys with text | `Button variant="outlined"` (+ `font-mono`) | ƒx operator keys |
| dashed/bordered "Add …" tile | `Button variant="outlined"` | budgets' Add per scope |

- **`IconButton` makes `title` = `label`** unless you pass `title` — drop a hand `title` that equals
  the `aria-label`; pass `title` when it says something else (e.g. why a delete is disabled — pass
  `title={inUse ? reason : undefined}` and the label shows otherwise).
- `disabled` stays `disabled` when there was no reason given. Don't introduce `aria-disabled` in a
  sweep unless the button already gave a reason.
- A per-component `const btn = '…'` string used only by icon buttons is deleted.
- **Name clashes:** a feature may already have a component or TYPE called `Chip`/`Field`. Rename the
  local component (`OperatorKey`, `CouponField`), or import the shared one under another name when
  the local name is a domain TYPE (`import UiChip from '@/core/ui/Chip'` in `FxHelper.tsx`, where
  `Chip` is the formula-chip type).

#### 3. Restyled in place → the allowlist

What stays a lowercase `<button>`, rewritten to tokens and the new radius (`rounded` / `rounded-sm`
on a control → `rounded-md`, which follows `--radius`; a pill-shaped one-off → `h-7 rounded-full`;
`border-border/60` → `border-border`; on-state `border-primary-border` → `border-primary`):

| Kind | Workspace example | Why not a shared control |
|---|---|---|
| row picker (a sentence/row that opens its editor or navigates in-page) | budget sentence, block sentence, filter chain, check row, ƒx field row | spec 590: pickers restyle in place |
| tile picker | palette block, coupon kind | ditto; coupon kind is `role="radio"` — `Chip` would add `aria-pressed` to a radio |
| menu item | actions menu item | spec 590: menu items sit on the overlay recipe |
| grid-cell action | coupon batch id | spec 590 |
| text button that does NOT navigate | rule card "Add list" | 594: `link` is for navigation only; `text` is the dialog-footer variant |
| one-off: severity-toned status pill | Checks pill (`h-8` → `h-7`) | carries a severity tone, no Button variant |
| one-off: disclosure with an open look | ƒx toggle (`aria-expanded`) | `Chip` would add `aria-pressed` (a semantic change); restyled to `h-7 rounded-full`, tokens kept |
| one-off: menu disclosure among NavLinks | workspace menu's Settings entry | arrangement belongs to the side menu |

Then the baseline (`tools/control-baseline.txt`): replace `<feature> <n>` with the count of what is
left and ONE indented line per control: `  <repo path> button: <reason>` — two controls of one tag
in one file are two lines. Take path + tag from `--list`. Touch only your feature's block; keep the
blank line between blocks. `node tools/check-controls.mjs` must say "none above the baseline".
A feature that ends at zero: `node tools/check-controls.mjs --lower <feature>` → `<feature> 0`.

Links styled as buttons (`<Link>`/`<NavLink>`, 583's "link styled as button" bucket) are NOT on the
ratchet and were left as they are (they already navigate; the workspace side menu's three).

#### 4. The theme drive

`tools/dmsco-theme-drive.mjs`, block "597" (just above `// --- run`). Copy its shape for an area:
- **Stubs:** a `<AREA>_STUBS` array of `[pathRegex, data | (path, request) => data]`. 597 taught
  `routeApi` to hand the stub the Playwright request, so a POST door can answer by body
  (`bodyOf(req).campaign`). Reuse the area's own drive fixtures module
  (`tools/campaigns-fixtures.mjs` here) rather than inventing data; find the doors a page calls by
  logging requests once (`page.on('request')`) — the workspace needed `Rules/Authoring/Promotions/Campaigns`,
  which its page calls on open, besides the obvious `Drafts/Load`.
- **Modes:** `modes: (m) => ['light','dark','rtl'].includes(m.key)` — the ticket's three.
- **One screen, several pages:** `ready` opens the first page; `assert` visits the others with
  `openWorkspacePage(page, path, hook)` (goto, wait for hook, fonts, mouse parked, 300ms) and takes
  `<screen>-<part>-<mode>.png` shots per page.
- **Checks per page:** `expectLabelled(scope fields)`, `expectAllFieldsShared(ctx, label, scope)`
  (597's helper: every visible text-like field in the scope paints `--input` edge on `--card` — the
  sweep's "no local constant left" proof), `expectFieldLook` + `expectFocusRing` on one field,
  `expectIconButtonsNamed(ctx, label, scope, min)`, `expectChipLook` on a chip both off and — after
  clicking it, `mouse.move(0,0)` and 400ms — on, then `expectAllPills` on the chip set.
- **Red first:** `git stash push -- src`, run `SCREENS=<your screen> MODES=light`, see it fail on the
  old look (36px height, `border/60` edge, `--background` ground), `git stash pop`, run green. Vite
  HMR picks up both.
- Run on your own port: `npx vite --port <p> --strictPort`, `DRIVE_PORT=<p>`.

#### 5. Snags met

- **Size:** settings/dialog fields were `h-9 text-sm` (36px/14px); the shared controls are 28px/12px.
  Accepted (595 set it); nothing else moved.
- No `cn`: never fight the control's own utilities from `className` (e.g. the old `h-7 text-xs` on a
  `MatchSelect` is now simply dropped).
- Python edit scripts piped through a bash heredoc mangle `\n` escapes — write the script with the
  Write tool and run it, or use Edit.
- Colour-pinning drives red before 593 merges are expected; note, don't fix.
- Look for local overrides that matched the OLD field height (`className="h-9"` on Buttons, an
  `h-9` chip in the same toolbar). Remove them, or the row stops lining up at 28px.
- Colour checks follow 593: resolve the role token on the live page and compare it
  (`expectRole` / 593's `tok()`). Never pin a value.
- A drive that fails: run it again with `src` stashed before you call the failure yours.
  `coupon-159-drive`'s 4 loyalty fails, and the theme drive's `deliveries-filter` fails in the
  drawer modes, were already there before this ticket.
