---
status: done
spec: 380
blocked-by: 392
---

# 394 — The palette lists the last five records opened

## What to build

The palette gains a **Recent** group between This screen and Go to. It holds the last **5**
deliveries and documents opened through Delivery details, newest first.

- **Recording.** Opening `oms/delivery/:deliveryNo` or `oms/document/:documentNo` records the
  **number only**, plus whether it is a delivery or a document, once the header has loaded. A
  record that is not found or is denied is not recorded.
- **Storage.** It is kept per browser in `localStorage` **keyed by user id**. It never stores the
  customer, the mobile or the OTP. Re-opening a number moves it to the front, with no duplicates.
- **Defensive parse.** A malformed or foreign store reads as an empty list and never throws.
- **Gating.** The group is **re-filtered by the current grants on every open**. A delivery or
  document row needs `canOpenDetail`, and a pending or errored probe hides the group (fail closed).
- **Choosing a row** navigates to the route, and the page applies its own gate.

**Implements:** spec 380 **K9** and **D11** (the recording half, on today's Details page).

**Rulings:** [364](364-what-the-command-palette-holds.md) §1 (Recent: numbers only, per user, which
contrasts with 239's `sessionStorage` PII ruling) and §2 (re-filtered by current grants).

## Spine reach

store/logic (a pure Recent store: push, cap, parse, filter) · component/route (Details records on
load; `layout/` composes the group) · i18n (`common:palette.recent`) · test

## Proof (→ `tdd` red-green cycles)

- [x] `recentKeepsFiveNewestNumbersOnly`: pushing 7 numbers keeps the newest 5 in order, and a
  re-push moves a number to the front with no duplicate. The stored value holds only kind + number
  · pure
- [x] `recentParseIsDefensiveAndPerUser`: a malformed JSON value, a wrong shape or another user's key
  each read as an empty list · pure
- [x] `recentRefiltersByCurrentGrants`: with `canOpenDetail` denied or pending, the group is
  empty/hidden · pure
- [x] `tools/command-palette-drive.mjs`, extended. After opening two deliveries, Ctrl+K lists them
  under Recent, newest first, and choosing one lands on its Details page · flow (Playwright)

## Boundaries

- No new API endpoint.
- One key, `common:palette.recent`.
- The `document` feature's Details page calls a core recorder from `@/core/commands`. It may not
  import `layout/`.

## Done when

Recent shows the last five opened numbers per user, gated by current grants, and the proof tests
and the drive are green.

## Blocked by

[392](392-ctrl-k-opens-one-palette-with-go-to-and-jump.md).

## Comments

**Built 2026-10-03 (AFK).**

- **Store** — `@/core/commands/recent.ts`: pure `pushRecent` (newest first, cap 5, a re-push moves
  to the front), `parseRecent` (malformed JSON, a wrong shape or an older shape → `[]`, never a
  throw; every record rebuilt from `kind` + `no` only), `readRecent` / `recordRecentIn` over an
  injected `Storage`, and two thin edges: `recordRecent` (the signed-in user from the session) and
  `loadRecent(userId)`. Key `oms.palette.recent.v1:<userId>`; no user → nothing read or written.
- **Recording (D11)** — `DocumentDetailsPage` calls `recordRecent({ kind: openedAs, no: routeId })`
  in the header load's success branch only, so a not-found or denied record never gets there. It
  imports `@/core/commands/recent`, not `layout/`.
- **Group** — `recent` sits in `PALETTE_GROUP_ORDER` between `screen` and `goto`.
  `layout/palette-groups.ts` builds the rows (*Open delivery N* / *Open document N*, sharing one
  row builder with Jump) behind the same `canOpenDetail` gate as Jump, so a pending, errored,
  denied or malformed probe hides the group. The host re-reads the store on every open.
- **Found while building:** Recent sits above Jump and the first row is aimed, so a substring
  match would let a recent `80001237` take Enter from someone who typed `8000123`. A typed
  number therefore keeps only the Recent record that IS that number (`recentNarrowedByNumber`).
  `/code-review` then found that an Arabic-Indic number was folded for that match but dropped
  by the word filter. `filterRows` now folds digits on both sides for every group.
- **Proof:** the three pure suites (`src/core/commands/recent.test.ts`, the
  `recentRefiltersByCurrentGrants` block in `src/layout/palette-groups.test.ts`, plus a K8 order
  case in `palette-model.test.ts`). `npm test` 183 files / 3314 tests. Typecheck, lint (all four
  gates) and build are green. `command-palette-drive` passes **244/244**: in light, dark and RTL,
  opening two deliveries lists them under Recent newest first; choosing the older one lands on its
  Details and moves it to the front; a 404 delivery is not recorded; the store holds kind and
  number only; a partial number leaves Recent out. Recent hides under a denied or pending
  grant, shows neither another user's store nor a malformed one, and a Recent document row
  lands on Document details.
- **Reviews:** `/code-review` found one real bug (Arabic digits), fixed. `/standards-review`
  found no hard violation on either axis. Its smells were applied: one row builder for Jump and
  Recent with a kind→icon map, a clearer name for the numeric narrowing, and no test helper
  shadowing `document`. Left as they are: `RecentKind` duplicates the feature's `OpenedAs`,
  because core cannot import a feature, and `recordRecent` reads the session itself, so the
  feature needs no user id.
- **Decisions** are in `.afk/HITL-394.md`: the heading key, row labels reused from Jump, route
  number vs server number, and exact-number narrowing.
