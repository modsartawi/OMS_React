---
status: done
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

- [x] `healthLabel`: `ok` / `failing` / `silent`, and a paused store reads paused, not silent (vitest)
- [x] `reasonField`: 1–200 characters, unicode kept; DHS-00008 is shown inline (vitest)
- [x] `layout/menu-hungerstation.test.ts`: one group, one probe call, entries hidden per flag, fail closed on a
  403 or a failed probe (vitest)
- [x] `tools/hungerstation-stores-drive.mjs`, against stubs, LTR and RTL:
  - list, filters ⇄ URL ⇄ door, the health highlight;
  - onboard and edit bodies, each with its reason;
  - the refusals inline;
  - the menu entry hidden when `canManageStores` is false.
- [x] `npm run typecheck`, `npm run lint` (boundaries), `npm test` green

## Boundaries

oms-react only. No feature flag: the access probe gates the menu, and the server grant is the real boundary.
The BackOffice doors are already built (BackOffice 3030, merged on pricing2) but not yet on staging. Prove
the page against stubs of the contract, using the real envelope `errors[]` shape and fixtures that emit
**exactly** the contract's fields.

## Done when

The helpers and the drive are green, and the page renders from stubs.

## Blocked by

None. It can start immediately (live: BackOffice 3030).

## Comments

**Done 2026-10-24** (branch `ticket/551`). Proof: vitest (`core/hungerstation/reason.test.ts`,
`access.test.ts`, `features/hungerstation/stores/store-state.test.ts`, `i18n-keys.test.ts`,
`layout/menu-hungerstation.test.ts`), typecheck + lint (4 gates) + `npm test` green, and
`tools/hungerstation-stores-drive.mjs` **84/84 against STUBS** (LTR and RTL). 🚩 Not driven against a live
SIS.Api — the live walk is 557.

What siblings build on:
- `core/models/hungerstation.ts` — every door of the contract typed field for field (Access, Chains,
  Stores, Sync Active/Now/Logs/Lines/material history, Materials list/import/change, Orders list/detail/
  raw/retry), plus `HUNGERSTATION_ERRORS` (DHS-00001…00015 and the `HungerStation*` caller-fault codes).
- `core/hungerstation/` — `api.ts` (probe on `HUNGERSTATION_ACCESS_KEY`, `Chains`, query options),
  `access.ts` (three predicates), `reason.ts` (DHS-00008), `ReasonDialog.tsx` (+ `InlineRefusal`).
- `features/hungerstation/stores/` — `api.ts` (`STORES_KEY`, `storePath`), `columns.tsx` (the actions
  cell takes `act`; 552–554 add their buttons), `StoreDialogs.tsx`, `store-state.ts`.

Judgement calls (overrulable):
1. **Extraction, not a copy.** The reason rule and the dialog moved to `core/reason/` (`reason.ts`,
   `ReasonDialog.tsx`); `core/deliverect/{reason,ReasonDialog}` and `core/hungerstation/{reason,ReasonDialog}`
   are thin bindings that name the area's namespace and its reason code (DLV-00009 / DHS-00008). Every
   Deliverect call site is unchanged; the Deliverect stores drive re-ran **230/230** after the move.
2. **Health precedence.** The server's `failing` wins over a pause (the contract computes it from the push);
   otherwise a paused store reads **Paused** — never Silent, and not the server's `ok` either, so the grid
   tells a paused store from a healthy one. A health the contract does not name reads *Unknown*, never OK.
3. **Placeholders.** The Materials and Orders leaves route to `src/app/HungerStationPlaceholderPage.tsx`,
   each behind its own flag (the same predicate as its leaf). 555/556 re-point their route in
   `app/router.tsx` and delete the file once both have landed. Its copy lives in `hungerstation-stores`
   (`placeholder.*`).
4. **Menu order.** The HungerStation group is LAST, right after Deliverect; `menu-deliverect.test.ts` now
   pins Deliverect second-to-last.
5. **Refusal placement.** Onboard: DHS-00002/00003/00004 at the store, DHS-00005 at the vendor id,
   DHS-00006 at the chain, DHS-00008 at the reason; DHS-00001 (a field too long — no field named) shows in
   the dialog with its code. Edit: DHS-00007 shows "no longer onboarded", refreshes the list and disables
   Save; the dialog stays open until cancelled.
6. **Edit refreshes the list** rather than patching the returned row into the cache — one code path for
   onboard and edit. 553's pause/resume can patch in place, as its ticket asks.
7. **Chains fallback.** If `Chains` fails, the chain field becomes a typed key with the rows' chains as
   suggestions (Deliverect's account fallback); a wrong key is DHS-00006 inline.

Open for the owner: none blocking. The Arabic copy is unread by a native eye (the app's `lng` stays `en`;
the drive's RTL pass is direction only).

### Review fixes (branch ticket/3028-review, 2026-10-24)

- The chain choices now use core `keyChoices` (`core/util/filter-choices`). The local `chainChoices` is gone.
- The "seen chains" effect is now `useSeenChains` in `core/hungerstation/seen-chains.ts`, shared with the orders monitor.
- `LtrCell` is one core renderer (`core/ui/LtrCell.tsx`), used by the stores and materials grids here and by Deliverect's stores and catalog grids.
- Grouped figures use one core helper, `formatFigure` (`core/util/number-format`), with a vitest case. The local `figure` copies are gone from the HungerStation pages, drawers and pure modules, and from the Deliverect orders and stores pages and order drawer.
- `LocalDate` is declared once, in `core/util/date-window.ts`. Both wire models re-export it.
- Shared `core/reason/ReasonDialog`: it now ignores a second Confirm while the first send is in flight, so every write gets the guard. The reason field is now cleared on the open/close transition while rendering, so the clear lands before paint and can no longer eat the first keystrokes.
