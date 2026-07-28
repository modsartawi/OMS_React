---
type: spec
status: ready
---

# 160 — The web call-center console, phase 1 (spec)

> Client track of map [126](126-web-call-center.md). The server track is minted as BackOffice
> [785](C:\Work\DMSCO\BackOffice\.issues\785-web-cc-engine-session.md) ·
> [786](C:\Work\DMSCO\BackOffice\.issues\786-web-cc-submission-path.md) ·
> [787](C:\Work\DMSCO\BackOffice\.issues\787-web-cc-promotion-guidance-engine.md) ·
> [788](C:\Work\DMSCO\BackOffice\.issues\788-origin-seat-axis-and-coupon-parity.md) ·
> [798](C:\Work\DMSCO\BackOffice\.issues\798-plant-rebind-door.md) ·
> [799](C:\Work\DMSCO\BackOffice\.issues\799-cc-item-search-endpoint.md) ·
> [800](C:\Work\DMSCO\BackOffice\.issues\800-call-center-console-grant.md) ·
> [801](C:\Work\DMSCO\BackOffice\.issues\801-callcenter-web-door.md) ·
> [804](C:\Work\DMSCO\BackOffice\.issues\804-cc-session-contract-server-obligations.md).
>
> **The single source of truth for the wire is [CONTRACT.md](assets/136-cc-contract/CONTRACT.md)
> (frozen v1.0).** Where this spec and the contract disagree, the contract wins and this spec is
> wrong. Nothing here re-states a wire shape that document already fixes; it states what the
> *console* does with it.
>
> **Scope ruling, 2026-07-27:** this spec covers the **frozen core** only. Six charted-late tickets
> ([153](153-console-keyboard-grammar.md) · [154](154-fulfilment-mode-and-store-choice.md) ·
> [155](155-payment-type-cod-or-online.md) · [156](156-delivery-fee-shared-rule.md) ·
> [157](157-price-check.md) · [158](158-stock-in-other-stores.md) ·
> [159](159-coupon-and-loyalty-signup-drawn.md)) are **named and carved out** in
> [Out of Scope](#out-of-scope), each with what would have to be resolved to fold it in. Two of them
> (154, 155) are holes in the frozen contract and will need a contract revision, not just a ticket.

## Problem Statement

A call-center agent takes an order by phone, in WPF (CC1 `NewOrderController` + CC2), on a machine
someone has to install and keep at a version. The screen is organised around the engine's verbs, not
around the call: the agent hunts for the next input, the fulfilment store is chosen for them by a
rule they cannot see, and the promotion the basket *almost* qualifies for is invisible — so the
caller hangs up one item short of an offer nobody mentioned. The prices the agent quotes come from a
document builder running on their own machine, which means the thing that decides what the caller
pays is the least controlled part of the system.

The agent needs one screen, in a browser, that keeps up with a phone call: the caller's identity and
address to hand, the fulfilment store explained rather than merely applied, an item search they can
type into while talking (including in Arabic), a basket that prices itself, an honest statement of
what the order is *nearly* eligible for with one click to close the gap, and a total they can read
out that is the same total the till would compute.

## Solution

A full-viewport **agent console** at `features/callcenter/`, behind one access probe that fails
closed, driving SIS.Api's server-side engine transaction through the frozen v1.0 session API.

**Three fixed columns** ([135](135-agent-console-prototype.md), owner's pick from three built
variants): a customer rail at the start edge and a live receipt at the end edge that **never move**,
and a centre column that is the only region that grows — header chips → item search → basket →
offer strip. The furniture is at the same pixels at hour nine as at hour one.

The console **sends intent and never money**. Every mutating verb returns the whole `SessionState`
and the console renders it; there is no client-side patching, no client-computed total, and no verb
that accepts a price. "Are you sure" arrives on the **success** path as a `pendingConfirmation` token
that pins a previewed diff — one pattern for the plant rebind and the below-availability
acknowledgement, whose token *is* the fraud-signal audit record. A guardrail refusal is a banner with
the server's own words, not a crash surface. `SESSION_BUSY` is routine and looks routine.

The differentiator is the **guidance strip** ([138](138-near-miss-guidance-design.md)): every offer
the basket nearly qualifies for, as a card whose headline is what the offer *gives*
(`20% off`, `3rd free`) — never a savings total, which cannot be computed honestly — plus what it
needs (`add 1 more`, a meter, `any 1 from Oral care selection · 42 qualify`) and a ranked,
availability-filtered handful of items that would close it, each addable in one click.

## User Stories

**Getting in, and the order's lifecycle**

1. As a call-center agent, I want the console to open from the portal nav only when I actually hold the grant, so that I never land on a screen that will refuse every action I take.
2. As an agent without the grant, I want a refusal that tells me what I lack **and offers me a way out** (back to the portal, or sign out), so that a chrome-less full-viewport screen is not a dead end I have to close the tab to leave.
3. As an agent, I want opening the console to open a real order server-side, so that everything I do from that moment is on one transaction the server owns.
4. As an agent who already has an open order, I want to be told so — with the previous caller's name, line count and when it was opened — and to choose *resume* or *abandon and start fresh*, so that a new caller never inherits the last caller's basket.
5. As an agent, I want a refresh, a crash, or a closed tab to bring me back to the same order through the same choice, so that recovery is a path I already know rather than a special case.
6. As an agent, I want abandoning an order to be an explicit act with a confirmation, so that a mis-click does not void a basket I spent five minutes building.
7. As an agent, I want a second tab on the same order to show the same basket rather than a diverging copy, so that two windows are a convenience and not a hazard.
8. As an agent whose forgotten tab still shows an abandoned order, I want an action from that tab to be refused with "this order is closed" and return me to the start, so that it can never write onto the order I am on now.

**The caller and where the order goes**

9. As an agent, I want the caret in the phone field the moment the console opens, so that the first thing I do on a call is the first thing the screen expects.
10. As an agent, I want to attach the caller and see a compact identity card (six fields, no more), so that the caller's details stay visible without stealing the screen.
11. As an agent, I want the address book to be reachable only once a caller is attached, and I want that order to feel intended rather than enforced, so that I never reach a control that answers with a refusal.
12. As an agent with a caller attached and no address yet, I want the rail to show an empty address slot with its own *Pick an address* action, so that the next step is obvious without reading a message.
13. As an agent, I want the fulfilment store to be **derived from the address** and shown as a chip that says it was derived, so that a store I did not choose reads as explained rather than arbitrary.
14. As an agent, I want to override the fulfilment store deliberately, so that an operational reality the derivation does not know about can still be honoured.
15. As an agent changing the address or the store on a basket that already has lines, I want to be shown exactly what moves — line by line, promotion by promotion, availability re-freeze included — before anything changes, so that I never discover a re-price by reading it out to the caller.
16. As an agent, I want a store change that would leave a line unpriceable to be **refused whole**, naming the line, with nothing partially applied, so that "nothing changed" is a state I can trust.
17. As an agent, I want the refused line named in the banner *and* tinted in the basket, so that I can see which line to void without cross-referencing.
18. As an agent, I want a preview I decline to cost nothing, so that checking "what would happen if" is free.
19. As an agent, I want to set a delivery slot and be warned rather than blocked when it lapses, so that a soft rule stays soft.
20. As an agent, I want to record the document source and its mandatory reference, so that the order can be traced back to the campaign or system that produced the call.
21. As an agent, I want a settled header section to collapse into a chip and re-open in place, so that my eye is always on the next input rather than on fields I have finished with.
22. As an agent, I want a chip that still needs something (no slot, no reference) to *look* like it needs something, so that I do not reach submit to discover it.
23. As an agent, I want removing the caller to clear the address but keep the derived store, so that re-attaching a caller does not silently re-price the basket.

**Building the basket**

24. As an agent, I want to search the catalogue by part of a name, in English **or Arabic**, or by item-number prefix, so that I can find what the caller is describing in the words they used.
25. As an agent, I want every search row to carry availability at the order's store, so that I know before adding whether it can be fulfilled.
26. As an agent, I want *unknown* availability to look nothing like *none* — different ground, ink and words — because they are opposite decisions for me.
27. As an agent, I want the catalogue price on a search row to be visibly an **estimate before VAT** and never to appear in the money column, so that I cannot quote it to a caller as what they will pay (it reads ~13% under the basket line).
28. As an agent, I want the search panel to carry a standing note that catalogue prices are estimates and the basket price is what the caller pays, so that the rule is stated once and not inferred per row.
29. As an agent, I want to add an item in one action from a search row, so that adding is not a two-step ritual mid-sentence.
30. As an agent, I want to change a line's quantity, its unit of measure, and to void a line, so that ordinary corrections do not require starting over.
31. As an agent adding beyond availability, I want to be shown the number I am exceeding and to accept it deliberately, so that the acceptance is mine and is recorded as mine.
32. As an agent, I want that acceptance never to be a block, so that a soft gate stays soft and the order can still be taken.
33. As an agent, I want no confirmation at all when availability is simply unknown, so that a degraded stock service never gates order entry.
34. As an agent, I want each basket line to show what it costs, what promotions fired on it, and the availability **as frozen when I added it**, so that frozen and live availability never read alike.
35. As an agent, I want the receipt's totals — net, VAT, delivery fee, payable — to be the engine's numbers, so that what I read out is what the caller is charged.
36. As an agent, I want the delivery fee to be quoted live as the basket changes, so that crossing a threshold is something I see rather than discover at submit.

**Promotion guidance — the reason this screen exists**

37. As an agent, I want every offer the basket nearly qualifies for to be visible without opening anything, so that I can mention it while the caller is still on the line.
38. As an agent, I want the offer's headline to be **what it gives** (`20% off`, `3rd free`, `both for 29.95`), so that the value is legible at a glance rather than buried under a promotion name.
39. As an agent, I want the console never to quote me a savings total, so that I never promise a number the engine has not actually computed.
40. As an agent, I want *actionable*, *already counted* and *not available here* offers to be told apart by rank, treatment **and words** — not by colour alone — so that three different decisions never look like one.
41. As an agent, I want an offer that cannot fire here to say why in my words (`not offered on call-center orders`), so that I can answer the caller instead of reading a code.
42. As an agent, I want a grouping prerequisite stated honestly as a set (`any 2 from these · 42 qualify`), so that I never imply the caller must buy one specific item.
43. As an agent, I want a ranked, availability-filtered handful of qualifying items on the card, so that I can suggest something real without leaving the screen.
44. As an agent, I want each qualifying row to carry the item's Arabic name, so that the row I read aloud is the row the caller recognises.
45. As an agent, I want a route to the rest of a large set (`Search the other 994`) that hands off to the item search filtered to that offer, so that a big set never becomes a second screen.
46. As an agent, I want one-click add from a qualifying row, with the in-flight state on the row I clicked and the row not moving while it runs, so that I do not lose my place.
47. As an agent whose add **fired** the offer, I want to see it move to the fired list, so that success is visible.
48. As an agent whose add fired a **different** offer, I want to be told that, so that I can tell the caller what actually happened.
49. As an agent whose add fired **nothing**, I want the offer to stay with its meter advanced and a banner naming what was added and what is still needed, so that silence never reads as a broken button and a vanished card never reads as a bug.
50. As an agent, I want the region to acknowledge once, quietly, that buy-one-get-one offers are not checked yet, so that partial coverage is stated rather than hidden — and I want that line to disappear on its own when the server starts sending them.
51. As an agent reading search results, I want an offer that arrives while I am looking elsewhere to announce itself in the top bar count, so that guidance is not something I have to remember to look at.
52. As an agent, I want no figure formatted as money anywhere in the guidance region, so that nothing in it can be mistaken for what the caller pays.

**Finishing, and when things go wrong**

53. As an agent, I want *Place order* pinned to the foot of the receipt where it never scrolls away, so that the last action of the call is always in the same place.
54. As an agent, I want submit disabled with the reason named while something is missing, so that I fix the reason rather than guess at it.
55. As an agent, I want submit to be the one moment with **no optimism** — the button says "Placing the order…" and the receipt holds until an order number exists — so that I never confirm an order to a caller that then fails.
56. As an agent, I want an order number on success, so that I can give the caller a reference.
57. As an agent whose submit is refused, I want the field to fix named and the order still open, so that a refusal is a correction and not a lost basket.
58. As an agent whose submit is temporarily unavailable, I want to be told it is retryable and to keep my order, so that a transient outage does not read as "unexpected error".
59. As an agent who submits twice, I want the second attempt to be a success carrying the same order number, so that an ambiguous retry never mints a second order.
60. As an agent, I want a busy collision to show as a non-blocking strip that says it is retrying **and** that typing still works, so that a routine mutex never looks like a fault.
61. As an agent, I want a still-busy state after the retries are exhausted to offer me a manual retry, so that I am never stuck without an action.
62. As an agent, I want a slow response that arrives after a fast one to be discarded rather than rewinding my screen, so that the basket never goes backwards.
63. As an agent, I want a refusal to keep the state it refused from, so that the screen after a refusal is the screen I was on.
64. As an agent, I want an expired session to bounce me to login with a single toast, so that a background call failing never leaves me clicking a dead screen.
65. As an agent, I want a console built for a client version the server no longer speaks to refuse to run and ask to be updated, so that it can never mis-render money.

## Implementation Decisions

### Where the code lives

- **`features/callcenter/`** — its own area folder under `.claude/rules/feature-structure.md`,
  behind the URL prefix `/callcenter` (map note 13). One route, one Page. The feature owns its
  `api.ts`, its pure modules, its components and its i18n namespace, and imports **only** from
  `@/core/*` — never from another feature.
- The console renders its **own full-viewport layout** inside the shell's session/auth/theme, not
  the standard `AppShell` nav chrome (note 13). Consequence, already ruled in
  [134](134-access-and-authorization.md): a refusal inside it is a **dead end**, so the denial screen
  and the already-open screen each carry their own way home.
- **Access** follows ticket 125's pattern: one shared query key serves both the nav leaf and the
  route guard, the probe answers one boolean (`canOpenConsole`), and it **fails closed** — an
  unresolved or errored probe renders the denial, never the console.
- The prototype code (`features/callcenter/__prototype__/`) is **not** the build. It lives on
  branches `prototype/135-callcenter-console` and `prototype/138-near-miss-guidance` and stays there;
  the build starts from the rulings, not from the variants.

### State: the query cache is the store of record

Contract law 2 (every mutating verb returns the whole `SessionState`) makes the client a pure
render-of-latest-state, so it needs no reducer and no delta protocol:

- **TanStack Query holds the `SessionState`** under one key per `transactionId`. `getState` is the
  query function (refresh, recovery, reload, second tab). Every mutation is a `useMutation` whose
  `onSuccess` writes the returned state into that cache entry.
- **The write is guarded, not blind.** A single pure `applyState(current, incoming)` decides: an
  incoming `version` lower than the rendered one is **discarded** (contract §2.1 — this is what stops
  a slow response rewinding the screen), equal is idempotent, higher applies.
- **`contractVersion` is checked on the first response of a session.** A major mismatch is a hard
  stop with its own screen; minor drift in either direction is ignored by rule (unknown fields are
  ignored, so an additive server change ships without a client release).
- **zustand holds only ephemeral UI** that no server response can own: which chip is open, which
  offer card is expanded, search box text, focus intent. Nothing derived from `SessionState` is
  duplicated into it.
- **`capabilities` drives enablement.** The console never re-implements a server predicate; a
  disabled control is disabled because `capabilities` said so, and `submitBlockers` is what names the
  reason. A client that ignores it would get a typed refusal rather than a wrong order, which is the
  property that lets enablement be advisory.

### `features/callcenter/api.ts`

- Every call goes through `@/core/api` per `.claude/rules/api-envelope.md`. No `fetch`, no hand-built
  envelope, no re-implemented error mapping. `apiErrorCode()` is how the console branches on the
  taxonomy; `apiErrorMessage()` is how it displays.
- **`SESSION_BUSY` retry lives here and only here** (contract §6.1): backoff `0 · 400 · 800 · 1600 ·
  3200 ms`, a ~15 s ceiling matching the worst-case self-lockout, then surrender to the still-busy
  state with a manual retry. It must **never** enter `src/core/api.ts` — lease semantics have no
  business in the layer every back-office grid shares.
- **`requestId` is minted per user action** (ULID), reused verbatim across every retry of that
  action, **including the retry that carries a `confirmToken`**. One action = one id. A `replayed:
  true` response renders identically and suppresses the duplicate toast.
- **`transactionId` is explicit on every verb.** There is no "my current order" resolution anywhere
  in the client.
- 401 stays `handle401`'s business; the console catches it nowhere.

### The three surfaces that carry the ruling

**Header chips** ([135](135-agent-console-prototype.md)). Store · slot · source · ref collapse to
chips in a fixed row above the basket, each re-openable in place. A chip carries one of three states:
*settled* (neutral), *needs attention* (attention ground — derived from `capabilities.submitBlockers`,
not from a second client rule), *derived* (a parenthetical, so a store the agent did not choose reads
as explained). The state derivation is a **pure module**, not JSX.

**Item search.** `itemSearch` off the call-center door, at the order's plant, no paging (a cap plus
`truncated` — the agent retypes). Two ruled properties are the build's problem, not the server's:

