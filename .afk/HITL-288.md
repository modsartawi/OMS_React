# HITL — ticket 288 (the settlement front page counts the work and links to it)

Decisions taken unattended, per the AFK protocol. Each is the most conservative option
consistent with spec 282, ticket 288 and the repo's conventions.

## Q: The ticket's *Done when* says **three** counted links, but 286 (Cash waiting) is not built. Two or three?

**Decision taken:** Two — Owing and Owed. The cash-waiting count is **absent**, not zero and
not a dead link.
**Why:** The ticket's own Boundaries section rules it: *"the cash-waiting count is simply absent
until it has [landed], rather than shown as zero"*. A third link would also point at `?tab=cash`,
which `readOpenTab` reads as unknown and lands on Owing — a link that lies about where it goes.
**Revisit if:** 286 lands; the signpost then adds its count from `Settlement/Uncollected` the same
way, and the drive's *"absent rather than a fabricated zero"* check becomes a third count.

## Q: Where does the signpost sit on the door, given the prototype only draws the lane?

**Decision taken:** Below the wrong-money triage, above the estate figures.
**Why:** `.afk/PROTO-281-open-settlements.html` is the **lane's** arrangement and says nothing
about the door, so the door's own established order governs: wrong money is rare and every row is
money handed over against a document that will never exist, so it stays first; the estate headline
is a report figure and stays last. The signpost is work, so it belongs between them.
**Revisit if:** an owner-approved front-page prototype appears and puts it elsewhere.

## Q: A count endpoint, or the lane's own call?

**Decision taken:** The lane's own `useQuery`, same key (`['settlement','open-lane']`), same
`staleTime`.
**Why:** Spec 282 D5's whole argument — *"one call feeds both entry tabs… so the two counts, the
front-page signpost and the cap banner all describe one answer and cannot disagree"*. Sharing the
TanStack key also means clicking through to the lane costs no second call.
**Revisit if:** the door's cost at estate scale becomes a problem — but the measurement in the
spec's Further Notes (17 ms cold at 1,407 rows) says it is not.

## Q: The door now costs three settlement calls instead of two — is that a regression the drive should keep asserting at two?

**Decision taken:** The drive's assertion moves to **three**, naming the third as the signpost's
one lane call.
**Why:** The count has to come from somewhere and the spec forbids it coming from a second answer.
The assertion's purpose — *the door does not fetch an account or run a ledger lookup by arriving* —
is unchanged and still enforced.

## Q: The failed read — the server's words, or the screen's sentence?

**Decision taken:** Both, in one banner, with the server's message **interpolated** into the
screen's sentence (`door.signpost.failed` + a `failedNoReason` fallback).
**Why:** `apiErrorMessage(err, fallback)` returns the *server's* message when there is one, so a
bare call would have shown *"At least one ledger criterion is required"* and nothing about what the
em-dashes beside it meant. The ticket's 🚩 asks for the failure to be **said**; the api-envelope
rule asks for the server's own words to survive. Interpolation satisfies both without
concatenation.

## Q: Should the cap show on the front page too?

**Decision taken:** Yes — one line, when `isCapReached` fires over the same 2,000-row answer.
**Why:** At the cap a count is a floor, not a total. This whole ticket is about not stating numbers
the screen cannot stand behind, and *1,012* is honest while a flat *2,000* would not be. It is one
key and one line and does not turn the glance into a lane.

## Q: A read still in flight — em-dash, or nothing?

**Decision taken:** The same em-dash the failed read draws, with **no** sentence.
**Why:** 285 found exactly this defect on the lane's tabs and settled it: a `0` under a shimmer is
the estate looking settled for as long as the door takes to answer, so a count resolves *into* a
number rather than out of one. Pending is *not known*; failed is *not known, and here is why*.

## Q: `/code-review` found a stale-refetch case — should a failed *Refresh* blank counts the screen still holds rows for?

**Decision taken:** No change. `failed: query.isError` stands on both the lane and the signpost, so
a failed refetch draws the refusal and em-dashes even while stale rows sit in the cache.
**Why:** The wave's rule is that the screen may say it does not know; it may not present a position
it could not confirm as the estate's current one. A minute-old count drawn as live is the same
class of statement the em-dash exists to refuse, and the reader has no way to tell the two apart.
Changing 285's settled semantics is also not 288's to do unattended.
**Revisit if:** an owner would rather see the last good answer with a *"could not refresh"* marker —
that is a real alternative, and it needs a worded state of its own rather than a silent fallback.

## Q: New keys under `open.*` or `door.*`?

**Decision taken:** `door.signpost.*` for the signpost's own copy; the two link labels **reuse**
`open.tabs.owing` / `open.tabs.owed` and the em-dash reuses `open.tabs.noCount`.
**Why:** The copy belongs to the door; the labels belong to the tabs they point at, and one wording
for one thing is what stops the signpost and the tab strip drifting apart in words the way the
shared call stops them drifting apart in numbers. All in the existing `settlement` namespace, per
spec 282 D13 — no namespace is minted.
