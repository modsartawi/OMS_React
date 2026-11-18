---
status: open
spec: BackOffice 4002 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3995-oms-react-permissions-brief.md)
blocked-by: BO 4007 (done; Auth/Permissions shipped, deploy SIS.Api with it before the walk)
---

# 909 — One permissions answer replaces every Access probe

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

- [ ] `usePermissions` over a fake answer: exact `has`; malformed ⇒ fail closed; a 403 invalidates the query · vitest
- [ ] `resolveMenu` over the real `MENU`: pending ⇒ hidden + not settled; error ⇒ all gated hidden; ADMIN-shaped
      answer ⇒ every leaf but attachments · vitest
- [ ] one test per combination predicate, with the half-grant case · vitest (`menu-*.test.ts` family)
- [ ] source-contract test: no `'/Access'` call (one allow-listed AuthzAdmin read), no `*_ACCESS_KEY`, no
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
