# HITL log — ticket 234 (the Loyalty nav appears only for a granted session)

## Q: What flag does `GET LoyWeb/Access` answer with? The door is unbuilt, so the client names it.

**Decision taken:** `{ canOpenLoyMember: boolean }`, modelled as `LoyAccessResult` in
`src/core/models/loy.ts`, read through the exported predicate `canOpenLoyMember` (`=== true`).
**Why:** matches the house shape of a per-door probe naming its own screen (`canOpenNphies`,
`canOpenConsole`, `canOpenList`), and 231's Boundaries mint the grant as
`BackOfficeScreen[LoyMember,03]` — the flag says the same word the grant does.
**Revisit if:** the BackOffice door ships a different member name; a strict predicate means a
mismatch is a *denial*, which is the safe failure and visible immediately (nav absent, backstop on).

## Q: Does the probe live in `features/loy/member/api.ts` or in `@/core/loy/api.ts`?

**Decision taken:** with the feature.
**Why:** it has exactly two consumers today and both are this one feature's — the nav leaf (and
`layout` may import a feature) and the screen's own guard. That is the `uaAdminApi` /
`sessionMonitorApi` shape; the OMS, bonus-buy and Nphies probes moved to `@/core/` only once a
*second feature* needed them, which a feature may never import.
**Revisit if:** phase 2 adds a second `features/loy/*` feature behind the same grant — then it
graduates to `@/core/loy/api.ts` with the key unchanged.

## Q: Nav copy and icons for a group that has never existed.

**Decision taken:** group **Loyalty** (`Gem`), item **Member lookup** (`UserSearch`); group placed
between Call Centre and Nphies.
**Why:** the group name is the area name the spec uses throughout ("a new **Loyalty** area"); the
item is named for what it does, not for the entity, matching "Eligibility checks" / "Active
sessions". Position: next to the other agent-facing phone-call area rather than under Pricing.
**Revisit if:** phase 2's modification screens land — a second item may want the group re-ordered.

## Q: The denied backstop — one sentence or two?

**Decision taken:** two, exactly as `EligibilityListPage` does it: a refusal names the grant and an
administrator; an unreachable probe says the access could not be checked and stays closed.
**Why:** both deny (fail-closed is not negotiable here), but the agent's next action differs — ask
an administrator vs try again. Copying the Nphies wording keeps one voice across gated screens.
**Revisit if:** the portal grows a shared denied-backstop component; this is the third hand-rolled
copy of the same card.

## Q: Should the page's own probe query set `staleTime`?

**Decision taken:** yes — `staleTime: Infinity, retry: false`, the two options the shell already
gives every nav probe.
**Why:** without it the drive measured **two** calls on the shared key (the menu filled it, the
screen's mount refetched it), which defeats the one-probe-one-call invariant this ticket rests on.
A grant does not change within a page life.
**Revisit if:** grants become revocable mid-session — then every probe in the shell needs the same
rethink, not this one alone.
