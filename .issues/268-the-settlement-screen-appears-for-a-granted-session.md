---
status: open
spec: 267
blocked-by: —
---

# 268 — The Settlement screen appears only for a granted session

## What to build

The feature's skeleton and its gate — the surface 269–273 extend, so it runs first (otherwise two
sessions each invent the folder, the namespace and the menu entry differently).

- `src/features/collection/settlement/` — `SettlementPage.tsx` + `api.ts`, per the
  `feature-structure` checklist. **Not a new area**: same Collections nav group, same `/collection/*`
  prefix.
- `src/locales/en/settlement.json` + registration in `src/core/i18n.ts` (import, `ns[]`,
  `resources`). Without it every `t()` call renders a raw key.
- `src/app/router.tsx` — one lazy route at **`/collection/settlement`**.
- `src/layout/menu-model.ts` — one menu item under the existing Collections group, with an
  `accessProbe`.
- The **access call** in the feature's own `api.ts`, and the screen wrapped in a gate that hides the
  menu item and refuses the route on an ungranted session — the pattern
  [253](253-the-collections-group-appears-only-for-a-granted-session.md) established.

The page itself lands as a **shell**: the header, the scope control rendered but inert, and an empty
state. It fetches nothing yet.

### 🔑 The one decision this ticket makes for everyone after it

**`ScreenGate` lives in `features/collection/inquiry/` and features must never import features.**
Pick one, do it, and write the choice into this ticket:

- **copy it** into the settlement feature (the ruling 254/255 took for the grid template — *copied,
  not extracted*), or
- **graduate it to `@/core/ui`** and repoint the inquiry feature at it.

Either is defensible; a third session inventing a third answer is not. Copying is the cheaper default
and matches the neighbours; graduating is right only if the copy would be the *second* one and the
component is genuinely identical.

## Spine reach

The route exists and is gated. Nothing reads the ledger yet.

## Proof

- [ ] The Settlement item is **absent** from the Collections group on an ungranted session, and the
      route refuses when typed directly.
- [ ] The item appears and the route renders on a granted session.
- [ ] `npm run typecheck`, `npm run lint` (import boundaries, token contrast, colour literals) green.
- [ ] `t()` calls render real strings — the namespace is registered, not just created.
- [ ] The `ScreenGate` decision above is recorded in this file.

## Boundaries

- **No data.** No fleet call, no account call, no grid. This ticket is the surface.
- **No feature flag.** The grant is the only off-switch (spec D1); do not add a second one.
- **No new area folder** and no per-feature barrel (`index.ts`).

## Done when

A granted session sees the menu item and opens an empty Settlement screen; an ungranted one sees
neither, and the two gates were observed rather than assumed.

## Blocked by

Nothing.

## Open questions

None. The `ScreenGate` call is this ticket's to make, not to escalate.
