---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\3028-hungerstation-follow-up-on-oms-react-spec.md
blocked-by: — (live: BackOffice 3030)
---

# 551 — An HQ user lists, onboards and edits HungerStation stores with a reason

## What to build

**Slice 0 of the HungerStation area** (BackOffice spec 3028). This is the direct HungerStation rail (Delivery
Hero's own API), not HungerStation through Deliverect. Use the glossary words **HungerStation store**,
**vendor id** and **chain**. A store whose onboarding was taken back is a **removed HungerStation store**
(552), never "deleted" or "offboarded".

- **Registration**
  - A new area `features/hungerstation/` with the feature `stores`.
  - The namespace `hungerstation-stores` in EN and AR.
  - The route `/hungerstation/stores`.
  - A **HungerStation** menu group, its own group beside Deliverect, gated by `accessProbe` on
    `HungerStationWeb/Access`. It holds an entry for each probe flag (`canManageStores`,
    `canManageCatalog`, `canViewOrders`), with placeholders that 555 and 556 fill in.
- **Shared, in core:** `core/models/hungerstation.ts`, with types for **every** contract door, field for
  field. `core/hungerstation/` holds the probe, `Chains`, the access helper and the reason field/dialog.
  Mirror `core/deliverect/` (access, reason, `ReasonDialog`) rather than copying it.
- **Stores page** (AG Grid):
  - Columns: store, name, chain, vendor id, onboarded at/by, updated at/by, and the sync block: active or
    paused, last full, last delta, last run with its status and error, and **health**.
  - Health shows `ok`, `failing` (the newest push in 24 h failed, highlighted as an error) and `silent`
    (an active store with no push in 24 h, highlighted as a warning).
  - Filters: chain, sync (any / active / paused), health (any / ok / failing / silent) and text (store code,
    name or vendor id). Filters round-trip through the URL.
  - `onboardedAt`/`updatedAt` render as blank when `null`, and so does a `""` store name.
- **Onboard** dialog: store, chain (from `Chains`), vendor id and a mandatory reason.
  - DHS-00002, 00003, 00004, 00005 and 00006 show inline. Onboarding a removed store revives it (the
    server does it; the dialog needs nothing extra).
- **Edit** dialog: vendor id or chain, with a reason. DHS-00005 shows inline, and DHS-00007 says the store
  is no longer onboarded and refreshes the list.

Wire shapes: `C:\Work\DMSCO\BackOffice\.issues\assets\3028-hungerstation-web-door-contract.md` (Common, Error
codes, Access, Stores: Chains, list, onboard, edit). A refusal for a missing grant is a **bare 403** with no
envelope.

## Spine reach

UI → app (BackOffice doors, stubbed until 557)

## Proof (→ `tdd` red-green cycles)

- [ ] `healthLabel`: `ok` / `failing` / `silent`, and a paused store reads paused, not silent (vitest)
- [ ] `reasonField`: 1–200 characters, unicode kept; DHS-00008 is shown inline (vitest)
- [ ] `layout/menu-hungerstation.test.ts`: one group, one probe call, entries hidden per flag, fail closed on a
  403 or a failed probe (vitest)
- [ ] `tools/hungerstation-stores-drive.mjs`, against stubs, LTR and RTL:
  - list, filters ⇄ URL ⇄ door, the health highlight;
  - onboard and edit bodies, each with its reason;
  - the refusals inline;
  - the menu entry hidden when `canManageStores` is false.
- [ ] `npm run typecheck`, `npm run lint` (boundaries), `npm test` green

## Boundaries

oms-react only. No feature flag: the access probe gates the menu, and the server grant is the real boundary.
The BackOffice doors are already built (BackOffice 3030, merged on pricing2) but not yet on staging. Prove
the page against stubs of the contract, using the real envelope `errors[]` shape and fixtures that emit
**exactly** the contract's fields.

## Done when

The helpers and the drive are green, and the page renders from stubs.

## Blocked by

None. It can start immediately (live: BackOffice 3030).
