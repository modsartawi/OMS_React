# HITL — ticket 236 (Activities fetches when opened and states its ceiling)

## Q: The tab shell is established here, but Sales (237) and Actions (238) are not built. Does the strip show one tab or three?

**Decision taken:** Three. The strip renders all three peers; Activities is complete, Sales and
Actions render a neutral sentence — `tabs.notYet`, "This tab is not available yet." — and make no
call.
**Why:** The ticket's own words are "the first tab, and with it **the whole tab shell the other two
slot into**", and its Proof requires driving "a second tab does not fetch until opened" — both need a
second tab to exist. Growing the strip slice by slice would also change `resolveTab`'s
unknown-value fallback semantics mid-wave (`?tab=sales` would mean Activities today and Sales
tomorrow), which is exactly the deep-link behaviour 236 fixes.
**Revisit if:** 237/238 slip out of the wave — then a one-tab strip with no placeholder is the
honest shipping state.

## Q: Does switching tabs push a history entry or replace one?

**Decision taken:** Replace (`setSearchParams(next, { replace: true })`).
**Why:** 227 decision 3 promised browser Back from a member lands on the field, and spec story 57
repeats it. Pushing would put up to three tab entries between the agent and the field. The tab is
still in the URL, so the link/reload promise (stories 52–54) is untouched.
**Revisit if:** an agent reports wanting Back to step between tabs.

## Q: `resolveTab` and the tab id list have no home named by the ticket — a second pure module, or `tab-volume.ts`?

**Decision taken:** In `tab-volume.ts`, alongside the caption rules.
**Why:** The ticket names exactly one pure module for this slice (`tab-volume`), and both rules are
the tab **shell's** — which tab is open and what a tab may say about its window. A second module
holding one function would split the shell's rules across two files for a naming nicety.
**Revisit if:** the module grows past the shell's own concerns.

## Q: `countedVolume` (the Actions caption) belongs to 238 — build it now or leave it?

**Decision taken:** Built now, with its test.
**Why:** Spec 231's testing table assigns `tab-volume` all three tabs, including "Actions states a
real total and never a ceiling". The counted shape is the *contrast* that makes the capped rule
legible — a capped tab may never say a row count, a counted one must say a total — and pinning both
in one suite is what stops a later slice quietly giving Actions a cap or Activities a count.
**Revisit if:** 238 needs a different shape, in which case it owns the change.

## Q: The at-cap warning — `=== cap` or `>= cap`?

**Decision taken:** `>=`.
**Why:** The ticket says "when the returned count **equals** the cap", and `>=` satisfies that
exactly (fires at the cap, silent below). It additionally survives a report that ever answers more
than its own `TOP (n)` — a window even more partial than the cap claims, on which `===` would go
quiet. No behaviour the ticket specifies changes.
**Revisit if:** the server ever gains a real more-rows flag, which would replace the heuristic
outright.

## Q: Does a tab re-read when the agent leaves it and comes back?

**Decision taken:** No — `staleTime: Infinity` on the tab query, so it is read once per member per
page life.
**Why:** The ticket says "lazy fetch on first open, **cached per member**". With TanStack's default
`staleTime: 0` a remount would refetch, which is a second read of a window that cannot have moved:
phase 1 changes nothing about the member, so there is nothing to be stale about (spec 231's own
note on the 45 s cache).
**Revisit if:** phase 2 adds a mutating act, which would need the tab invalidated rather than
re-timed.
