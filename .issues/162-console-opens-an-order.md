---
status: open
spec: 160
blocked-by: —
---

# 162 — openingTheConsoleOpensAnOrderBehindItsOwnGrant

## What to build

**Slice 0 — the tracer bullet.** The whole spine, thin: a granted agent reaches `/callcenter`, the
console opens a real server-side order, and the three-column layout renders **from the returned
`SessionState`** — nothing hand-made, nothing client-computed.

- **The route is chrome-less.** The console renders its own full-viewport layout inside the shell's
  session/auth/theme, not `AppShell`'s nav (map 126 note 13).
- **The access probe fails closed.** One boolean, `{ canOpenConsole }`, one shared cache key for the
  nav leaf and the route guard (ticket 125's pattern). Unresolved or errored ⇒ the denial, never the
  console.
- 🚩 **The denial carries its own way home.** A chrome-less refusal has no nav to leave by, so it
  offers *Back to the portal* and *Sign out* ([134](134-access-and-authorization.md)). A denial the
  agent can only escape by closing the tab is the failure this slice exists to prevent.
- **`open` returns a whole `SessionState`** and it lands in the query cache through a **guarded
  apply**: the cache is the store of record, there is no reducer and no delta protocol. The guard's
  full behaviour is [164](164-busy-collision-and-staleness.md)'s; this slice needs only the entry
  point it hangs on.
- The shell renders what an empty order actually has: the header chips row (unset), the empty
  customer rail, the empty basket, and the receipt with the engine's zero totals and a disabled
  *Place order* pinned to its foot.

## Spine reach

model (contract types for `SessionState` / `OpenResult`) · api (`features/callcenter/api.ts` over
`@/core/api`) · logic (guarded `applyState`; query cache as store of record) · component/route
(`/callcenter`, full-viewport three-column shell, denial screen) · i18n (new `callcenter` namespace,
registered) · test (pure + flow)

## Proof (→ `tdd` red-green cycles)

- [ ] `stateAppliesOnlyForward` — the guard admits a higher `version`, is idempotent on an equal one,
      and **discards a lower one**; an unset current accepts anything · pure
- [ ] `theConsoleOpensAndRendersTheReturnedState` — drive: a granted agent lands on `/callcenter`,
      one `Open` call is made, and the shell renders the returned header, empty basket and engine
      totals — with no app nav chrome around it · flow (Playwright, new
      `tools/callcenter-drive.mjs`, stubbed envelope)
- [ ] `aRefusedConsoleIsNotADeadEnd` — drive: `canOpenConsole:false` renders the denial with both
      ways home, and **no order is opened**; the same holds when the probe itself errors · flow

## Boundaries

**New endpoints:** `GET CallCenterWeb/Access`, `POST CallCenterWeb/Open` (BackOffice
[800](C:\Work\DMSCO\BackOffice\.issues\800-call-center-console-grant.md),
[801](C:\Work\DMSCO\BackOffice\.issues\801-callcenter-web-door.md),
[804](C:\Work\DMSCO\BackOffice\.issues\804-cc-session-contract-server-obligations.md)) — neither
exists yet, so this slice is verified against a **stubbed envelope**, the approach tickets 051/052
and 152 already used. Envelope codes handled here: `CONSOLE_NOT_GRANTED`; 401 stays `handle401`'s.
**New i18n namespace** `callcenter` + registration in `src/core/i18n.ts`. **Bootstraps
`features/callcenter/__fixtures__/payloads.ts`** off 136's `01-open-empty` (098's pattern:
test-only, imported from `.issues/assets/`, **shape only — never treat a value as evidence**). Nav
visibility for the console leaf rides the same probe. The `__prototype__/` folder is **not** the
build and is not imported.

## Done when

A granted agent opens `/callcenter` and sees a real, empty order rendered from the server's own
projection with no app chrome; an ungranted one sees a refusal they can leave.

## Blocked by

None — can start immediately.
