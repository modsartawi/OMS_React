---
type: wayfinder-ticket
wayfinder: grilling
map: 196
status: done
blocked-by: —
---

# 200 — Provider, staff and store: what the web supplies that the till supplied implicitly

## Question

Every Nphies call carries context the WPF till knows without asking. The web does not have a till.
Decide where each value comes from:

1. **`ProviderCode`.** In WPF this is the **store code**, and on a POS machine the combo is
   *disabled* — `SelectedProvider = Providers.FirstOrDefault(c => c == POSCommon.Store.StoreCode)`
   with `ProviderComboBox.IsEnabled = false` (all four controllers do this). Off a till the operator
   picks from `core/providers`. oms-react has a `StoreSwitcher` and an acting store. Does the acting
   store *become* the provider, or does the Nphies screen carry its own provider picker? This
   matters more than it looks: a call-centre agent authorizing for a patient who will collect at
   store X must send X, not whatever store their session happens to be acting as.

2. **`distributionChannel`.** `POSCommon.GetCurrentPlant().DistributionChannel` filters both
   `core/payers` and `core/providers`. Note that `NphiesEligibilityResponsesController` calls
   `NphiesService.Payers()` with **no argument**, defaulting to `"20"` — an inconsistency in the
   source worth flagging rather than faithfully reproducing. Where does the web get the channel?

3. **`UserId` / `StaffId`.** `POSCommon.Staff.StaffID` stamps the auth request, retry and dispense.
   Map onto the oms-react session identity, and confirm the Nphies backend accepts whatever form
   that identity takes.

4. **`SourceCode`.** Set to `POSCommon.Store.StoreCode` on the auth request, separately from
   `ProviderCode` — and `Claim()` sets `ProviderCode = POSCommon.Store.StoreCode` while moving the
   original into `OriginalProviderCode`. Establish what the distinction means before choosing what
   the web sends.

5. **Who may open the screen, and does the audience split matter?** Back-office and call-centre both
   use it, but they may not deserve the same acts (a back-office user chasing a rejection is not the
   same as an agent raising a fresh authorization). Decide whether one access probe covers both or
   the acts are gated separately — and follow the ruling from
   [146](146-export-gate-and-audit.md): a client-only capability check is not a control, so any
   real separation has to be enforceable server-side.

The answer feeds both the spec and the estimate — an extra provider picker with its own rules is
small; a per-act permission model with server enforcement is not.

## Answer

**The acting store plays no part in this screen.** That is the ruling that reshapes the ticket:
`StoreSwitcher` is irrelevant to Nphies, and every "does the session store become X" framing above
is answered *no*. Of the four context values, **one is operator input, three are server-stamped
constants or session claims, and none is sent by the browser.**

### 1. `ProviderCode` — operator-picked, per act, no default

The requester's ruling: *the provider code is a store code, but it needs a picker, because providers
get disabled and the agent must be able to target a different one.* So it is a **free choice from
`core/providers` on every eligibility**, not a derivation from anything. There is no default, no
fallback, and no memory between acts — the picker opens empty every time and submit is blocked
until one is chosen.

This is cheaper than either alternative considered. There is **no store-entitlement work** (nothing
restricts which provider a user may pick) and **no server-side validation of the sent provider** —
so the "picker with server-restricted entitlement" option, which would have needed an entitlement
source that does not exist, is off the estimate.

Two facts from the service make this safe rather than lax:

- `CoreService.GetProviders` already filters `IsBlocked == false`, so **a disabled provider is not
  in the list at all**. The disabled-provider case the requester is designing for is handled by the
  lookup, not by the client.
- `EligibilityService.cs:375` looks the provider up by code and throws `"Provider doesn't
  configured!"` if absent — the service is the authority on a valid provider, and that refusal is a
  business outcome SIS.Api already has to render per [198](198-nphies-proxy-contract.md)'s
  three-way taxonomy.

**The trap not to port:** WPF does `SelectedProvider = Providers.FirstOrDefault(c => c == StoreCode)`
and, on a till, *disables the combo* (`NphiesEligibilityController.cs:555-558`, and the same block in
all four controllers). If that store is blocked, the match yields `null` and the operator cannot fix
it — a disabled combo holding no provider. The web has no fixed default and an always-enabled picker,
so the failure mode cannot occur.

