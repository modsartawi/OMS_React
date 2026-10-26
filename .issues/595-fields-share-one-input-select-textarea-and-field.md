---
status: open
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

- [ ] `dmsco-theme-drive` on the Deliveries filter: every field labelled and described; focus ring is --ring; invalid state announced · flow (Playwright)
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
