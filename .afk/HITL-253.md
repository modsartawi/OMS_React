# HITL — ticket 253 (the Collections group appears only for a granted session)

## Q: The spec writes the feature root as `src/features/collection/` (flat). Where do the files actually go?

**Decision taken:** `src/features/collection/inquiry/` — area `collection`, feature `inquiry`.
**Why:** `tools/check-boundaries.mjs` classifies `features/<a>/<b>` as feature id `a/b`, so files sitting
directly at `src/features/collection/*.ts` each become their own "feature" and a sibling `./api` import
is a boundary violation. Verified empirically with a throwaway `src/features/__probe__/` pair: the gate
fired. Every existing area nests (`loy/member`, `callcenter/console`, `nphies/eligibility`).
**Revisit if:** the boundary gate learns about single-feature areas, or a later slice wants the two
document renderers somewhere other than under `inquiry/` (they are the inquiries' drill-down, so they
belong to the same feature either way — the ticket's "one feature, not four siblings" is preserved).

## Q: `CollectionWeb/Access` returns "all four booleans" — nobody wrote down their names.

**Decision taken:** `{ canOpenCollections, canOpenAcrs, canOpenDeposits, canOpenAttempts }`.
**Why:** the repo's probe house style is `canOpen*` (`canOpenLoyMember`, `canOpenConsole`,
`canOpenList`, `canOpenNphies`), and these four names track the four menu items and the four routes
1:1. Neither ticket 253, spec 249 §"Registration points", 244 §10 nor BackOffice 1090 names them.
**Revisit if:** BackOffice 1090 lands different names — this is a one-line rename in
`src/core/models/collection.ts` plus the predicates, and ticket 259 is the slice that joins the two
halves and would catch it.

## Q: What does "mocked in this ticket" mean for the probe?

**Decision taken:** no client-side mock code at all. `collectionAccessApi.access()` calls the real
`CollectionWeb/Access` through `@/core/api`; the mocking happens at Playwright in
`tools/collection-drive.mjs`, exactly as `tools/bby-inquiry-drive.mjs` and `tools/loy-member-drive.mjs`
mock their unbuilt doors.
**Why:** a mock inside `src/` would have to be removed by ticket 259 and would make the fail-closed
path untestable. The probe fails closed, so against a live SIS.Api that lacks the door the group is
simply absent — which is the correct posture for an unbuilt door.
**Revisit if:** a later slice needs fixture data in `src/` (the two documents do — those are checked-in
fixtures by ruling, which is a different thing from mocking a probe).

## Q: The probe fails closed or fails open?

**Decision taken:** fails **closed** — no 404-tolerant catch, `=== true` predicates.
**Why:** 253 says the group is hidden entirely when nothing is granted, and the shell already treats a
pending/errored probe as hidden. The `Bby/Access` fail-open precedent (unknown ⇒ shown) was argued for a
read-only pricing inquiry; these four screens are the chain's cash, and the ticket's own Proof asks for
"the probe shape unknown/failed → hidden rather than crashing".
**Revisit if:** the door lands and an unseeded grant leaves real users unable to see a screen they hold
in WPF — that is a seeding problem, not a client one.

## Q: the spec's prose says `Collection/Access`, the ticket's Boundaries say `CollectionWeb/Access`.

**Decision taken:** `CollectionWeb/Access`.
**Why:** spec 249's own backend contract table names the route `CollectionWeb/Access`, and BackOffice
1090 builds it under that name on the `CollectionWeb` tag. The spec's story 4 / §Registration-points
prose is the loose one, and it is the only place `Collection/Access` appears.
**Revisit if:** 1090 lands a different tag — 259 joins the halves and would catch it.

## Q: where do the two DOCUMENT renderers (251, 252) go, given the nesting above?

**Decision taken (guidance for 251/252, not built here):** into this same
`src/features/collection/inquiry/` folder. Do NOT mint `features/collection/documents/`.
**Why:** the boundary gate treats `collection/documents` as a *different feature* from
`collection/inquiry`, so the document renderers could not import the feature's `api.ts` or its
fixtures — which is exactly the "one feature, not four siblings" the spec argued for. Where a route
sits in `router.tsx` (the print routes must be OUTSIDE the `ProtectedLayout` subtree) is independent
of which folder the component lives in.
**Revisit if:** the print pages end up sharing nothing with the four screens — they will share the
`api.ts` at minimum.

## Review triage (built-in /code-review, then /standards-review)

Applied: split the backstop's two sentences (403 = refusal ⇒ administrator; anything else =
unreachable ⇒ retry), copying the Loy precedent; `Collection Attempts`' subtitle reworded off
`CONTEXT.md`'s "_Avoid_: failed collection"; the four menu leaves now share one `collectionProbe(…)`
helper instead of respelling the key four times; `ScreenGate`'s unused `children` prop dropped.

Not applied, deliberately:
- **Graduate the access-gate shell to `@/core/`** (~14 inline copies repo-wide). Real, but the spec
  rules "**Copied, not extracted**: no shared inquiry shell in `core/`" for this wave, and a gate
  graduation is a repo-wide refactor, not a slice of 253.
- **react-query pauses the probe offline** (`networkMode: 'online'`), so an offline browser sits on
  "Checking your access…" rather than reaching the error branch. True of every gated screen in the
  app, not introduced here; an app-wide `QueryClient` decision.

## Outstanding (not this ticket's to close)

- `CollectionWeb/Access` does not exist server-side yet (BackOffice 1090). Nothing here has been driven
  against a live SIS.Api; 259 is the wave-joining event.
