---
status: open
spec: 082
blocked-by: —
---

# 084 — theAppRendersOnThePosTokensInBothThemes

## What to build

Every colour in the application is declared once, in `global.css`, as hex — the POS steel-blue scale
in light and its derived dark twin — and every existing screen re-tints without a single `.tsx` edit.

This is the map's **palette-first** ruling made real: it must land before anything else in spec 082
and before the Document Details rework (spec 083) starts.

- **The light table** — spec 082 D-2, forty-five tokens. Nineteen existing names keep their role and
  change only their value; `--secondary` / `--secondary-foreground` flip role to carry POS `--key`;
  the rest are new (`--card-2`, `--ink-3`, `--border-strong`, `--divider`, the four severity families'
  `-050`/`-border`/`-800` tiers, the two `--fam-*`, `--prescription*`, `--secondary-press`).
- **The dark table** — D-4, derived by D-3's four rules, not chosen freehand. Neutrals hold the
  lightness ladder the app ships today and take only POS's temperature; chromatics lift to L .66–.76
  and **flip their ink**, so in dark every filled chromatic control is a light tonal fill with dark
  ink. `-050`/`-800` swap absolute lightness while keeping their roles — that is what makes one class
  string correct in both themes, and it is the mechanism ticket 088 depends on.
- **The brand pair** — D-9's `--brand-panel` `#202A34` + `--brand-panel-foreground` `#FFFFFF`,
  declared here and consumed by ticket 087. They are the **only** pair declared outside the `.dark`
  block with no dark counterpart; that structural oddity is the enforcement mechanism and must not be
  "tidied up".
- **The `@theme inline` bridge** — every new token that is consumed as a Tailwind utility needs its
  `--color-*` line, or `bg-success-050` simply does not compile. Declaring the token in `:root` is not
  sufficient. This is the half of the change most easily left half-done.
- **`--destructive` stays as `var(--danger)`** — a compatibility alias for its 14 existing call sites,
  not a rename.
- **The contrast gate** — `tools/check-contrast.mjs`, wired into `npm run lint` beside
  `check-boundaries.mjs`. It parses the `:root` and `.dark` blocks, recomputes WCAG relative
  luminance, and asserts D-4's measured pairs still clear their threshold. It is what turns a
  hand-measured table into something that stays true, and it is this ticket's proof.

**Verified before slicing:** all twenty-one current tokens are consumed purely as Tailwind utilities,
with exactly one `var()` read in the repo (`global.css`'s own `:focus-visible` rule, which needs no
change). Zero call-site churn is a measured property, not an aspiration.

**Two facts about the current file worth knowing before editing it:**

- Dark `--border` and `--input` are alpha values today (`oklch(1 0 0 / 10%)` and `/ 16%`). D-4 retires
  both in favour of solid hex with the same ΔL as light. That is deliberate, not an oversight.
- `global.css` already applies `font-variant-numeric: tabular-nums` to `.ag-cell` / `.ag-header-cell`
  / `[data-numeric]` app-wide. D-11 notes AG Grid does the same on `.ag-right-aligned-cell`; the app
  rule is broader and **stays**. Do not "fix" it as a duplicate.

## Spine reach

`global.css` tokens (light + dark + `@theme inline` bridge) · `tools/check-contrast.mjs` ·
`package.json` lint script. **No `.tsx`, no i18n, no API.**

## Proof (→ `tdd` red-green cycles)

- [ ] `contrastGateFailsWhenATokenDropsBelowItsThreshold` — the gate reports a `file:line` hit and
      exits non-zero when a token value is nudged; passes on the shipped table · pure (node script,
      the `check-boundaries.mjs` shape)
- [ ] `contrastGateRejectsWhiteInkOnADarkChromaticFill` — the **negative** assertion: white on any
      lifted dark fill is below AA. This is what stops a later reader "fixing" R2 by reverting
      `--primary-foreground` to white · pure
- [ ] Drive the app in **both themes** across a page from each area — Deliveries, a Document, Sim
      results, BBY Inquiry, ua-admin, the sidebar — and confirm nothing lost its surface separation,
      its hairlines, or its disabled reading. Verify via `typecheck` + drive; the vitest runner is
      not installed and this ticket does not bootstrap it.

## Boundaries

No API, no i18n, no nav change. **Status badges will still be warm after this ticket** — the raw
palette does not read tokens, and sweeping it is ticket 088. That intermediate state is expected and
is the reason 082 D-13 insists the sweep is a single pass rather than a per-area trickle.

New lint script joins the existing one; `npm run lint` runs both.

## Done when

`npm run lint` runs the contrast gate green, `npm run build` passes, and every screen in the app
renders on the steel-blue neutrals in both themes with no `.tsx` file modified by this ticket.

## Blocked by

None — can start immediately.

## Open questions

**`--secondary`'s revival is token-only.** Settled with the owner while slicing: D-2's revived
`--secondary` / `--secondary-press` / `--secondary-foreground` are declared here, but
`core/ui/Button`'s existing `secondary` **variant** (`border border-border bg-card hover:bg-accent`,
~30 call sites) is **not** changed to read them. Record the reservation in a comment beside the
tokens — they carry POS `--key` for a neutral *filled* button, which the app does not have yet —
so the next reader does not read the gap as an oversight and wire it up unasked.
