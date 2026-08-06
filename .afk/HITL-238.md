# HITL — ticket 238 (Actions pages through a real total)

## Q: Does the Actions page number belong in the URL, beside `?tab=`?

**Decision taken:** No — page is local `useState` inside `ActionsTab`, so leaving the tab and
coming back reopens at page 1. Only `?tab=` is in the address.
**Why:** Spec 231 §4 puts exactly two things in the URL (the LoyId and the open tab) and gives the
reason — a link should land on the right *question*; page 3 of an audit trail is not a question a
colleague is sent. Adding a param the spec did not name is a widening, not a detail.
**Revisit if:** an agent asks to link a colleague to a specific page of actions, or phase 2 adds
date/action-type filters, at which point the whole criteria set wants a home.

## Q: What casing for the `LoyMemberActions` query params — `LoyId`/`Page`/`PageSize` (the C#
`[AsParameters]` property names, as 223 lists them) or camelCase?

**Decision taken:** camelCase — `loyId`, `page`, `pageSize`.
**Why:** ASP.NET model binding is case-insensitive, and every other params call in this repo is
camelCase (`{ term, skip, take }`, `{ transactionId, itemNumber }`). Matching the repo beats
matching a C# property name the binder does not require.
**Revisit if:** the BackOffice door binds these by hand instead of `[AsParameters]`, or a live call
comes back with the estate-wide page — which is what a dropped `loyId` would look like.

## Q: Is the "N actions." caption shown while the read is in flight, the way the capped tabs show
their ceiling while loading?

**Decision taken:** No — the caption appears only once the read has answered.
**Why:** The capped tabs' caption describes the *query* ("most recent 100"), which is known before
the answer. Actions' caption is the *answer* (a real `recordsCount`). There is no honest total to
state before the server sends one, and inventing a placeholder would be the completeness lie the
whole volume section exists to prevent.
**Revisit if:** the caption row visibly jumping on load reads as a glitch to an agent.

## Q: `tabs.notYet` ("This tab is not available yet.") — the placeholder 236 left for the third tab.

**Decision taken:** Deleted from `loy.json` along with its branch in `MemberTabs`.
**Why:** It was 236's scaffold for exactly this ticket; leaving a key no call site reaches is dead
copy that a future translator would have to ask about.
**Revisit if:** a fourth tab is scaffolded ahead of its build — but that string should be minted
with it, not inherited.
