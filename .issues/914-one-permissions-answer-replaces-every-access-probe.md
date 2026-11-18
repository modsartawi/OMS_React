---
status: open
spec: BackOffice 4002 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3995-oms-react-permissions-brief.md)
blocked-by: BO 4007 (done; Auth/Permissions shipped, deploy SIS.Api with it before the walk)
---

# 914 — One permissions answer replaces every Access probe

## What to build

The big bang (BackOffice map 3995, spec 4002, owner call): oms-react stops firing ~42 `*/Access` probes per refresh
(menu settled at 17.2 s in production) and reads **one** `GET Auth/Permissions` answer instead. The
[brief](C:\Work\DMSCO\BackOffice\.issues\assets\3995-oms-react-permissions-brief.md) has the wire shape, every key, the
predicates and the per-probe checklist; read its **Changes** lines first. (Until BackOffice branch `spec4002` merges to
`pricing2`, the brief is at `C:\Work\DMSCO\BackOffice-4002-4006\.issues\assets\3995-oms-react-permissions-brief.md`.)

- **`@/core/permissions`:** `permissionsApi`, query key `['auth', 'permissions']`, `usePermissions()` → `has(key)`,
  `settled`, `extras`, and a typed list of the keys used. Fail closed on error or a malformed answer.
- **Boot:** the query starts in `ProtectedLayout` in parallel with `Auth/Me`, `staleTime: Infinity`, `retry: false`.
- **403:** any 403 from `@/core/api` invalidates `['auth', 'permissions']`.
- **Menu:** items declare `requires: (p) => boolean` or the shorthand `key: 'X:03'` instead of `access: accessProbe(…)`;
  pending ⇒ gated hidden and not settled; error ⇒ every gated item hidden.
- **Predicates:** the brief's combination table (Analytics, Copilot, CouponsAdmin, BbyMaintain, SdDocTypeConfig,
  SdDocument, Nphies, plus Attachments / Broadcast / AuthzAdmin over `extras`), named, beside their items; page guards and
  buttons read the same predicate.
- **Delete:** every per-area access query, flag type, access API and `*_ACCESS_KEY` in the brief's mapping table (46
  rows, including the duplicate reads `COPILOT_SQL_ACCESS_KEY` and `ACTION_SYNC_ACCESS_KEY`, and `DATA_SYNC_ACCESS_KEY`:
  the Data sync leaf reads `has('DataSyncConsole:03')`, no exception). The one kept read: AuthzAdmin's role lists from
  `AuthzAdminWeb/Access`, booleans from the hook.

## Spine reach

core (api + hook + keys) · layout (menu contract, `resolveMenu`) · every gated feature (guards, buttons) · test

## Proof

- [x] `usePermissions` over a fake answer: exact `has`; malformed ⇒ fail closed; a 403 invalidates the query · vitest
- [x] `resolveMenu` over the real `MENU`: pending ⇒ hidden + not settled; error ⇒ all gated hidden; ADMIN-shaped
      answer ⇒ every leaf but attachments · vitest
- [x] one test per combination predicate, with the half-grant case · vitest (`menu-*.test.ts` family)
- [x] source-contract test: no `'/Access'` call (one allow-listed AuthzAdmin read), no `*_ACCESS_KEY`, no
      `accessProbe(`, no per-area access query; mutation-checked once
- [ ] production browser capture after the release, as in BackOffice asset 3996: one `Auth/Permissions`, zero
      `*/Access`, time to a settled menu recorded

## Boundaries

No adapter layer and no side-by-side period inside oms-react. The server's 48 probes stay until BackOffice deletes them
after a clean production week, so rolling back to the previous release keeps working.

## Done when

The release that no longer calls any `*/Access` route (but the AuthzAdmin role lists) is built, the suite and lint are
green, and the after-capture is recorded.

## Blocked by

BackOffice 4007 (done): `GET Auth/Permissions` deployed on the target SIS.Api.

## Outcome

2026-11-18, branch `t909-permissions`: built. One `GET Auth/Permissions` (`@/core/permissions`: `usePermissions` →
`has`, `settled`, `failed`, `extras`; typed `SCREEN_KEYS`) started in `ProtectedLayout` beside `Auth/Me`; a 403 from
`@/core/api` invalidates it, a user change resets it. Every `*/Access` probe, `*_ACCESS_KEY`, access query, access api
and flag type in the brief's 46-row table is gone; the menu declares `requires` / `key`, pages and buttons read the
same named predicates. The one kept read is AuthzAdmin's role lists (`authzAdminApi.roleLists()`). Guard:
`src/app/no-access-probes.test.ts`, mutation-checked. Staging boot (signed out, 172.23.10.110:4433): one
`Auth/Permissions`, zero `*/Access`, quiet 401, lands on /login (`tools/permissions-boot-drive.mjs`).

Tidy (same day): every `tools/*-drive.mjs` answers one `Auth/Permissions` stub (`tools/permissions-stub.mjs`, its keys
pinned to `SCREEN_KEYS` by `tools/permissions-stub.test.mjs`) in place of its `*/Access` stubs; a probe 403/500 scenario
became a failed answer, and the 404-tolerant scenarios went with their fallbacks. Comments and docs naming the old routes,
`accessProbe` or `*_ACCESS_KEY` now describe the keys. CouponsAdmin's half grant is also tested through the real menu
(`src/layout/menu-coupons.test.ts`).

Renumbered 909 → 914 (main's 909 is the Google map points ticket). Merged main (29 commits): the Stock health page (912)
moved onto the answer too: its leaf and page read `StockHealth:03` (BackOffice `Seed-StockHealth-Screen-Authorization.sql`);
`StockHealth/Access` and its probe, key and model are gone.

Left open:

- **Signed-in staging walk** — no test credentials in the repo; run `SIS_SIGN_IN=window node tools/permissions-boot-drive.mjs`
  against the staging-proxied dev server and walk the menu (also run the DataSync seed there first, brief 3995).
- **Production after-capture** (the last Proof box) after the release.
- `npm run build` / the map-build lint gate fail before and after this change on the same missing packages
  (`maplibre-gl`, `@protomaps/basemaps` absent from the shared node_modules).
