---
type: wayfinder-ticket
wayfinder: research
map: 222
status: done
blocked-by: —
---

# 224 — Who may look a member up, and how the portal is let in

## Question

Two access questions, both blockers on the first ticket that writes a `features/loy/api.ts`:

**1. Authentication.** Every `Loy/*` endpoint carries `.AddEndpointFilter<ApiKeyEndpointFilter>()`,
not the portal session auth. How do the portal's existing features reach API-key-filtered SIS.Api
endpoints today — does `src/core/api.ts` already supply what the filter wants, or does a Loy call
from the browser need something new? Check what the call-centre and Nphies features do against
their own filtered endpoints, and read `SIS.Api/Auth/ApiKeyEndpointFilter`. **If a Loy call cannot
be made from the browser as things stand, that is a backend dependency and must be stated as one.**

**2. Authorization.** This screen shows customer PII and is to be gated, hidden from the menu unless
the user holds the right permission — the pattern `layout/menu-model.ts` calls an `accessProbe`. So:
which permission code covers loyalty member inquiry, and is there an existing probe endpoint that
answers it, or would one have to be added? Look at how the WPF IC section gates itself, at the
permission codes already used by `features/admin/*` and `features/nphies/*`, and at whether SIS.Api
exposes a generic access probe. Note the precedent that a missing probe endpoint has previously
forced a graceful-degradation path rather than blocking a build.

Capture the answer as a linked markdown asset. Name any backend dependency explicitly and
separately, so the spec can decide whether phase 1 waits on it or routes around it.

## Answer

Full findings: [224-loy-access.RESEARCH.md](assets/224-loy-access.RESEARCH.md).

**1. Authentication — the browser cannot call `Loy/*` today, and 🚩 this is a backend dependency.**

`ApiKeyEndpointFilter` is *cookie-session **OR** api-key*, not api-key-only, so `core/api.ts` needs
**nothing new** — the session cookie plus the `X-Web-Client` CSRF header is exactly what it wants.
The gap is entirely server-side: since issue 802 the cookie branch is **default-deny**, opening only
for a route marked `.AllowCookieSession()`, and **no `Loy/*` route carries the marker**. A portal
`fetch` to `Loy/Member/{loyId}` gets a **bare 403** (403 not 401 on purpose, so a missing marker
breaks one screen instead of logging the tab out).

Nor may the marker simply be added: 802's audit names `Loy/*` as its lead example of the 394 routes
it closed ("enumerate the loyalty base by phone number, change a member's mobile, reset their
password"), and the marker's own doc reserves it for grant-gated routes, probes, and non-personal
reference reads — everything else "belongs behind a gated `*Web/*` sibling door." That door is the
house pattern, built three times: `SdDocumentWeb/*` (125/750), `CallCenterWeb/*` (801),
`Nphies/*` (912) — `.AllowCookieSession()` + `ApiKeyEndpointFilter` + a grant filter, with handlers
**delegating to the original `LoyEndpoints` statics** so the two doors cannot drift.

**Two of the four reads already exist behind it.** `CallCenterWeb/Member/{loyId}` and
`CallCenterWeb/MemberByMobile/{mobile}` delegate verbatim to `LoyEndpoints.GetLoyMember` /
`GetLoyMemberByMobile`, gated on `BackOfficeScreen[CallCenter,03]`. The three report reads
(`LastActivities`, `LoyaltySales`, `LoyMemberActions`) have **no web sibling anywhere**.

One divergence the screen inherits: `CallCenterWeb/MemberByMobile` runs
`LoyMobileNumbers.NormaliseTyped(mobile)` server-side, because an agent types `0555000111` and the
base is keyed `966555000111`. Found by driving the console live, and not inert — an existing member
searched under their local number came back *not found* and was offered a duplicate enrolment. **The
oms-react search field sends what was typed; the server normalises** (bears on ticket 225).

So the minimum server work is: a cookie-reachable grant-gated door over the four reads (route table
+ filter, no new query), a `<Tag>/Access` probe on it, and a screen-grant SQL seed **deployed before
the API** or the door locks out the floor it exists to admit. The one route around it — bind the
screen to `CallCenter,03` and use the two existing routes — ships only the general-information pane,
does nothing for the three tabs, and grants a loyalty analyst the call-centre console. Recorded as
an option, not a recommendation.

**2. Authorization — no permission code covers this, and no probe exists.**

There is no loyalty screen grant in the new engine; the fifteen `BackOfficeScreen` controllers in
use contain no `Loy`, `IC`, or `Member` (all are `,03` = `Permissions.Activity.Display`, and none
splits read from write). WPF IC gates on `ControllerID = "IC"` via the **legacy** `Permission`
family, disjoint from the `Ua*` tables the web reads — and `NphiesScreenGate` already ruled that
reusing a WPF key is no longer safe, because POS screen authority is itself being hydrated out of
the new engine (map 437), so a shared value "would silently admit every store pharmacist … to an HQ
web tool." `"IC"` is held by the retail floor and this screen is customer PII, so: **mint
`BackOfficeScreen[LoyMember,03]`** with its own fail-closed `ScreenGate`. Not `CallCenter,03` either
— wrong audience.

No generic probe exists; each of the eleven doors mints its own `GET <Tag>/Access`, cookie-only and
deliberately **not** grant-gated (it must be able to answer a session that holds nothing), reading
the same gate object as the authoritative filter so probe and gate cannot disagree. One would have
to be added here.

On graceful degradation: the bonus-buy precedent (`core/bonus-buy/api.ts` maps a 404 to
`{ screenAllowed: true, probed: false }` — *unknown ⇒ shown*) **does not transfer**. It was written
for non-personal promotion metadata, and its justification — the data endpoint's own 403 stays
authoritative — only holds once the gated door above exists. This screen should degrade **closed**,
which is already the shell's default for a pending or errored probe and so needs no code, only the
absence of a bonus-buy-style `catch`.