**On the authorization the provider is inherited from the eligibility and shown read-only** — WPF's
rule at `NphiesAuthRequestController.cs:709` (`SelectedProvider = Providers.FirstOrDefault(c => c ==
Eligibility.ProviderCode)`), kept deliberately. Since [199](199-nphies-scope-of-acts.md) made v1
`WithReferenceToEligibility`-only, **the provider is chosen exactly once per patient episode** and
the pair can never disagree in front of the payer. "A different provider every time" means each new
eligibility is a fresh pick, not that an auth may diverge from its eligibility.

**On the two list screens the provider is a filter defaulting to all providers** — the opposite of
WPF, where a till is pinned to its own store by the same disabled combo. A back-office user chasing
rejections across stores is the primary reader, so the list opens wide. (This also means the
provider filter does *not* narrow [198](198-nphies-proxy-contract.md)'s `Take(20000)` problem — the
other filters must.)

### 2. `distributionChannel` — never leaves the browser; SIS.Api pins `"20"`

**The WPF "inconsistency" this ticket flagged is not a bug.** `NphiesEligibilityResponsesController`
calling `Payers()` with no argument, defaulting to `"20"`, produces the *correct* answer for every
in-scope case. The reason: the only other channel the service knows is `"21"`, and `"21"` is
**Bahrain** — `EligibilityService.cs:389` short-circuits a channel-21 provider into a synthetic
`Disposition = "Bahrain Insurance"` eligibility without touching NPHIES at all.
[199](199-nphies-scope-of-acts.md) put Bahrain out of scope, so **in-scope channel is the constant
`"20"`**, and SIS.Api supplies it. Nothing to plumb, nothing to pick, nothing to derive.

This mattered more before the provider ruling. Had the acting store been the provider, the channel
would have been derivable from it — `PricingService.cs:61` already does `plant.DistributionChannel`
server-side, and `PricingRepoService.cs:44` defaults it to `"20"`. With no acting store in play,
SIS.Api has nothing to derive *from*, so pinning the constant is the only option — and it is correct.

**The condition that would reopen this:** a third distribution channel appearing in `NProvider`.
Then the channel becomes a real input and the provider list needs scoping. Worth one line in the
spec, not a ticket.

### 3. `UserId` / `StaffId` — the session's user id, server-stamped

`UaSessionEndpointFilter.cs:89-90` stamps **both** `UserIdClaimName` and `StaffIdClaimName` from the
same `session.UserId`, with the comment *"the person is who logged in, and their StaffID is the key
the authorization load resolves"*. So the oms-react session identity **is** the staff id — there is
no mapping layer to build, and `HttpContextMapping.GetUserAction()` already exposes both.

SIS.Api fills `UserId` / `StaffId` on the auth request, retry and cancel from that claim. The browser
never sends an identity. Confirmed acceptable on the Nphies side by inspection rather than assumption:
`NAuth.UserId`, `NRetry.StaffId` and `NCancellation.StaffId` are **stored and never read** — mapped
in NHibernate, echoed to the list DTOs, branched on nowhere. Any stable string is accepted.

### 4. `SourceCode` — the constant `'WEB'`, server-stamped

**Half of this question dissolved.** The `ProviderCode = StoreCode` / `OriginalProviderCode =
auth.ProviderCode` split the ticket asked about lives in `Claim()`
(`NphiesAuthResponsesController.cs:664-693`) — `ClaimType = 1`, which
[199](199-nphies-scope-of-acts.md) ruled **never ported**. It carries no meaning for v1.

What survives is plain `SourceCode` on the auth request, and its meaning is settled by inspection:
it is **provenance only**. `NAuth.cs:123` stores it, `AuthService.cs:152` copies it in,
`AuthForListDto` / `AuthLineResponseDto` echo it out, and the WPF list shows it as a 60px "Source"
column. **No logic anywhere reads it.**

Ruling: a web-raised authorization stamps **`'WEB'`**, server-side. The column stops answering
"which store" and starts answering "which channel raised this" — which, with no acting store
involved, is the only honest thing it can say. Till rows keep their store codes, so web traffic is
separable at a glance in the list and in support calls.