- The **estimate never enters the money column.** It renders on the item's second line beside the
  item number, with `≈` and the muted register, and **no currency word** — `SAR` is reserved for
  engine money. The row's end edge carries availability and *Add* only.
- **Availability renders three ways** — a count, *none at store*, *? stock unknown* — differing in
  ground, ink **and** wording. Basket lines use the same pill labelled *at add*, so frozen and live
  never read alike.

**Guidance strip** ([138](138-near-miss-guidance-design.md), variant 1 as ruled). Under the basket,
wrapping vertically — never a horizontal scroll — with the actionable count mirrored in the top bar.
The two corrections the ruling depends on are load-bearing and must ship with it: an **open card
spans both columns**, and the **strip body is clamped (18rem) with the outcome banner pinned outside
it**. The default-open card is the top-ranked actionable offer **by construction**, never a hardcoded
id. The inline handful is **three, server-side `topN`** — a client slice would re-introduce the
below-the-fold failure the drive found. Item rows carry `description2` on the **meta line** (beside
item number and estimate), which is what makes the Arabic ruling cost zero pixels.

### The money rules, stated once as properties of regions

- The **guidance region holds no engine money at all**, so it can guarantee absolutely what the
  search panel can only guarantee per row: **no figure formatted as money** (`12.00 SAR`) appears in
  it. The rule is *formatted as money* — not "no `SAR` anywhere" — because real BBY descriptions
  carry currency words the console may not edit (`"2 PC for 29.95 SR"` is in this repo's own 098
  captures).
