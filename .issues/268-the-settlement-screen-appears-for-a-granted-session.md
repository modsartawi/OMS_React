---
status: done
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

#### ✅ DECIDED — **graduated** to `src/core/ui/ScreenGate.tsx`

Both conditions the paragraph above sets for graduating were already met, and one of them was written
down in advance:

- **The copy would have been the THIRD, not the second.** 263 had already copied the gate into
  `features/reports/retail-invoice/`. Spec 261 §Out of Scope named the trigger explicitly — *"two
  copies is the duplication the rule accepts, and a **third** area is the trigger"* — and settlement
  is that third area.
- **The component is genuinely identical.** The two files differed in exactly three places: the
  namespace they read (`collection` / `reports`), the access query they call, and whether `children`
  was optional. All three are now props.

So `features/collection/inquiry/ScreenGate.tsx` and `features/reports/retail-invoice/ScreenGate.tsx`
are **deleted**, and all five shipped screens plus this one import `@/core/ui/ScreenGate`.

What the graduation had to parameterize, and why each is a prop rather than a decision core makes:

| prop | why it is passed in |
|---|---|
| `query` | the area's access query **options**, not just its key — `retry: false` and `staleTime: Infinity` must travel together (257's ruling: react-query merges concurrent observers' options, so a reader that dropped `retry: false` would retry a **refusal**) |
| `can` | unchanged — still the very predicate the nav leaf's probe was built with, so there is ONE reading of the grant rather than two that could drift |
| `ns` | new. The five `access.*` keys live in each area's namespace and their sentences legitimately differ (*"No access to this screen"* vs *"No access to invoices"*). Core owns the **shape**, not the copy |

`children` is now **required** — 263's stricter contract, kept: a gate that silently rendered a bare
header is a way for a screen to go missing without failing. A slice with no body yet passes its own
placeholder, in its own words, which is what this screen's shell does.

### The second graduation, which the boundary forced

**The Collections access probe had to move too**, and the ticket's *"the access call in the feature's
own `api.ts`"* could not be honoured literally: `tools/check-boundaries.mjs` reads
`collection/inquiry` and `collection/settlement` as two features, so importing the probe fails
`npm run lint`.

Only the **shared half** moved, to `src/core/collection/api.ts` — `COLLECTION_ACCESS_KEY`,
`collectionAccessQuery()`, `collectionAccessApi.access()`. This is the road `@/core/oms/api` (125),
`@/core/bonus-buy/api` (118) and `@/core/nphies/api` (211) each took when a second consumer appeared;
253 left it in the feature precisely because that feature was the only consumer, and that condition
ended today.

🚩 **The predicates stayed with their screens** — `canOpenCollections/Acrs/Deposits/Attempts` in
`features/collection/inquiry/api.ts`, `canOpenSettlement` in this feature's own `api.ts`. 244 §10's
"the grants are independent" is why: a screen's reading of its own grant is that screen's business,
and a core module holding all five would be the place someone eventually writes a tier.

### ⚠️ The screen is shut for every real session today, and that is the design

`canOpenSettlement` is the **fifth boolean** on `CollectionAccessResult`, declared **required**
because the contract (BackOffice spec 1173) owes five. The live door answers **four** — so the field
arrives `undefined`, the predicate's `=== true` reads it as a denial, and both the leaf and the route
stay shut until 274 joins the waves.

That is D1 working rather than a gap: the grant is the only off-switch, so **no feature flag was
added** to open the screen early. It also means neither Proof bullet below could be observed against
a live probe — a stub is the only way to stand a session on each side of a line the server cannot yet
draw, which is what `tools/settlement-drive.mjs` does, and what 253 did for the other four.

## Spine reach

The route exists and is gated. Nothing reads the ledger yet.

## Proof

- [x] The Settlement item is **absent** from the Collections group on an ungranted session, and the
      route refuses when typed directly. — `settlement-drive` scenarios 2, 3 and 4: all-false, the
      four-boolean answer the live door returns today, a bare 403, a 500. All four hide the leaf and
      refuse the route; ⚠️ the 403 says *see an administrator* and the 500 says *try again* — both
      deny, only the sentence differs. Scenario 3 also proves the group stays **ragged**: the four
      inquiry leaves the session does hold are untouched beside the missing fifth.
- [x] The item appears and the route renders on a granted session. — scenario 1: the leaf is the
      **fifth** item of the existing Collections group, the shell renders its header, its three inert
      scope buttons and its empty state, and 🚩 the five leaves + the screen's own gate cost **ONE**
      `CollectionWeb/Access` call — the fifth grant bought no sixth round trip. The drive also
      asserts this ticket fetches **nothing**: zero `Settlement/*` requests.
- [x] `npm run typecheck`, `npm run lint` (import boundaries, token contrast, colour literals) green.
      — 484 files boundary-clean **with the two collection features read as two**, 117 contrast pairs,
      489 files colour-clean.
- [x] `t()` calls render real strings — the namespace is registered, not just created. — the drive
      asserts no raw key path (`settlement:`, `shell.`, `scope.`) appears in the page **or the nav**.
      263's finding is why it matches the key *path* rather than the namespace prefix: with a
      namespace unregistered, i18next drops the prefix and renders a bare `menu.settlement`, which a
      `/settlement:/` check would have passed.
- [x] The `ScreenGate` decision above is recorded in this file. — and in `.afk/HITL-268.md` with its
      revisit condition, alongside the four other calls this slice made.

**Tests.** 1563 pass (99 files), 23 new: `features/collection/settlement/access.test.ts` (the fifth
predicate, including 🚩 the four-boolean answer the live door returns today), the fifth leaf's cases
in `layout/menu-collection.test.ts`, and the fifth grant's independence in
`features/collection/inquiry/access.test.ts`. Per spec 267 §Testing Decisions the components stay
thin renderers verified by driving the app.

**Drives.** `tools/settlement-drive.mjs` **20/20** — new, the wave's drive; 269–273 extend it rather
than starting a second. ⚠️ The gate graduation touched five **shipped** screens, so their drives were
re-run as regression: `collection-drive` **220/220** and `invoice-drive` **79/79**, both unchanged and
unedited. `npm run build` green.

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