*Carried to the spec:* confirm the `SourceCode` column length accepts `'WEB'` before build — it is
an unlengthed `Property(c => c.SourceCode)` in `NAuthMap.cs:104`, and a store code is the only value
it has ever held. Three characters is almost certainly safe; it costs nothing to check.

### 5. Access — one grant for the whole screen

**No audience split.** Back-office and call-centre get the same acts. The suspected
back-office-chases-rejections / agent-raises-authorizations divide is not a real permission boundary
for the requester, so v1 does not encode one — no read-vs-write split, no eligibility-vs-auth split,
no separate cancel grant. This matches every other oms-react screen's precedent and keeps the
estimate flat.

Mechanism per this ticket's comment from [198](198-nphies-proxy-contract.md): a
`NphiesGrantEndpointFilter` deriving from `OmsGrantEndpointFilterBase`, alongside
`ApiKeyEndpointFilter`, on **all fifteen** endpoints. Because it is a single grant rather than a
matrix, it is one filter class applied uniformly — the cheapest shape available, and it honours
[146](146-export-gate-and-audit.md)'s "a client-only check is not a control" without argument.

**The live defect stands and is now scheduled:** `Nphies/CheckEligibility`
(`NphiesEndpoints.cs:28-30`) ships today with `ApiKeyEndpointFilter` and **no grant filter at all** —
an authenticated caller of any kind can check any patient's insurance coverage. It gets the new
filter with the rest.

### What this does to the estimate

Every branch here landed on the cheap side, and two priced items are now **removed** rather than
reduced: store entitlement (nothing to build) and channel plumbing (a constant). The one addition is
a provider picker on the eligibility form plus a provider filter on two lists — a single
`core/providers` lookup reused three times, with no defaulting rules, no stickiness, and no
validation. **The whole ticket is hours of client work, and the grant filter is already inside
[198](198-nphies-proxy-contract.md)'s 5–7 days.**

## Comments

**2026-07-31, from [198](198-nphies-proxy-contract.md) — question 5's *mechanism* is settled, only
the *policy* is open.** Server-side enforcement is a known shape, not a design problem: every
oms-react-facing SIS.Api endpoint carries `ApiKeyEndpointFilter` **plus** a per-feature grant filter
deriving from `OmsGrantEndpointFilterBase` (`BbyInquiryGrantEndpointFilter`,
`PricingCacheGrantEndpointFilter`, `UaUsersGrantEndpointFilter`). A `NphiesGrantEndpointFilter` is
that shape, and 198 already priced it inside its 5–7 days. So [146](146-export-gate-and-audit.md)'s
"a client-only check is not a control" is cheap to honour here — and **splitting the acts across two
grants is also cheap**, since the filter is per-endpoint. This ticket should decide the policy on its
merits without treating enforcement cost as a constraint.

One live defect to fold in: the existing `Nphies/CheckEligibility` endpoint has the API key but
**no grant filter at all** — whatever this ticket rules, that endpoint needs one.

## Comments

**2026-07-31 — corrected on the store by [208](208-nphies-the-auth-is-an-engine-document.md).**

This ticket ruled that **the acting store plays no part** and that `StoreSwitcher` is irrelevant to
this screen. That is correct about the **Nphies payload** and wrong about the **engine**.

208 established that a web-raised authorization opens a real `NphiesAuth` `PosTransaction`, and the
engine binds `PcHeader.Plant` from `StoreId` **once at open, never to change again**
(`CallCenterEngineSession.cs:491-493`). A transaction cannot open without a store, and the plant
prices every line - which is the money the payer adjudicates. So the store is invisible in the
request and decisive in the pricing.

**The ruling (requester, 208): the agent's acting store from `StoreSwitcher` is the plant.**
Consequences: it must be resolved **before the first item**, and switching stores mid-request is not
something the screen can offer. There is no store-to-provider mapping to lean on - `NProvider`
carries only `ProviderCode`, `ProviderId`, `License`, credentials, `IsBlocked` and
`DistributionChannel` - so provider and store stay two independent choices.

Everything else in this ticket stands: `ProviderCode` is still a free per-act pick, still inherited
read-only onto the auth, still a filter defaulting to *all* on the lists; channel is still the
constant `"20"`; `UserId`/`StaffId` are still the session user id; `SourceCode` is still `'WEB'`;
access is still one grant.