- **The console never sums lines.** `totals` is engine truth (contract §2.1).
- **`wouldSave` does not exist** and no client-side equivalent may be computed.

### Confirmation — both kinds are modal

`pendingConfirmation` arrives on the success path with the **unchanged** state. Both kinds render as
a **modal sheet** over the console (135's ruling: an inline card in a scrolling flow can be scrolled
past, and a below-availability acceptance *is* the audit record). Accepting re-sends the **same verb
with the same `requestId`** plus the token. `CONFIRM_TOKEN_STALE` means the basket moved underneath:
the console re-sends **without** the token and re-shows the fresh preview rather than committing a
diff the agent never saw. Tokens are single-use, two-minute.

### Reused, graduated, and deliberately not built

- **`promo-view.ts` graduates** from `features/pricing/simulation/` to `@/core/` (a feature may never
  import a feature). 🚩 Its `:368` prints a percent as money and **must be fixed as part of the
  graduation** — shipping that into the guidance region would violate the region's own money rule.
- **A `dir`-pinned bidi wrapper** in `@/core/ui/` for an Arabic run inside LTR chrome. A bare `<bdi>`
  implies `dir="auto"` and flips the block RTL, detaching the Arabic from the line it belongs to;
  `dir` must be pinned. This is the mirror case of `core/ui/Ltr` (ticket 121) and is a build-level
  constraint, not a prototype detail.
