---
status: done
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

- [x] `contrastGateFailsWhenATokenDropsBelowItsThreshold` — the gate reports a `file:line` hit and
      exits non-zero when a token value is nudged; passes on the shipped table · pure (node script,
      the `check-boundaries.mjs` shape)
      · **Verified red-green**: nudging `--muted-foreground` `#586674`→`#9AA6B2` produced 3 hits
      (2.48 / 2.31 / 2.20:1 on card / background / muted) at `global.css:75`, exit 1; restoring the
      shipped value returns green. 117 pairs measured across both themes.
- [x] `contrastGateRejectsWhiteInkOnADarkChromaticFill` — the **negative** assertion: white on any
      lifted dark fill is below AA. This is what stops a later reader "fixing" R2 by reverting
      `--primary-foreground` to white · pure
      · **Verified red-green**: reverting dark `--primary-foreground` to `#FFFFFF` produced 5 hits
      (2.54–3.35:1 across `--primary`, `--success`, `--danger`, both `--fam-*`), exit 1. Guarded
      twice over — the positive pairs catch the revert, and 9 explicit `below-AA` assertions catch
      a fill lifted out of R2's band from the other direction.
- [x] Drive the app in **both themes** across a page from each area — Deliveries, a Document, Sim
      results, BBY Inquiry, ua-admin, the sidebar — and confirm nothing lost its surface separation,
      its hairlines, or its disabled reading. Verify via `typecheck` + drive; the vitest runner is
      not installed and this ticket does not bootstrap it.
      · **Driven** via the new `tools/palette-drive.mjs` (Playwright, borrowed as `screen1-smoke.mjs`
      does), against a live SIS.Api. 29/29 checks. It reads computed styles back out of the painted
      DOM, which is the only way to catch a token that parses but never reaches the screen: all
      45 tokens resolve to their D-2/D-4 values in both themes, and all 27 new utilities compile.
      Screens: login, Deliveries, Sim results, BBY Inquiry, ua-admin, Active Sessions, home, sidebar.
      · **One gap, honestly**: the grid was never driven with **rows**, and Document Details was not
      reached. `Auth/UaLogin` needs a real UA account; the legacy `Auth/Login` gives a valid session
      (`Auth/Me` → `authenticated:true`) but not delivery-read, so `DeliveryDocumentList` 401s even
      with a store set. The drive reports this as a SKIP rather than a failure. Low risk for *this*
      ticket: the grid still hand-mirrors its own hex (measured header ink `rgb(87,84,76)` — the
      **old warm** value), so grid colour is entirely ticket 085's subject, not something 084 moved.

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

## Comments

**Built 2026-07-24.** `npm run lint` green (import boundaries + 117 contrast pairs), `npm run build`
green, **zero `.tsx` modified** — the measured zero-call-site-churn property held exactly as the
inventory predicted.

**Beyond the declared spine reach**, three files the ticket didn't name. None is a `.tsx`, i18n or
API change, so the stated boundary holds, but they are recorded rather than left to be discovered:

- `index.html` — the two `theme-color` metas still carried the retired warm hexes (`#fdfdfb` /
  `#1f1e1b`), so mobile browser chrome would have stayed warm after every other surface went steel.
  Now `#F4F7FA` / `#121C27`. These are the only colour literals outside `global.css` and the logo
  SVG; a meta tag cannot read a CSS custom property, and they live outside `src/`, which is what
  D-12's gates scan. Commented in place.
- `tools/palette-drive.mjs` — new, serves the third Proof bullet.
- `.gitignore` — ignores that drive's screenshots.

**Dark `--prescription-050` / `-800` were unspecified.** D-4 leaves both as *(R4)*. Derived to
`#083A3D` / `#9ED9DC` — L .319 / L .846, landing on exactly the band R4 states and matching where
the other four families sit in dark (`-050` L .32 C .048, `-800` L .85 C .06). Anchored to the dark
base's hue (200°) rather than the light tier's (211°), because D-4's own given `--prescription`
`#40B1B7` sits at 200° — following the light hue would have left the dark trio internally
inconsistent. The gate proves `-800` on `-050` clears AA.

**Two review findings applied:**

1. *Spec axis* — the gate dropped `--attention` as a fill ground unconditionally, citing D-4's
   light-only constraint, but D-4 also measures the dark twin ("the lifted `#E4A249` carries dark
   ink at 7.83") and that pair was unguarded. Added as a `darkOnly` assertion, with
   `--prescription`. 115 → 117 pairs.
2. *Standards axis* — the drive's bridge list was hand-transcribed and would silently drift. The
   attempted fix (deriving class names at runtime) **failed and taught something worth recording**:
   Tailwind 4 is JIT and scans source files for *literal* class names, so a name built as
   `bg-${x}` is never emitted and every probe fails. The list must stay literal. It is still real
   evidence rather than circular — a scanned class whose token lacks a bridge line emits no CSS at
   all (verified: `bg-nosuchtoken` → nothing, `bg-card-2` → a rule). Drift is now caught **statically
   instead**, by a bridge-completeness check added to `check-contrast.mjs`: every colour token in
   `:root` must have its `--color-*` line, with `--radius` the one explicit exemption. Proven by
   deleting `--color-divider` — reported at `global.css:81`, exit 1.

**Two naming findings rejected**, both deliberately: `--ink-3` reads oddly beside `--foreground` /
`--muted-foreground`, and `--fam-cancel-request` abbreviates CONTEXT.md's "cancellation request".
Both are spec 082 D-2's own token names; renaming them here would put the code out of step with the
spec, the map and tickets 085–089. If they are wrong, they are wrong in 082 and should change there.

**Still warm after this ticket, as predicted** (082 D-13, and visible in the drive screenshots): the
~230 raw-palette status sites (ticket 088), the AG Grid theme's hand-mirrored hex (085), and the
login/home brand navy + gold kickers (087). The home hero in dark is the most conspicuous — the navy
now sits oddly against the cool page, which is precisely the dissolve D-9 exists to fix.
