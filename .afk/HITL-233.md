# HITL — ticket 233 (one field resolves a member)

## Q: The spec's cascade pseudocode calls `apiErrorKind(err)`, which `core/api.ts` does not export. Add it, or branch on `err instanceof ApiError && err.kind` in the feature?

**Decision taken:** Added `apiErrorKind(err): ApiErrorKind | null` to `src/core/api.ts`, mirroring the existing `apiErrorCode`.
**Why:** The taxonomy is `core/`'s to own; a feature spelling `instanceof ApiError && err.kind === 'business'` re-implements it at each call site, and the spec's own code reads as written.
**Revisit if:** a reviewer rules that core may not grow a helper for one feature's benefit — the fallback is a two-line local predicate in `resolve-member.ts`.

## Q: Where does the double-miss / archived / error outcome render when the field was reopened via **Change** on a member route?

**Decision taken:** Inline under the field, in both states — the member stays on screen underneath.
**Why:** 227 only draws the miss on the empty state; keeping the sentence next to the box it came from is the least surprising, and losing the resolved member on a mistyped correction would be worse than the ticket asks for.
**Revisit if:** 235's header work makes the two states visually collide.

## Q: A resolve seeds the member into the query cache, but the `/loy/members/:loyId` route still refetches on mount (TanStack default `staleTime: 0`). Suppress it with a `staleTime`?

**Decision taken:** No `staleTime`. The seed stays (it removes the loading flash); the route's own read still runs in the background.
**Why:** A freshness policy for the member is a decision no ticket in this wave has taken, and the read is read-only and cheap; inventing 30 s here would bind 235–238 silently. The drive asserts the honest fact instead — the resolve never re-reads *by mobile*.
**Revisit if:** a later ticket sets a member freshness policy, or the extra read shows up as a real cost against the live door.

## Q: `LoyMemberModel.BlockedReason` is the reason CODE on the member payload and the joined DESCRIPTION on an action row. Where does spec 231 §6's rename happen?

**Decision taken:** Two types in `core/models/loy.ts` — `LoyMemberPayload` (wire, `blockedReason`) and `LoyMember` (domain, `blockedReasonCode`) — with a three-line `toMember` map in the feature's `api.ts`.
**Why:** The spec names the domain shape explicitly; doing the rename at the boundary means 235's chips cannot read the wrong one, and no call site has to remember which payload it is holding.
**Revisit if:** the BackOffice door ships the field already named `blockedReasonCode`, in which case the map collapses to a pass-through.

## Q (post-review): 227's prototype drew the hint "Mobile first, then Loy ID — one field decides nothing, the server does." Both review axes flagged it against spec 231's story 3 ("the screen's internal ordering is invisible to me"). Keep the drawn copy or the stated requirement?

**Decision taken:** Replaced it with "A mobile number or a Loy ID — either one resolves the member." The drive now asserts the copy never says "mobile first".
**Why:** The prototype is the authority on arrangement, not on requirements it predates; and the old line's second clause was factually wrong — the *client* sequences the two calls, not the server. The hint now says what the field takes rather than what it does with it.
**Revisit if:** the user wants the ordering stated for support reasons.

## Q (post-review): Reopening the field via Change hides the bar, and the bar owns New lookup — so there was no way back.

**Decision taken:** Added a small Cancel under the reopened field (`search.cancel`), shown only while editing on a member route.
**Why:** Change is described as reversible ("reopens the field in place, pre-filled"); leaving the only exits as "resolve something" or the browser is a trap. The member stays on screen throughout either way, so nothing is lost — it is the affordances that were.
**Revisit if:** 235's header rework gives the bar a different home.

## Q (post-review): The spec-axis reviewer called `search.noMatchHint` ("Check the number and try again.") a second sentence the spec did not ask for.

**Decision taken:** Kept.
**Why:** 227's prototype draws exactly those two lines in the double-miss empty state, and the spec's "one neutral sentence" is about tone — no toast, no red — which holds.
**Revisit if:** the user reads the pair as nagging.

## Q: Vite's dev server was already occupied on 5199, so the drive ran on 5200.

**Decision taken:** Drove against `DRIVE_PORT=5200`; the tool still defaults to 5199 like every other drive.
**Why:** Port is a run-time concern, not a contract.
**Revisit if:** never.