- **The header reference reads stay where they are.** `Cities`, `Districts`, `AddressLabels`,
  `DocumentSources`, `DocumentTypes`, `StoreDetails`, `AvailableSlots`, `SlotIsActive` are off the
  door ([137](137-callcenter-web-door.md)) and already served by `@/core/services/lookups.ts`.
- **The client does not derive the fulfilment store.** The plant is derived server-side at
  `setAddress` and returned in the confirm preview (`fromPlant`/`toPlant`). `deriveStoreCode` in
  `features/oms/document/` therefore does **not** need to graduate for this spec, and a second
  client-side derivation must not be introduced — two derivations of "which store serves this
  address" is how the console and the engine start disagreeing.
- **Fixtures**: `features/callcenter/__fixtures__/payloads.ts` imports 136's eight provisional
  payloads from `.issues/assets/136-cc-contract/`, following ticket 098's pattern — test-only, never
  in the bundle. 🚩 They are **provisional by construction**: no client test may treat a fixture
  *value* as evidence of engine behaviour, only its **shape**. They die at the backend's
  `CcContractFixtureTests` and are replaced by captures at first integration — note 15's one budgeted
  contract revision.

### i18n

A new `callcenter` namespace, registered in `src/core/i18n.ts`. Every label, chip word, refusal
explanation, confirm copy, availability wording and guidance class phrase is a key
(`.claude/rules/i18n-zero-literal.md`). **Server-supplied text is passed through as data**: the
envelope `message` on a refusal, the BBY description on an offer card, the item description and
`description2` — these carry no keys, and the console must not attempt to edit them (which is
precisely why the money rule is *formatted as money* rather than *no currency word*).

