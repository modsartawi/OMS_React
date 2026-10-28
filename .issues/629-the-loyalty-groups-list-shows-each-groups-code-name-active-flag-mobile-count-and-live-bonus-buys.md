---
status: done
spec: BackOffice 3173 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3173-oms-react-loyalty-groups-brief.md)
blocked-by: —
---

# 629 — The Loyalty groups list shows each group's code, name, active flag, mobile count and the live bonus-buys that name it

## What to build

The tracer bullet for the loyalty-group screens. A new **Loyalty groups** leaf in the existing Loy area
(`features/loy/groups`, route `/loy/groups`, one menu item under the Loyalty group beside Members) lists
every loyalty group: code, name in the active locale (Arabic name shown as stored, Arabic-Indic digits
included), active flag, mobile count, and the live bonus-buys that name it (`[]` until BackOffice 3179 —
render "none", not an error). An **Active / All** filter drives `includeInactive`.

The menu item and the page are gated by `GET LoyGroupWeb/Access` → `{ canView, canMaintain }`, failing
closed (pending, errored, 403 or malformed hides the leaf), as the other undeployed doors do. HQ-only:
nothing here reaches a cashier or call-center screen.

🚩 **The shared half lives in core from the start**: `core/models/loy-groups.ts` (the brief's group shape)
and `core/loy-groups/api.ts` (the access probe + the groups list, query keys, `canViewLoyGroups` /
`canMaintainLoyGroups` predicates). Bonus-buy maintenance, simulation and the member screen consume them
later (636, 637, 635) and a feature may not import another.

Every envelope is **stubbed** — the doors are BackOffice 3174 (list) / 3179 (`liveBonusBuys`).

```ts
interface LoyGroup {
  groupId: string; code: string; nameEn: string; nameAr: string; isActive: boolean
  mobileCount: number; liveBonusBuys: { bbyNumber: string; description: string }[]  // 3179 built it as the bonus-buy number (brief Changes 2026-10-28)
}
```

## Spine reach

model/api (core) · store/logic (filter, name-by-locale, access predicates) · component/route + menu ·
i18n (new `loy-groups` namespace, EN + AR, registered in `core/i18n.ts`) · test

## Proof (→ `tdd` red-green cycles)

- [x] `loy-groups access predicates fail closed` — absent/malformed/false → hidden; `canMaintain` without `canView` still hides · pure
- [x] `group display name follows the locale and falls back to the other name` — `ar` → `nameAr` as stored, blank → `nameEn` · pure
- [x] `loy-groups list drive` — leaf visible on a stubbed grant, hidden on a denied one; Active/All toggles inactive rows; mobile count and live bonus-buys render; EN and AR · flow (Playwright drive, `tools/loy-groups-drive.mjs`)

## Boundaries

- Doors: `GET LoyGroupWeb/Access`, `GET LoyGroupWeb/Groups?includeInactive=bool` (stubbed).
- New i18n namespace `loy-groups` (EN + AR) — decision D1; `loy` stays EN-only.
- Grid spreads `OMS_GRID_BASE_COL_DEF`; codes/counts are machine values (base col def isolates).
- New screen uses `core/ui` controls only (control ratchet).

## Done when

The stubbed drive shows the list under a view grant, hides the leaf without one, and typecheck + lint + vitest are green.

## Blocked by

None — can start immediately.

## Comments

- 2026-10-28 — Done — built 2026-10-28 on spec/3173-loyalty-groups (worktree C:\Playground\oms-react-spec3173, unpushed), all envelopes stubbed; commit 5bf59bbb. Drive tools/loy-groups-drive.mjs green (293/293 at the wave tip).
- 2026-10-28 — No `features/loy/groups/api.ts` in this slice: every call is in `core/loy-groups` (630 added the feature api).
- 2026-10-28 — The app language stays `en` under RTL on this branch, so the RTL pass shows English chrome; AR key parity is checked instead.
- 2026-10-28 — Live bonus-buys render as one chip per bonus-buy number, description as tooltip (field renamed to `bbyNumber` at reconcile 7a89f957).
