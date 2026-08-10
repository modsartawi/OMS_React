---
status: open
spec: 261
blocked-by:
---

# 263 — The Reports group appears only for a granted session

## What to build

The **new area**, and the shared surface every later ticket in this wave extends. It runs first — ahead
of the screen itself — because it mints the folder, the namespace and the route entries that 264, 265
and 266 all write into. If it ran later, two sessions would each invent the `reports` namespace and
collide in `core/i18n.ts`.

### A new top-level area

```
src/features/reports/retail-invoice/     →  /reports/invoice
```

`reports` is a new area because it is a **new nav group and a new URL prefix** — the two conditions
`.claude/rules/feature-structure.md` names for one, and the worked example that rule itself gives
(*"e.g. a future `features/reports/` behind `/reports/*`"*). Not `oms/` (an invoice receipt is a
store/finance artefact, not a delivery document); not `pricing/` (nothing here prices anything).

⚠ **A flat `features/reports/` trips `check-boundaries.mjs`** — every sibling file becomes its own
feature. This is not theoretical: it is exactly what happened to
[253](253-the-collections-group-appears-only-for-a-granted-session.md), whose ticket wrote
`features/collection/` and whose build had to become `features/collection/inquiry/`. So the feature
folder is `features/reports/retail-invoice/` from the first commit, and **everything in this wave goes
inside it**, including 265's download plumbing.

### The nav group and the probe

- **Reports** group in `layout/menu-model.ts`, one entry: **Invoices** → `/reports/invoice`.
- `accessProbe` = this feature's own access call, deep-imported (`app`/`layout` reaching into a
  feature is allowed and is how every other group does it).
- `GET RetailInvoice/Access` → `{ screenAllowed: boolean }`. **Cookie-only, not grant-gated**, and it
  answers a denial with **200** — so a denial is a boolean to read, never an error to catch. Graduate
  the query key + options into one exported `retailInvoiceAccessQuery()` the way 257 did for
  collection, so the key and its options are spelled once.
- **Group hidden entirely when not granted.** One entry, so there is no ragged case yet.

### The gate on the screen itself

A `ScreenGate` around the Page, **copied** from `features/collection/inquiry/ScreenGate.tsx` — a
feature may not import a feature, and collection has the only one. ⚠ Do **not** graduate it to
`core/` here: two copies is the duplication the rule accepts, and a third area is the trigger.

🚩 **The probe only hides the menu — it is not the boundary.** `Search` and `Download` re-check the
grant server-side and refuse with a **bare 403 carrying no body at all** (no envelope, no
`errorCode`). A user who pastes `/reports/invoice` must land on a screen that **says** it has no
access, not one that renders an empty grid or a generic "something went wrong". 264 and 265 own the
per-call arms; this ticket owns the screen-level one.

### The i18n namespace

- `src/locales/en/reports.json`, namespace **`reports`**, registered in `src/core/i18n.ts` — import,
  `ns` array, `resources`. ⚠ **An unregistered namespace renders raw keys to users and no gate
  catches it.**
- Namespace is `reports` (the area's), not `retail-invoice` (the feature's), **deliberately**: the
  second report screen joins this namespace rather than minting another. This is the one place the
  wave departs from *namespace == feature name*, and the spec says why.
- Later tickets **add keys to this file** and must not re-register the namespace.

### The Page skeleton

A `RetailInvoicePage.tsx` that routes, gates, and renders its title and an empty state. **No search
box and no grid** — those are 264. It exists so the route, the group, the namespace and the gate can be
proven independently of the screen's content.

⚠ **It lands empty and fires no query on mount.** Unlike collection's four screens, there is no
default search: this screen cannot guess a transaction number, so an auto-fired search would be a
guaranteed empty grid.

## Spine reach

Menu → route → gate → an empty screen. The thinnest end-to-end path that proves the area exists,
against a stubbed probe.

## Proof

- [ ] `npm run typecheck`, `npm run lint` (all three gates), `npm run build` clean. Lint matters
      especially here — `check-boundaries.mjs` is what catches a mis-shaped area folder.
- [ ] New `tools/invoice-drive.mjs` (nearest prior art `tools/bby-inquiry-drive.mjs`), vite on
      **:5199**, killed after. **264–266 EXTEND this file, not start a second one.** It asserts:
      - `screenAllowed: true` → the **Reports** group and its **Invoices** entry are visible.
      - `screenAllowed: false` → **no Reports group at all** in the menu.
      - Navigating straight to `/reports/invoice` unauthorized shows the **no-access message**, not
        an empty screen and not a generic error.
      - The probe is called **once** per visit.
- [ ] `git grep 'reports:'` — every user-visible string on the new screen goes through `t()` with a
      `reports:` key that exists in the bundle.
- [ ] Confirm the namespace registration is load-bearing: remove it once, see raw keys render, put it
      back.

## Boundaries

- **No search box, no grid, no download.** Resist finishing the screen — 264 and 265 own it.
- **`features/reports/retail-invoice/`, never a flat `features/reports/`.**
- **Do not import anything from `features/collection/`** — copy `ScreenGate`'s shape.
- **Do not graduate `ScreenGate` or `GridStates` to `core/`.**
- The probe is mocked at Playwright, **not** in `src/` — following 253.

## Done when

The Reports group appears for a granted session and is absent for a denied one, `/reports/invoice`
renders a gated empty page, the `reports` namespace is registered and proven load-bearing, and the
drive asserts all four arms.

## Blocked by

—

## Open questions

None.