## Testing Decisions

A good test here asserts **observable behaviour at a module's edge** — the state a guard admits or
discards, the delays a backoff yields, the classes and order a guidance list projects, the words a
chip carries — and never how the module got there. No test asserts on internal state, call ordering,
or a React implementation detail.

**Ruled 2026-07-27: this feature does NOT bootstrap React Testing Library.** Spec 083's standing
ruling holds — the pure modules carry the regression risk, components stay thin renderers, and a UI
slice is verified by driving the real app plus `typecheck`. That is how every ticket in this repo has
shipped, 148–152 included. The cost is accepted and named: the modal confirmation flow and the
in-flight states get **flow coverage only**, with no fast component-level net.

**Tier 1 — pure, in-memory (`vitest`, `environment: node`, the existing runner).** All of these are
new modules and can be shaped for testability from the start:

1. **The staleness guard.** `applyState(current, incoming)`: a lower `version` is discarded, equal is
   idempotent, higher applies; `contractVersion` major mismatch is a hard stop and minor drift is
   not. This is the module that keeps a slow response from rewinding the basket — a failure nobody
   would reproduce by hand.
2. **The `SESSION_BUSY` backoff.** Driven with a fake page fetcher and an injected sleep: the
   schedule is `0 · 400 · 800 · 1600 · 3200`, the ceiling is bounded, a success mid-schedule stops
   it, and a non-`SESSION_BUSY` error is rethrown untouched rather than retried.
