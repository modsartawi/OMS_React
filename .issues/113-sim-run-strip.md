---
status: open
spec: 110
blocked-by: 123
---

# 113 — The run strip collapses the determination into chips and processes from there

## What to build

**Slice 0 — the tracer bullet.** The whole spine, end to end, for the region the rework's space reclaim
comes from. After this slice the screen still prices baskets exactly as before, but the header form,
the Summary tile and the Actions card have become **one unframed row**.

The strip carries four groups in source order: **chip set · status slot (empty until
[114](114-sim-status-slot.md)) · money readout · run controls.** Nothing is sticky — at the density the
captures show, nothing scrolls, and a pinned band would spend permanent vertical space on a case the
data has never produced.

- **The chips are the run's determination**, produced by a **pure module** mapping the request to
  `{ key, value }` **tokens, not translated strings** — which is what keeps it node-testable and keeps
  the zero-literal rule intact. Determination fields (plant, sales org, channel, date) chip **always,
  even at their defaults**, because an invalid plant prices silently and the determination a run
  actually used must be readable without expanding anything. Levers and flags chip **only when set** —
  blank means *no chip*, never a muted one. The promotion flag chips in **both** states, because a
  promo-off run blacks out the whole rail and must never read as "nothing fired". The date chip carries
  **no key** — a formatted date reads alone. Five chips ordinarily, eight with the levers, nine with
  the elements flag.
- **The chip set is one control.** A single `<button>` wrapping chip `<span>`s, ending in a visible
  `Edit ▾` tail, carrying one `aria-expanded` — **one tab stop for seven fields and two checkboxes**.
  Individual chips have **no hover state, no cursor change, and are never buttons**, anywhere on this
  screen; that is what makes "a chip is a readout" enforceable rather than aspirational.
- **Expanding replaces the collapsed row in place**, so nothing below moves except by the form's own
  height. Expanded, the control reads `Done ▴`; Process / Clear / Wipe cache move into the form's
  footer so the run loop is never more than one control away; and **the money readout is removed, not
  moved** — a total belongs to a run, and once you are editing you are no longer looking at that run's
  inputs.
- **Collapse on every Process. Auto-expand never** — including a Process that fails, which is still a
  Process; the screen must not move itself while the analyst is starting to read a failure.
- **Money keeps emphasis by weight, not by border or size**: net total semibold in the strip, beside
  discount, tax and calc time as smaller keyed pairs.
- **The run controls are a terminal cluster** separated by a rule: `▶ Process` primary, `Clear` and
  `⛁ Wipe cache` quiet. `Clear cache` is a **run control**, not an administrative curio — the real loop
  is *fix in SAP → re-download → wipe cache → Process*. Its existing grant and confirm are unchanged.
- **Keyboard:** expand focuses the first field; `Esc` collapses and returns focus **to the chip set**,
  never to the document; **`Ctrl`+`Enter` processes from anywhere**, including inside the items grid,
  signposted on the button itself.

**Also in this slice, because everything after it depends on the measurement:** the page shell declares
the **work-area `@container`**. Every responsive rule in this rework is a container query on the work
area, not a viewport media query — the nav eats 200–260 px, so a 1280 laptop is a *960* screen and the
viewport systematically lies. Declare the container here; nothing below it reads the viewport again.
(The results table already uses `@container` internally; this is the shell-level one it will hang off.)

**Items are untouched by this slice** and never join the strip — they are the instrument retyped every
run, the opposite lifetime from the determination fields.

## Spine reach

store/logic (the pure chip-set module) · component (the strip; the header form becomes its expansion) ·
i18n (the `strip.*` keys) · test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [ ] `the chip set is five chips ordinarily and eight when the levers are set` — determination fields chip at their defaults, levers only when set, promo in both states, blank ⇒ no chip · **pure**
- [ ] `the strip collapses on every Process and never expands itself` — including a Process that fails · **flow (Playwright, new `tools/sim-strip-drive.mjs`)**
- [ ] `the chip set is one tab stop and Ctrl+Enter processes from the items grid` — plus `Esc` returning focus to the chip set · **flow (Playwright, same drive)**

Commission `tools/sim-strip-drive.mjs` here — one focused drive per concern, matching the existing
`document-band` / `-cards` / `-items` / `-rail` / `-actions` pattern, so it stays runnable alone while
later tickets are in flight. Manual-run, not a CI gate: `npx vite --port 5199` in one shell,
`node tools/sim-strip-drive.mjs` in another.

## Boundaries

No API change — the same `SimulateRequest` is built from the same fields.

**i18n — this slice does not add keys.** [123](123-sim-i18n-key-expand.md) has already minted every new
key, including `strip.netTotal` (which replaces `summary.netTotal`, whose copy "Total Net Total" does not
survive), `strip.edit`, and the chip vocabulary. Call them; do not edit the locale file to add more — if
this slice finds a key the ledger missed, add it in 123 so the file keeps one owner. **Retirements do
belong here**, because they follow their call sites: `summary.title`, `actions.title` and `header.title`,
the three dissolving frame headings.

No nav change, no feature gate, no runner bootstrap.

**Concurrency:** this slice owns `tools/sim-strip-drive.mjs` and **drive port 5199**. Work in a git
worktree so a `typecheck` here never reads another session's half-finished edit.

## Done when

Driving the app: the determination collapses to chips after Process, `Edit ▾` expands the form in place
and `Done ▴` / `Esc` / Process all collapse it, `Ctrl`+`Enter` processes from the items grid, the money
reads in the strip and disappears while the form is open, and `▶ Process` / `Clear` / `⛁ Wipe cache` sit
together as one cluster — with the chip-set test and `sim-strip-drive.mjs` green and `npm run typecheck`
clean.

## Blocked by

[123](123-sim-i18n-key-expand.md) — the strip's chip vocabulary and `Edit ▾` keys are minted there. It is
a sub-hour mechanical ticket; land it first and this slice starts immediately after.
