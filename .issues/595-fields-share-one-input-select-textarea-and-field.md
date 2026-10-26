---
status: done
spec: 590
blocked-by: 591
---

# 595 — Fields share one Input, Select, Textarea and Field

From spec [590](590-the-back-office-wears-the-dmsco-theme-spec.md) (map 580).

## What to build

**Expand.** The field side of 588's mixed plan.

- **New shared controls,** styled once from tokens: pill at h-7, `--input` edge, `--ring` focus,
  disabled and invalid states.
  - `Input` covers text, number, date and search. Search carries a leading icon.
  - `Select` wraps the native select. Native `<option>` stays, a string-only sink under the bidi
    rule.
  - `Textarea` keeps a rounded rectangle, not a pill.
  - `Field` takes a label (linked through `htmlFor`/`id`), an optional hint, and an error linked
    through `aria-describedby`.
- **Core's `RULE_INPUT`** (51 uses) is re-pointed at the shared look, so its callers restyle at
  once. Its removal is 606's.
- **Proven on one form:** the Deliveries filter panel moves onto these controls.

## Spine reach

component (shared UI: Input, Select, Textarea, Field) · component/route (Deliveries filter) · test

## Proof (→ `tdd` red-green cycles)

- [x] `dmsco-theme-drive` on the Deliveries filter: every field labelled and described; focus ring is --ring; invalid state announced · flow (Playwright)
- [ ] Deliveries list drives green unchanged · flow (Playwright)

React Testing Library is still not installed (spec 083), so shared controls are proven through the
drive; verify via typecheck + drive.

## Boundaries

- **No i18n.** Labels and hints come from the callers' existing keys.
- **No value is formatted inside the controls,** so the bidi rule stays with the callers.

## Done when

The Deliveries filter runs on the shared field controls, RULE_INPUT callers render the new look, and drives stay green.

## Blocked by

[591](591-the-app-wears-the-dmsco-palette-in-light-and-dark.md)

## Comments

**2026-10-26 — built (branch `impl/590-595`).**

- **API** (`src/core/ui/`, default exports like `Button`): `Input`, `Select`, `Textarea` take every native
  prop (React 19 `ref` included); `Field` = `{ label, hint?, error?, invalid?, id?, hideLabel?, className? }`
  around ONE shared control. Wiring is by context (`field-control.ts`): the control takes the Field's id
  (label `htmlFor`), `aria-describedby` (hint then error, merged with its own) and `aria-invalid`; a nested
  Field re-wires (a range = two Fields). Invalid IS `aria-invalid` → `aria-invalid:border-danger` (a
  variant, so it beats the resting edge whatever Tailwind's order). `type="search"` adds a leading icon and
  then `className` sizes the wrapper. Line controls are `h-7 rounded-md` (= a pill at 28px, following
  `--radius`); Textarea `rounded-lg`. No i18n, no value formatting inside the controls.
- **RULE_INPUT** = `${LINE_CONTROL} px-3`: its callers moved from `h-8 text-sm`, `border-border/60` on
  `--background` to the shared 28px / 12px pill on `--card`. 606 still deletes it. Checked the callers'
  extra classes: `h-auto` still beats `h-7`; FromTemplate's `border-danger-border` would LOSE to
  `border-input` but that input already carries `aria-invalid`, so it shows the danger edge.
- **Deliveries filter** (the query bar's token popovers): every control on `Select`/`Input` inside one
  `Field`; Limit's hint is the Field hint (now `aria-describedby`); Custom date's From/To became visible
  labelled Fields (were `aria-label` only), each invalid while empty; Limit is invalid outside 1–20000
  whole rows (`limitIsInvalid`, pure, tested). Popover controls 26px → 28px, label 11px → 12px.
- **Results:** `npm test` 419 files / 6574 tests green (new: `field-control.test.ts`, `limitIsInvalid`);
  typecheck + lint (4 gates) green; `dmsco-theme-drive` 213/213 (new screens `deliveries-filter` — labelled,
  described, `--input`/`--card`/28px/pill, `--ring` focus, invalid announced + `--danger` edge, light/dark/RTL
  — and `rule-input` on the Coupon finder).
- **Snag — Deliveries list drive not proven green.** Three runs on a machine at 100% CPU (sibling agents)
  failed at three different AG Grid timing points (184/10, 199/4, 176/1, each then crashing on a row-click
  timeout); a baseline run of the untouched tip could not even load the page. **None of the failures was in
  the query bar** (setCriterion / tokens / popover checks all passed). Needs one run on a quiet machine.