3. **The guidance view-model.** Near-misses in, cards out: the three classes, ready-first order,
   `topN` respected as the server sent it (never re-sliced), `skipReason` mapped to an agent-facing
   key for every category including an unknown one, and the region's money property — **no cell
   formatted as money** — asserted over a fixture that deliberately contains a BBY description with a
   currency word in it.
4. **Header-chip state.** `capabilities` + `submitBlockers` + header fields in, chip states out:
   settled / needs attention / derived, and *derived* only when the plant came from the address.
5. **The request-id discipline.** One action mints one id; a retry of that action reuses it; a
   confirm re-send reuses it; a genuinely new action does not.
6. **`promo-view.ts` at its new home**, with the percent-printed-as-money defect covered by a
   regression case — the existing suite moves with it.
7. **Fixture shape conformance.** The eight payloads parse into the model types and satisfy the
   contract's structural invariants (every mutating result is a whole `SessionState`; a
   `pendingConfirmation` response carries the *unchanged* state; `wouldSave` appears nowhere).

**Tier 2 — flow (Playwright drive, manual-run, against a stubbed envelope).** Prior art:
`tools/guidance-138-drive.mjs` (91/91) and `tools/ua-users-scale-drive.mjs`. The acceptance surface
already exists and should be reused verbatim — **135's thirteen states** (`empty · attached ·
searching · priced · prereq · belowAtp · rebindPreview · rebindRefused · busy · submitting ·
submitRefused · refusedExisting · denied`) and **138's nine** (`three · bigSet · adding · didNotFire ·
firedOther · many · readyOnly · none · getSideLanded`). The drive stubs the eight contract fixtures at
the route layer, so the client is driven against the frozen shapes rather than a hand-rolled mock.

Two assertions the drives owe that a screenshot would not catch, both learned the hard way in 138:

- **A clamped region hides the cost of new content.** The strip's height does not move when content
  grows — it scrolls. The drive must assert **what is visible**, not only how tall the region is;
  `Search the other N` going below the fold is a real regression that every height check passes.
- **No figure formatted as money in the guidance region**, asserted in the narrow form. The broad
  form (`no SAR anywhere`) fails on server text nobody may edit.

**Integration.** Until SIS.Api ships the door, every slice is verified against the stubbed envelope —
the approach tickets 051/052 used while SIS.Api was unavailable, and the same one 152 used for a
field the server does not send yet. The first live integration is expected to produce **one
deliberate contract revision** (note 15); the fixtures are replaced by captures at that moment, as
one event.

## Out of Scope

**Carved out of this spec but real work on this map** — each named, with what would unblock it:

- **[153](153-console-keyboard-grammar.md) — the keyboard grammar.** ✅ **Settled 2026-07-29 and
  ready to fold in as an additive revision** — no contract change and no server work. The answer:
  **four keys and a palette** (`Ctrl+K` · `↑↓` · `Enter` · `Esc`), and **no single letters** — the
  focus gate this carve-out named is dead here, because the resting focus is a text box twice over.
  🚩 It also found that the map's headline feature ships **mouse-only**: neither a search row's *Add*
  nor a guidance card's has any keyboard path, so `↓`+`Enter` on the search rows is a **gap in what
  this spec shipped**, not just an ergonomic addition. Read 153's table before writing the stories.
- **[154](154-fulfilment-mode-and-store-choice.md) — fulfilment mode (delivery vs pick-in-store)**
  and **[155](155-payment-type-cod-or-online.md) — payment type (COD vs online).** 🚩 These are
  **holes in the frozen contract**, not just undrawn screens: `Cc2DocumentHeaderBuilder` writes both
  onto the CLCN document today and contract v1.0 has no axis for either. Folding them in needs a
  **contract revision** (§9's major/minor protocol and an owner ruling), not a client ticket. This
  spec assumes the delivery, cash-on-delivery defaults the WPF path defaults to, and says so out
  loud rather than implying the question is closed.
  ✅ **Both carve-outs are spent, 2026-07-29** — [176](176-fulfilment-mode-drawn.md) drew the axis
  (and 155's payment chip with it, because the chip's WORD follows the mode) at contract **v1.8
  §2.6**. What the build owes, as acceptance surface:
  1. **The chip row gains two chips and loses one conditionally**: `fulfilment` **first** and always
     settled, `payment` last and settled; the `slot` chip is **absent under `PickInStore`**, not empty
     and not disabled.
  2. **The customer rail's second block is one block with two faces** — *Address* under delivery,
     *Collecting from* under collection, **at the same pixels**. This is testable and must be tested:
     if the flip moves anything under it, the drawing is wrong.
  3. **The receipt draws no delivery region at all under `PickInStore`** — this is (b) below, and it
     is where it becomes reachable.
  4. **The store chip carries no *(derived)* parenthetical under collection**, whatever `plantSource`
     says: capture 09 keeps `derivedFromAddress` in a response that also carries `address: null`.
  5. **Nothing is drawn where the slot chip was.** Owner ruling — a collection order has no collection
     time, and the console must not imply one.
  6. **`header.retainedAddressLabel`** draws one muted line in the collection block. 🚩 It is
     server-supplied by ruling: a client that remembers the last address IT saw is blank after a
     refresh and in a second tab.
  7. **`capabilities.capabilityReasons`** words a shut `canChangeFulfilment` (delivery-only source)
     and a shut `canChangePaymentType` (⚠ unreachable in phase 1, implemented anyway). A shut
     capability removes the chip's handler and prints its reason beside the row.
  8. **`STORE_NOT_CHOSEN`** must be in the blocker table — 175 ruled it and this client never got it.
  Prototype and captures: [assets/176-fulfilment](assets/176-fulfilment/), branch
  `prototype/176-fulfilment-mode`.
- **[156](156-delivery-fee-shared-rule.md) — the delivery fee rule.** The console **displays**
  `totals.deliveryFee` including its `waived` outcome, because the contract already carries it. Owner
  ruling stands: rule-driven, **no manual waiver** — `waived` is an outcome shown, never a control.
  ✅ **Resolved 2026-07-29, and the carve-out is spent**: the rule is no longer WPF-resident —
  BackOffice 786 §2 extracted `CallCenterDeliveryFeePolicy` as the one copy the till, the live quote
  and the submit all call, and the campaign window became `PosConfig` rows rather than a recompile.
  Two client-side amendments fall out. **(a)** Contract **v1.5** adds
  `deliveryFee.waivedReason` — the waived state draws its reason (`ThresholdReached` /
  `PromotionalWindow`), never a bare green word, because today the *"free over …"* line is gated on
  `!waived` and so vanishes at the instant it would explain itself. The console **must not** derive
  the reason by comparing `gross` against `thresholdGross`. **(b)** Under `PickInStore` the fee region
  is **absent, not zero** — recorded on [176](176-fulfilment-mode-drawn.md), which draws the mode axis
  and is where it becomes reachable.
- **[157](157-price-check.md) — price check** and **[158](158-stock-in-other-stores.md) — stock in
  other stores.** Both ruled into phase 1 by the owner but never charted; 158 is the first thing on
  this map needing geo. Each needs its own endpoint contract before it can be drawn.
- **[159](159-coupon-and-loyalty-signup-drawn.md) — coupon and loyalty signup.** `applyCoupon` is
  verb #10 in the frozen contract with `COUPON_REJECTED` / `COUPON_ALREADY_APPLIED` already in the
  taxonomy — the wire is settled and the **surface is simply undrawn**. It is carved out here so the
  console is not built with a coupon control invented on the spot; folding it in is a drawing job
  plus a ticket, with no contract question open.

**Out of scope for the map itself** (map 126, unchanged by this spec): every non-CLCN order kind
(Nphies, Wasfaty, insurance, P2E); `replaceLine`, placeholder/text lines and prescription controls;
the web till in all its parts; **any price-affecting operator power**; the physical CC device's
origin setup; a multi-call agent shell; the legacy POS; closing the pre-existing PII exposure on the
shared `SdDocument/*` and `Loy/*` routes; and a store rebind with no operator action.

**Not this spec's to answer, still fog on the map**: the latency budget and where it is watched (two
independent latency surfaces on one screen — resume-per-request and the non-sargable item search);
observability and ops (web CC attempts never reach `PosIntegrationAttempt`); price-parity assurance
web vs till; Arabic/RTL for the console as a whole *layout* (as opposed to the Arabic item names
ruled in here); and rollout — whose hard prerequisite is already ordered by 134 (every agent bound to
`CALL_CENTER_AGENT` in Authz Admin, query-verified, **before** the SIS.Api carrying the grant filter
deploys).

## Further Notes

- **The contract is the boundary between the two tracks, and it is a forecast.** Both tracks build
  against [CONTRACT.md](assets/136-cc-contract/CONTRACT.md) and meet at an integration slice. Note 15
  budgets exactly one deliberate revision after first integration; enforcement is the backend's
  `CcContractFixtureTests`, and a drift the version rules permit shows up there as a diff to accept.
- 🚩 **The most fragile thing on the map is server-side and this client cannot compensate for it**:
  the two-store write ordering (reserve the `requestId` *with the version it is about to mutate from*
  **before** the engine mutation). If it is got wrong, a crash makes a retry double-apply a line on a
  real order. The client's `requestId` discipline is necessary and not sufficient — it belongs in
  804's acceptance tests.
- **The cutover is the likeliest way this fails on day one**, and it is not a code path: seeds bind
  no holder, and the only path minting the `UaUser` shell is first role assignment in Authz Admin, so
  an activated agent is refused **silently** until bound (134).
- **What the map learned from the gap review is worth carrying into `/to-tickets`**: every one of the
  six late-found features is a thing the **agent does**, and the charting was organised around the
  **engine's verbs** — which is why the verb list looked complete while the console did not. Slice
  tickets by what the agent does, not by which verb they call.
