---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\1386-idoc-inspector-spec.md
blocked-by: —
---

# 296 — theIDocInspectorScreenGatesOnItsOwnGrant

## What to build

The client access spine for the IDoc Inspector: the feature exists, has a route, appears in the nav
only for people who hold its grant, and guards itself in-page for anyone who reaches the URL
directly.

- **New feature under the `reports` area**, beside `retail-invoice` — the feature it most resembles:
  a keyed lookup that renders a document and serves a download. The area layer's rule is that a new
  area folder appears only when a new nav group does, and this opens none.
- **Its own i18n namespace**, named after the feature, registered centrally, locale file flat. **No
  literal strings anywhere** — every label, heading and empty-state sentence resolves through the
  namespace from the first commit, not retrofitted later.
- **The access probe drives both the menu and the page.** The menu model imports the feature's own
  access call; the page guards itself with the same call rather than trusting the nav.
- 🔑 **Denied is a 200, not a failure.** The server answers `{ screenAllowed: false }` deliberately so
  a denied session can *learn* it is denied. The client must render that as a shut door, **not** as
  an error or a retry — treating it as a failure would tell the user to try again in a moment,
  forever.

The page in this slice is a shell: the lookup form and an empty state. No results, no download.

## Spine reach

client routing → nav → feature scaffold → access probe → server

## Proof

- [ ] `theScreenIsHiddenFromTheNavWithoutTheGrant`
- [ ] `theScreenGuardsItselfWhenReachedDirectly`
- [ ] `aDeniedProbeRendersAShutDoorNotAnError`
- [ ] typecheck + build green

Vitest on the **pure modules only** — no component tests. This mirrors `retail-invoice`, whose tests
sit on its outcome, key and column helpers and nowhere else.

## Boundaries

- Consumes BackOffice `IDocInspector/Access`. No client-side flag — the grant is the switch.
- All server calls through the shared core client, in the feature's own `api.ts`. No raw `fetch`.

## Done when

A grant holder sees the screen in the nav and can open it; a non-holder sees neither, and the direct
URL shows a shut door rather than an error.

## Blocked by

None — can start once its dependency lands.

**dep:** BackOffice [1387](file:///C:/Work/DMSCO/BackOffice/.issues/1387-inspector-gates-on-its-own-grant.md)
— the grant seed, screen gate, grant filter and `Access` route.
