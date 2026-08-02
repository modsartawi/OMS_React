# HITL — ticket 217 (a live engine session)

Decisions taken unattended, per the AFK protocol. Each is the most conservative reading of the
frozen contract (`.issues/assets/209-nphies-contract/CONTRACT.md` v1.0) and this repo's
conventions that I could find; each names what would make it wrong.

## Q: §1.2 says item search is "not a verb, deliberately — the existing item lookup is reused". Which lookup?

**Decision taken:** the add-row is an **item-number field**, not a typeahead. Picking is typing the
number and pressing Add, which goes straight to `Nphies/Session/AddItem`; an unknown number is the
door's own `ITEM_NOT_FOUND`, stated on the row.

**Why:** the contract names no route for it, and the only item search this repo has is
`CallCenterWeb/ItemSearch` — another feature's door, behind another grant, scoped to a call-centre
transaction, and unreachable from `features/nphies/*` under the import boundary. Inventing a lookup
endpoint is exactly what this wave's brief forbids.

**Revisit if:** §3.8 (or a §8 revision) names the reused lookup, or SIS.Api exposes one on the
`Nphies/*` door. **This is a named contract gap**, not a design choice — the ticket asks for a
typeahead and the contract does not say what to type against.

## Q: `pricing: 'pending'` drives a ⟳ in the grid. What makes it settle, with no polling anywhere?

**Decision taken:** the next verb, or the agent's **Refresh** (`Session/State`, source `read`).
Nothing polls.

**Why:** §3.6 forbids browser polling in this area outright and the contract gives the session no
notification mechanism, so the only honest way a pending price settles is the next state the agent
causes. Refresh is the same affordance both lists already carry.

**Revisit if:** the server track adds a push or a settle callback, or the session state grows a
"pricing will settle by" field. Until then a pending line says *Pricing…* rather than a blank the
agent has to read as either zero or missing.

## Q: `SESSION_BUSY` (409, "auto-retry with `retryAfterMs`, bounded") — implement it here?

**Decision taken:** **no**, this slice. A busy collision surfaces as what it is: a business refusal
with the server's own sentence, over a form whose action is still available to press again.

**Why:** the call centre's bounded backoff (`withBusyRetry`, `BUSY_BACKOFF_MS`) is feature code with
its own suite, and sharing it means a third `core/engine-session` graduation plus moving a live
screen's test — churn well outside 217's Proof, on a screen with one agent and one tab. Nothing in
this ticket's Done-when needs it.

**Revisit if:** 218–220 add verbs that fire concurrently (a rate edit re-pricing the whole basket
while a scan lands is the obvious one). That is the ticket that should graduate `withBusyRetry` to
`core/` and give both engine sessions one backoff.

## Q: `SESSION_CLOSED` / `NOT_YOUR_SESSION` — handle them here, or leave them to a later slice?

**Decision taken:** handled, through `core/engine-session/session-fault.ts`. A fault stops the form,
clears the state (so nothing — including the leave path — keeps pointing at a dead transaction) and
sends the agent back to the list with the server's own sentence. Raised by the standards/spec review
pass; the first cut rendered them as one generic verb banner.

**Why:** ticket 210 moved that reader to `core/` *because this contract names the same two codes with
the same three closed reasons*, and this form is the second consumer it was moved for. Leaving them
generic also left the add-row live over a request that no longer exists, which is how a second
authorization gets raised.

**Revisit if:** 221's reopen wants a different landing than the list.

## Q: "the screen cannot offer a store switch mid-request" — where is that enforced?

**Decision taken:** a `core/engine-session/store-lock.ts` hold, taken while the transaction is open;
`features/auth/StoreSwitcher` disables itself and says why. The form itself offers no store control
at all.

**Why:** law 8 makes the plant immutable for the transaction's life, and `features/auth` may read
`core/` while the two features may not see each other. ⚠️ **`StoreSwitcher` is currently mounted
nowhere** (it is dead in the shell today — `grep` finds only its own file), so the lock is a latent
guard rather than a visible one, and the drive cannot assert it.

**Revisit if:** the switcher returns to the app shell — at which point the lock should be asserted
in a drive — or if a reviewer reads the unmounted control as reason to delete the mechanism.

## Q: what happens to the transaction when the agent leaves an EMPTY request?

**Decision taken:** it is abandoned, silently. Every in-app navigation off the form is intercepted
while a transaction is open; with lines on the request the agent is warned, with none the form
abandons and lets the navigation through.

**Why:** law 9 — leaving abandons, and an OPEN transaction left for the sweeper is the litter the
till has just retired. Warning about an empty request would train the agent to click past the
warning that matters.

**Revisit if:** the door starts refusing an abandon on an empty transaction, or a product decision
makes an empty session worth keeping.

## Q: the leave warning — a dialog?

**Decision taken:** an **inline banner** at the top of the same scrolling page, with *Leave and
discard* / *Stay on the request*.

**Why:** spec 209 and this ticket both say no modal opens anywhere in this flow, and the whole point
of the port is that WPF stated its rules in message boxes. The `beforeunload` prompt for a closed
tab is the browser's and cannot be styled — that one exit the page cannot mediate, and the server
sweeps what escapes it.

**Revisit if:** the warning is missed in practice, which would be an argument for a sticky banner
rather than for a dialog.

## Q: which of the eleven session verbs does this slice declare?

**Decision taken:** **six** — open, state, addItem, changeQty, voidLine, abandon. `setHeader`,
`setInsurance`, `updateLineInsurance`, `updateLineMeta` and `submit` are absent from `api.ts`.

**Why:** the ticket's own table names exactly these six, and a verb declared before the screen that
presses it is a shape nobody has checked. 218–220 own the rest.

**Revisit if:** a later ticket needs one of the five and finds the six-verb file an awkward home —
it is not, they append.

## Q: is the eligibility fetched by id on the form, as the ticket's prose says?

**Decision taken:** **no client-side fetch.** `Open` takes `{ eligibilityId, memberId }` and the
identity comes back in the state's `reference`, which §2 says is "fetched from the eligibility at
Open, read-only forever".

**Why:** two reasons, and either alone would decide it. The eligibility read is
`features/nphies/eligibility/api.ts`, which the authorizations feature may not import; and a second
client-side read could disagree with what the engine actually bound to the transaction.

**Revisit if:** the door stops populating `reference`, in which case the read graduates to
`core/nphies/api.ts` beside the probe and the providers lookup.

## Q: `newRequestId` is call-centre feature code and both engine sessions need it.

**Decision taken:** graduated to `core/engine-session/request-id.ts`, re-exported from the console's
`api.ts` so no call site moved.

**Why:** the same rule ticket 210 applied to the latest-state guard and the session-fault reader —
logic shared by two features goes up, never sideways. Both contracts put `{ transactionId,
requestId }` on every verb, word for word.

**Revisit if:** the two contracts' ledger semantics diverge, which would make one rule two.

## Q: money columns on a grid whose money is not editable until 218.

**Decision taken:** render them read-only, and **say so** under the grid ("only the quantity is
yours on this screen").

**Why:** the ticket calls read-only the correct intermediate state rather than a gap, and an agent
looking at eight numeric columns needs to know which of them are theirs. Law 1 means nothing on this
screen sums, totals or derives an amount — every cell is one server field, formatted.

**Revisit if:** 218 replaces the sentence with the five editable inputs, which it should.
