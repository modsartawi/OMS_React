---
status: open
spec: 110
blocked-by: —
---

# 112 — The bonus-buy detail modal answers from `@/core/`

## What to build

**Prefactor — a structural precondition with no design content.** Make it possible for the Simulation
screen to open the bonus-buy detail modal at all, by lifting the modal and its dependencies out of the
Bonus Buy Inquiry feature into the shared layer. **No behaviour changes and no pixel changes.**

Today the modal lives inside the inquiry feature. [feature-structure](../.claude/rules/feature-structure.md)
forbids a feature importing another feature — *including within the same area* — and the boundary lint
keys features as `area/feature`, so `pricing/simulation → pricing/bonus-buy-inquiry` **is** a violation
the gate will catch. Logic shared by two features graduates **up to `@/core/*`**; it does not cross
sideways. [108](108-sim-bby-details-affordance.md) counted the cost and found it small, because the
modal's entire public surface is `{ bbyNumber, onClose }` — it fetches its own record and needs nothing
from the inquiry page. **A file move, not an API redesign.**

Graduate the modal together with the pieces it pulls: the detail-view projection, the grouping-members
modal, the bonus-buy status badge and its severity mapping, the code labels, and the formatters. The two
detail-related server calls travel with them. The inquiry screen then imports these from the shared layer
like any other consumer.

**The i18n does not move and is not renamed.** The rule keeps namespaces flat and feature-named
regardless of folder, so the `bonus-buy-inquiry` namespace registration and every
`t('bonus-buy-inquiry:…')` call site are **unchanged**. This is worth stating precisely because it looks
like churn and is not — a rename here would be a self-inflicted i18n sweep on a ticket that is meant to
change nothing.

## Spine reach

model/api · component (moved, not rebuilt)

(No i18n reach — see above. No new logic.)

## Proof (→ `tdd` red-green cycles)

- [ ] `import boundaries pass with the modal in core` — `npm run lint`'s boundary gate green, and a scratch import of the modal from the simulation feature no longer trips it · **flow (lint gate)**
- [ ] `the inquiry screen's detail modal still opens, renders and closes` — `node tools/bby-inquiry-drive.mjs` green, unchanged · **flow (Playwright)**

Verify via `npm run typecheck` + `npm run lint` + the existing drive. The drive is the real proof: this
ticket's whole claim is that nothing observable changed.

## Boundaries

No new API endpoint. **No i18n change of any kind** — namespace, registration and call sites all stay
put. No nav change. `@/core/` gains files but no new dependency direction: the rule already allows
feature → core, and the boundary gate independently forbids core → feature, so the moved files must not
import anything left behind in the inquiry feature.

## Done when

`npm run typecheck`, `npm run build` and all three `npm run lint` gates are green with the modal and its
six siblings under `@/core/`, and `tools/bby-inquiry-drive.mjs` passes unchanged.

## Blocked by

None — can start immediately.

## Open questions

The exact `@/core/` home for these files (a `core/bonus-buy/` folder versus spreading them across the
existing `core/ui`, `core/models` and `core/util`) is not fixed by the spec. Prefer whichever keeps the
moved set importable as a unit and does not force unrelated `core/` files to learn about bonus buys.
