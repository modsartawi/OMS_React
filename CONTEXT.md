# OMS Portal

The back-office web portal for the OMS (Order Management System) — a React SPA over SIS.Api.
This glossary is the project's ubiquitous language; `/domain-modeling` maintains it. It holds
**what words mean**, nothing about how code is written (that's `.claude/rules/`) or why a decision
was made (that's `docs/adr/`).

## Language

**Delivery document**:
An order's delivery record — the row shown on the Screen 1 inquiry grid and drilled into on
Screen 2. Carries a `DeliveryNo`, store, status, and shipping details.
_Avoid_: shipment, order (an order can have several delivery documents).

**Delivery timeline**:
The row of **steps** a delivery shows for where it stands: **Created → Ready → Out for delivery →
Delivered**. A pick-in-store delivery skips Out for delivery, and its ending is still *Delivered*
(there is no "collected"). It is drawn from the current status columns, not replayed from the Log.
Payment is **not** a step; it is a due/paid tag. A cancellation **replaces the next step** with
*Cancellation requested* or *Cancelled*, and the steps after it are dropped. A failed job is never
a step (ticket 369).
_Avoid_: status (a delivery has thirteen of those, and the timeline is derived from them), progress
bar, stage.

**Reached** (of a timeline step):
A step is reached when the current status columns say so: Ready on `readyStatus` R/C, Out on
`deliveryStatus` O, Delivered on `deliveryStatus` D. It is never inferred from a time or from
`statusHistory`.
_Avoid_: completed, passed.

**Rewind** (of a delivery):
An action that moves a delivery **back** on its timeline: *returned by driver* (`DRBK`, needs
reschedule), *rescheduled* (`DRSC`) or *courier changed* (`DCHC`). The timeline shows where the
delivery is now and marks the step it fell back to. The full back-and-forth lives in the activity
feed.
_Avoid_: reset, rollback, failure (a rewind is a normal operational move, not an error).

**Milestone time**:
The time a timeline step was reached. On Details it is the `entryTime` of the latest Log row whose
action reached the step. On the list's inspector it comes only from the row's `entryTime` /
`outForDeliveryTime` / `actualDeliveryTime`. A reached step with no source shows no time, never a
guess. `statusHistory` carries **no** time (its row time is `DateTime.MaxValue`). BackOffice's
`SdDocumentHeaderAction` holds the real milestone times, but they are not on the wire yet.
_Avoid_: timestamp of the status, changed on (`changedOn` moves on every action).

**Donor request**:
The order store's named ask to **one** donor store for units it cannot fill. The full meaning (its
states, who may act on it, the DRTR transfer that moves the units) lives in BackOffice
`CONTEXT.md`; this app only reads it, on the Delivery timeline (ticket 429).
_Avoid_: transfer request, borrow (the transfer is one moment of a request, not the request).

**Donor moment**:
A point on the Delivery timeline taken from a donor request's **own** record, not from the
delivery's Log: raised, edited, picked, stamped, transferred, ended. Each is the request's latest
time for that moment (a repick replaces the earlier one), and an unset time is no moment.
_Avoid_: donor log, donor event (neither is a Log row).

**Failed donor transfer**:
A donor request whose transfer HQ must deal with: either its DRTR job failed or is still
retrying, or the request was cancelled but its transfer posted anyway (**reverse by hand**). The
list of them is a work queue, not a history; a line leaves it once it is dealt with.
_Avoid_: failed donor request (the request did not fail, its transfer did).

**Reverse by hand**:
A failed donor transfer whose stock already moved in SAP although the request was cancelled. It is
never re-run; what HQ owes is the reversal of its STO in DRS.

**Re-run**:
HQ asking the outbox to run a **failed** donor transfer's job once more, after fixing its cause. A
job still retrying belongs to the outbox and is not re-run. Re-running posts stock, so it is its
own permission apart from reading the list.

**Document payment**:
One payment line of a document (order or delivery): its type, method, card, amount and reference,
read beside the document's delivery and invoice. Read-only here.

**District**:
A delivery area inside a **city**, assigned to the store that serves it (with an insurance store
and a temporary store beside it). Cities and districts are shared geography: an order's address
resolves to a district, and the district names its store.

**Document source user**:
A staff user pinned to one **document source**, the "how did this order arrive" a document records
(not the seat it was typed at). One source per user.

**Delivery inspector**:
The resizable panel beside the Deliveries grid that shows the **selected row**. It is drawn from
the list row alone and never fetches, so stepping through rows is free. It is **read-only**: its
commands hand off to Delivery details, which owns every act. Items, the Log, Jobs and the customer
OTP are not in it (ticket 367).
_Avoid_: inspector on its own (the **IDoc Inspector** is a whole screen), preview, drawer, details
pane (Delivery details is the record page).

**Lens** (of the Deliveries list):
A built-in narrowing of the rows **already loaded** — All, Needs attention, Cancellation requested,
Dawaa Now, Rescheduled. It never calls the server, so its count is the loaded rows it matches, read
as a lower bound ("7+") when the search was cut at its limit (ticket 366).
_Avoid_: filter (a filter is one of the 14 search criteria, or an AG Grid column filter), view,
queue, tab.

**Saved view** (of the Deliveries list):
One operator's named bundle of **criteria** (dates kept relative, so "today" stays today), a
**lens**, the column layout and the grid's column filters. Applying it runs its search. It lives
in that user's browser only: there are no shared views (ticket 366). One may be the user's
**default view**, which applies and runs when the list opens with no search in memory. A
**layout-only view** is one imported once from the old app's shared layouts: applying it sets
the columns and filters and runs nothing, and re-saving it makes it a full saved view (ticket 400).
_Avoid_: variant, layout (a layout is only the column part), preset, view on its own.

**Store**:
A physical branch the signed-in user acts on behalf of. The **acting store** is the one currently
selected in the store switcher; server calls are scoped to it. Identified by `storeCode`.
_Avoid_: branch, site, location.

**Session**:
The server-owned `sis_session` behind an HttpOnly cookie. The client `useSession` store
(`src/core/session.ts`) is a **display mirror** of it, never the source of truth — `Auth/Me` and
401s are. "Signed in" means the server still honours the cookie.
_Avoid_: login state, auth token (there is no client-held token).

**Engine session**:
A live transaction the browser drives on the Till Submission Platform — the call centre's order, and
(spec 209) the Nphies authorization request. Every mutating **verb** returns the *whole* state; the
client renders the latest and never an older one, which is the one rule `src/core/engine-session/`
owns for both. A different thing entirely from **Session** above, which is the auth cookie: an engine
session is a document being built, is identified by a `transactionId`, and ends by being submitted,
abandoned or swept.
_Avoid_: session (unqualified — it collides), draft (there are none; leaving abandons).

**Envelope**:
The universal SIS.Api response shape `{ statusCode, success, message, errors, data }`
(`HttpGeneralResponse<T>`). Every server call returns one; `src/core/api.ts` unwraps `.data` and
turns `success:false` / non-2xx into a typed `ApiError`.
_Avoid_: response wrapper, payload.

**Guardrail refusal**:
A business rule the server enforces by answering with the envelope `success:false` and a machine
code (`LAST_ADMIN`, `SYSTEM_ROLE`, `IN_USE`, `DUPLICATE_NAME`). The UI explains it from that code —
it is a designed outcome, not an error.
_Avoid_: validation error, failure.

**Close** (of a document):
**Cancelling it.** Not completing it — the trap this word sets. The close-commands are all
cancellation: **request close** asks for the order to be cancelled and carries a reason from
`CANCEL_REASONS` as its note, **close** cancels the order, and **force close** cancels it overriding
whatever blocked the normal path. A cancellation request is **final**. The fourth command, **cancel
close request** (`DCCR`/`OCCR`, "Withdraw Request"), is retired: the owner ruled it out on
2026-09-25 (BackOffice 2022), and the server refuses it (`CloseRequestIsFinal`). A request is
normally followed by the `AutoClose` worker's **close**. Nothing a back-office
operator does on Document Details is a positive outcome — orders complete in the field, never from
this screen — with **one named exception**: **Mark delivered** (BackOffice ADR 0065, ticket 2422).
An operator holding the `OmsMarkDelivered` grant may mark a category-`D` delivery that is out for
delivery (`O`), with no cancellation pending, delivered — with a reason from the server's `DLVM`
list. It runs the field's own `DDLR`, it is hidden without the grant, it never takes the promoted
commit slot and it carries no check mark. Nothing else on the screen becomes a positive outcome.
User-facing labels therefore say *cancel* ("Cancel Order", "Request Cancellation");
the `CommandKind` identifiers and `actionType` codes keep the `close` spelling.
_Avoid_: complete, fulfil, finish — and never pair `close` with a success/check affordance.

**Command family**:
Which of a screen's commands share a purpose, and therefore a colour, in the action bar. Document
Details has two — **fulfilment** (reschedule, change store: changes when or where, keeps the order
alive) and **cancellation request** (request close, cancel close request: the reversible round-trip
*about* cancelling). Two commands sit outside any family, in the **quiet tier** (add note, return
document — frequent and low-consequence, outlined not filled), and two form the **terminal tier**
(close, force close — the commands that end the order, red, pinned to the end of the bar). A family
is a *colour*; a tier is a *position and weight*. A new family colour is minted only when a screen
has two or more commands sharing a purpose.
_Avoid_: action group, category (a family is specifically the colour-carrying grouping; nav areas
are not families).

**Command cluster**:
A labelled group of commands on the action bar — the unit a cluster label sits above. Document
Details has three, in order of increasing consequence: **fulfilment**, **cancellation request** and
**notes & docs**. The first two are families; the third is the quiet tier, which has a cluster and a
label but no colour. So a cluster is what the operator *reads*, a family is a *colour*, and a tier is
a *position and weight* — three axes that mostly, but deliberately not always, coincide. The terminal
tier is the one group with no cluster label at all: labelling it would make it read as a fourth
family rather than as the edge of the bar. A fourth cluster, **billing**, holds *Central Invoice…*
alone and sits outside that grammar: it is drawn only for a session holding the central-invoice
grant on a delivery, because its gate is a grant, not the document's state (ticket 332).
_Avoid_: button group, section.

**Central invoice**:
HQ invoicing a delivered retail delivery that no till invoiced — no till, no pick, no serials — on
the rail that bills bonded and Altibbi deliveries (BackOffice spec 2094, ADR 0048). A billing officer
**raises** one from a delivery's page or in bulk from a pasted list, always with a **reason**. The
server answers each delivery with a **central-invoice verdict**: `accepted` (shown as *Queued* — it
is only queued, billing follows on the worker), `wait` (changed in the last 24 hours; retry later) or
`refused`, each with a `CINV-` code and a sentence the client shows verbatim. Unlike the IDoc
**Verdict**, the server sends the sentence here.
Once raised, a central invoice has a **status**: `QUEUED` → `BILLED` (with its invoice number
`I<delivery>`) or `STRANDED` (with the `CINV-` code it stopped on). Billing ends the delivery's
picking documents — **consumed** if they hold picked units (those packs stay sold), **voided** if
not — and the list shows that **pick outcome**. "No serials" is about the *invoice*: the consumed
documents' units are the only record of which packs went out, and the list reads them from there
(ticket 333).
_Avoid_: manual invoice, HQ invoice (the rail's other callers are HQ invoices too), force-bill.

**Cash remainder** (of a central invoice):
What the invoice records as the store's cash because the online tenders did not cover it — cash no
Z-report counted, which finance reconciles by hand. Zero on a JAHA / HungerStation credit sale, whose
remainder is owed on account; blank (never zero) while there is no invoice.
_Avoid_: cash line, balance due.

**Serialised in a GS1 market** (of a central invoice):
The delivery holds a serial-tracked article and its store's country is a GS1 market — every country
but the exempt list (today Bahrain); an unknown country counts. These are the packs regulatory
reports by hand, because no RSD dispatch notice covered them.
_Avoid_: GS1 invoice, serialised invoice.

**Seeded** (of an employee identity):
An identity that exists in the UA tables, is **active**, is backed by a real legacy `[User_]` row,
and is not a shared/service account. It is the base population every UA rollout card narrows —
"a real person who could be cut over". A deactivated person is deliberately excluded: they cannot
sign in at all, so they are not a cutover blocker, and they have their own card.
_Avoid_: registered, imported (seeding is the one-way SAP→UA identity import; being seeded says
nothing about whether the person has a password).

**Completed activation**:
An employee who has finished setting themselves up: legacy-backed, not a shared account, and holding
a credential whose state is `active` — a **self-chosen, settled password**. A `temporary-must-change`
credential is *not* completed (the person still has the step to do), and signing in afterwards is not
required (that is adoption, a different question). Unlike **Seeded**, it carries **no active clause**:
someone who completed activation and has since been disabled still counts, because the term measures
*how far the cutover got*, not who can work today. It is therefore its own population, overlapping
the Disabled card, and it does **not** partition the estate with **awaiting activation** — the
temp-password people sit on neither.
_Avoid_: active user (means live *sessions* to everyone else on this screen), enrolled, onboarded.

**External identity**:
A UA identity an administrator creates for someone outside the company — a sub-contractor, such as
an outsourced call-center agent. There is no legacy `[User_]` row behind it, so it is never
**Seeded**: it sits outside the cutover population and appears on no rollout card except All people.
It activates like anyone else (first login, no credential, one-time code to its delivery
destination), but nothing on the identity itself marks it as external — the record of who was
brought in lives outside the identity.
_Avoid_: contractor user (a *user* is the authorization record, not the person), new identity (the
door for staff the SAP sync missed), vendor account.

**Page** (of a list read):
A fixed 50-row window of one query's match set, asked for by `skip` and walked with Previous / Next.
The envelope's `isCapped` reads as **"a row exists beyond *this* page"** — it is the next-page flag,
not a statement that the result was truncated, and it is never shown to the user as a cap. The match
count a screen states is `totalMatches`, the whole set; `rows.length` is only ever how much of it is
on screen right now.
_Avoid_: cap, capped, "first 50" (a page boundary is not a wall — advising someone to narrow their
search to get past it is the retired behaviour).

**Worklist**:
The people a **report card** pulls up — a *card* is the count you click, the **worklist** is the list
you then work **down**, page by page, acting on each person. The distinction matters because the two
behave differently: a card is a number that refreshes, while a worklist has **live membership** —
fixing someone removes them from it, which is why acting on a person holds the page rather than
restarting it, and why succeeding at the last row of the last page has to land on the new last page
rather than on an empty grid.
_Avoid_: filter, query (a search is also a query; only a card yields a worklist), queue.

**Bonus buy (BBY)**:
A promotion evaluated by the pricing engine, identified by a `bbyNumber` (with a `promoNumber` /
`offerId`). One shape: a **buy side** ("buy X") linked to a **get side** ("get Y"). It is
*applied* when it fired on a basket, or *potential* when it could apply but did not (the "why not"
is its unmet prerequisites). Seen on the **POS Simulation** screen (in a basket context) and the
**BBY Inquiry** screen (standalone, read-only). Two persistence shapes back it: the flat
**`BbyHeader`** (28 scalar fields — number, status, validity window, links, targets; what the
inquiry grid lists) and the richer **`BbyModel`** (header + `BbyPrereq` / `BbyCond` rows; what the
SAP "Display Bonus Buy" detail renders).
_Avoid_: offer, deal, discount (a bonus buy *carries* a discount; it is not one).

**Buy side / Get side** (of a bonus buy):
The two halves of a BBY. The **buy side** is the **prerequisite** (data: `BbyPrereq`,
`isPrerequisite`) — what must be bought; the **get side** is the **condition** (data: `BbyCond`,
`isCondition`) that grants the **reward** — what is given. "Buy" / "Get" are the human-facing terms
(prose and UI labels), prerequisite/condition are the data-layer/DTO terms, and "reward" names what
the get side grants. Either side can be a single **material** (`MAT`) or a **material grouping**
(`MGP`, a category), and the get product may differ from the buy product. Engine rows join the
buy↔get lines of one fired application by a shared `conditionKey`.
_Avoid_: trigger/benefit (fine in prose, but the domain terms are buy/prerequisite and
get/condition/reward).

**Coupon-gated bonus buy**:
A bonus buy whose buy side is a coupon's **campaign material** (a `COUP…` voucher SKU). The buy side is
met only by *redeeming* a coupon code, which spends the code at the coupon service and places the
voucher on the order. The voucher itself is never sold or added as an item. The get side is an ordinary
reward, and it may target specific products the basket does not yet hold.
_Avoid_: coupon discount (the coupon carries no money of its own; the bonus buy it unlocks does).

**Get-side shortfall**:
The state of a bonus buy whose buy side is fully met but whose get side finds nothing to reward,
because none of its reward products are in the basket. Nothing is given, yet unlike an origin or
validity refusal it is **fixable by adding a reward product**. Only Material- and Grouping-targeted
get sides can fall short; an All-Prerequisites or Document reward lands on lines already present. With
several reward arms, the get-side link category decides whether one arm (OR) or every arm (AND) needs
a product. For a coupon-gated bonus buy this is the costly case: the code is already spent and buys
nothing until a reward product is added.
_Avoid_: "not applied" / "promotion failed" (it qualified; the reward simply has no target yet),
"ready" (ready means qualified but out-ranked by a better offer, which is a different state).

**Discount type** (of a bonus-buy reward):
Which of four kinds the reward grants: **Free Goods** (`N`, buy-x-get-y-free), **Discount Percent**
(`%`), **Fixed Discount** (`R`, amount off), **Set Price** (`P`, fixed/bundle price). The SAP
condition-type codes (`ZB01/02/03/12/13`, `VKA0`) are the engine's expression of the same four.
_Avoid_: promo type (the *promotion* is the bonus buy; the discount type is the reward's kind).

**BBY status**:
The `BbyStatus` code on a `BbyHeader`, SAP's `KONBBYH.STATUS`: **blank** = Activated, **`1`** = Planned,
**`2`** = Deactivated (BackOffice spec 2374), **`3`** = Tested (BackOffice spec 2396, ADR 0063, OMS
bonus buys only). Since BackOffice 2339 it is the **activation gate**: only a blank (Activated) bonus
buy prices at a till; a Planned, Tested or Deactivated one prices only in the simulator, by an
explicit option. Transitions (ADR 0063, reversing 2374's "never back"): Planned → Tested (**Mark
Tested**, by someone other than the last writer, holding the tester grant; offered on one bonus buy
in its editor and on a selection in the promotion overview, where only the selection's Planned ones
are sent, one call each, under one shared note: the tester vouches for every one, having priced the
cases they chose) → Activated ↔ Deactivated,
and Tested / Activated / Deactivated → Planned (**Back to Planned**, which clears the test mark and,
from Activated, pulls the offer off the tills). Planned → Activated is refused. **Only a Planned bonus
buy can change.** Every screen reads only these codes and shows any other code as *unknown*; the
older **A** / **I** / **D** / **X** reading is retired.
_Avoid_: state, approval status (`SyncApprovalStatus` is a different column nothing new reads),
draft (SAP's word is *Planned*).

**Promotion** (OMS, on Bonus Buy Maintenance):
SAP's `WAK1` container: a numbered (`P` + 9 digits, minted by the server), named (≤ 40) **sales
window** that holds bonus buys. Marketing creates it first and works from its **Bonus Buy Overview**;
activating or deactivating it flips all its bonus buys at once, all-or-nothing. It is the bonus
buy's `promoNumber`. Elsewhere in prose "a promotion" still loosely means a bonus buy (see
*Discount type*); on this screen it always means the container.
_Avoid_: campaign, flyer (fine in prose; the record is the promotion).

**Validity window** (of a BBY):
The header's own live-dates: `ValidFrom` / `ValidTo` as `yyyyMMdd` **strings**, and optional
intra-day `ValidFromTime` / `ValidToTime` as `HHMMSS` strings. "Overlaps *now*" is an **ordinal
string** compare (`ValidFrom ≤ today ≤ ValidTo`), no date parsing needed. Date-range **search** on
the inquiry means *validity-window overlap* ("active during this period"), never `CreatedAt`.
_Avoid_: effective dates, created date (`CreatedAt` is when the row was minted, not when it is live).

**Active / current** (of a BBY, on the inquiry):
An inquiry-screen concept the WPF never had: a BBY is **active** iff its **BBY status** is Activated
(blank) **and** it is **valid today** (its validity window overlaps today, `ValidFrom ≤ today ≤ ValidTo`)
— computable from `BbyHeader` alone. On the inquiry these are two separate criteria: a **status
filter** (any of Activated · Planned · Tested · Deactivated; none chosen = every status) and **valid
today** (spec 441; the search half is still being built). The default view is Activated + valid today, i.e. the active BBYs. A number search reaches any
status and any window; a date-range search replaces *valid today* with *valid during that range* and
keeps the status filter.
_Avoid_: live/enabled — and don't conflate with the engine's heavier "will it fire now" (cond-level
dates + `SyncApprovalStatus` + time window + loyalty), which the inquiry deliberately does not
reproduce.

**Link category** (of a BBY):
How multiple buy lines (`LinkCategoryBuy`) or get lines (`LinkCategoryGet`) combine: **A** = AND
(every group must be satisfied), **O** = OR (any one suffices). `BbyLinkCategoryConstants`.
_Avoid_: match mode.

**Condition target type** (of a BBY):
`CondTargetType` — what the get-side discount is aimed at: **M** = Material, **G** = Material
Grouping, **P** = All Prerequisites, **R** = **Document**, the header-level **total-discount mode**
(e.g. Al-Rajhi 5% off the whole basket subtotal). In Document mode the detail view hides the
per-line Get grid and shows a single total-discount figure instead.
_Avoid_: scope (it is the specific `CondTargetType` code, not a general notion of scope).

**Sales request** (SREQ, category `'Q'`):
The unpriced, open document a **pharmacist** raises standing with a customer — the store cannot sell
them the item now, or they have paid through Tamara and will collect. It carries lines, a
`DocumentReason` and the pharmacist's note, and **no money at all** ("the child is a real, priced
order; only the request is unpriced"). It is not a back-office ask and has nothing to do with
**request close** (see **Close**): that is a cancellation, this is an order waiting to happen.
_Avoid_: order request, quote, reservation — and never shorten it to "request" where a cancellation
request could be meant.

**Linked request** (of a call-center order):
The one sales request an order **converts**. Linking is a single compound act (`linkRequest`): it
stamps the request number and reason onto the order, copies the request's **store** and **items**,
prefills the source reference, and — for `TMRA` only — forces collection and paid-online. Refused
unless the basket is **empty** (`LINES_EXIST`), which is what makes unlinking a full undo rather than
a stamp-drop. One order links at most one request: `RefDocumentNo` is singular and the conversion is
one-shot. The order is what converts; the request is what is **converted**, by the 055b spine, at
submit.
_Avoid_: attached request (a *caller* is attached; a request is linked), parent order, reference
document.

**Eligibility check**:
Asking a payer whether a patient is covered — one act (`Nphies/CheckEligibility`), one stored
`NEligibility` row, and an answer carrying every **coverage** the patient holds. It is the *first*
of the two Nphies acts and the only one that names a patient by hand: an authorization is always
raised **from** a check, which is what keeps identity out of the authorization form entirely. Its
answer is read in the two axes — **Request state** and **Verdict** — never as a single status.
_Avoid_: eligibility request (the request is the body; the act is the check), verification,
coverage check (a *coverage* is one of the policies the check returns, not the check).

**Provider** (of a Nphies act):
The healthcare organization the agent is acting **as** when they ask the exchange — a `ProviderCode`
from the Nphies service's own `core/providers` list, already filtered to unblocked. It is **not** a
**store**: no mapping between the two exists in either direction, the acting store plays no part in
who is asking, and the two answer different questions (a provider is who NPHIES thinks is asking; a
store is where the money is priced — see **plant**, when it arrives). It is the **one** value the
browser supplies that the server does not stamp, so it is a free per-act pick with no default and no
memory of the last one, and the check is blocked until it is chosen.
_Avoid_: branch, site, store, pharmacy — and never default it from the acting store.

**Request state** (of a Nphies act):
Whether we got an answer from the payer at all — one of `Cancelled` · `Failed` · `Pending` ·
`Complete`, derived from `Cancelled` / `Error` / `Queued` / `ClaimProcessingCodes`. It is the first
of the **two** axes every eligibility check and authorization carries, and it is deliberately
separate from the **Verdict**: `Failed` means *we could not ask*, which is a different kind of bad
news from *they said no*. A `Failed` act reads its detail text from `ErrorMessageShort` under a
failure label; a `Complete` one never renders that field at all (it doubles as the adjudication
display, so reading it in both branches would conflate the two axes).
_Avoid_: status (the screen has two axes and "status" names neither), error (`Failed` is a
transport/processing outcome, and a payer refusal is not an error).

**Verdict** (of a Nphies act):
What the payer said — the second axis, **blank until the Request state is `Complete`**. On an
authorization: `Approved` · `Partly approved` · `Rejected` · `No approval needed` (from
`AdjudicationOutcome`). On an eligibility check: `Eligible` · `Not in force` · `Not eligible`, with
site eligibility qualifying it inline at result time ("Eligible · outside network"). The reason
behind a bad verdict is display text the Nphies service has already decoded: `BenefitReason` per
authorization line, `NotInForceReason` on an eligibility, plus the header's `Disposition` and
`ProcessNote`. **No verdict asserts dispensability** — the real predicate lives in the Nphies
service's `Dispense()` and includes a follow-up clause the list cannot see; a reader infers
readiness from `Complete` + a good verdict + no dispensed marker.
_Avoid_: outcome (`Outcome`/`ClaimProcessingCodes` is the *Request* axis), approval status,
"ready to dispense" (nothing on the web claims that).

**Payer query** (`NeedComm`):
The payer has asked the provider a question about an authorization, and until it is answered the
authorization is not concluded. It is a **marker on the row, not a status**: the payer raises it
asynchronously, so it can land on an authorization that already has a Request state and a Verdict.
Answering it is out of v1 scope — such an authorization **stalls on the web** and is finished in
WPF, which is exactly why the marker has to be visible. Its sibling marker is **dispensed**
(`IsDispensed`), the row's end of life, owned by the till.
_Avoid_: communication (the noun names the message thread, not the state), pending (that is a
Request state, and a queried authorization is usually already `Complete`).

**Collection**:
One **collection receipt** (سند قبض) — the cash and card totals a **collector** took from a store
against its closed shift(s), identified by a `CollectionReceiptNo` and covering one or more
Z-reports. Its cash chain is `SystemCash` (what the till says) → `CountedCash` (what was counted) →
minus the `OpeningFloat` that stays in the drawer → `CountedCashNet` / `NetCollected` (what actually
left the store), with `Variance` (عجز/فائض) and its reason code standing between the first two.
The receipt *is* the document: printing it renders the same سند قبض the till posts.
_Avoid_: pickup, cash drop, deposit (a deposit is the **bank** end, several ACRs later).

**ACR** (accumulated collection receipt):
The collector's container — نموذج متابعة المبيعات النقدية ومبيعات الشبكة — linking many
**collections** under one `AcrNumber`, `OPEN` until closed, then claimed by a **deposit**. Its
printable form is the second of this effort's two documents. Filtering collections by `AcrId` is an
**exclusive** scope: the server drops store, collector and period entirely, so "this ACR's
collections" always means *all* of them.
_Avoid_: batch, bundle, collection group.

**Deposit**:
The banking of one or more ACRs — `POSTED` or `VOID`, carrying a bank, the **calculated** total
against the **real (banked)** amount, and slip **attachments** that are URLs the mobile backend
hosts (the API never takes or serves bytes). Each claimed ACR line holds both a frozen
`NetCollectedAtDeposit` and a live `NetCollectedNow`; a gap between them is **drift**, and finding
it is what the accountant opens the screen for. Has **no printable document**.
_Avoid_: banking, remittance, settlement.

**Collection attempt**:
A visit that collected **nothing** — a collector logged at the till who they visited, when, which
store/shift/business day, and why not (manager absent, cash not complete, other). The shift stays
`PENDING` and collectable: an attempt is **liability evidence, not a collection**, which is why it
is immutable and carries no row action anywhere it is shown.
_Avoid_: failed collection (nothing was collected, so there is no collection to have failed), visit.

**Ready for collection**:
What still waits for a collector (BackOffice 1994): every **closed day** the collector has not
taken (a shift `CLOSED` + `PENDING`, NewPos and legacy alike) and every **prepared settlement
receipt** nobody has collected yet. A row leaves the moment it is collected or declared collected
outside the system. Read-only — no act, no Z viewer.
_Avoid_: queue, backlog; "receipt" alone (a **collection**'s receipt is the سند قبض — say *prepared
settlement receipt*).

**Collector supervisor**:
The Ua role `COLLECTOR_SUPERVISOR` (BackOffice 1995): the five collection read grants — Cash
Collections, ACRs, Deposits, Collection Attempts, Ready for collection — and no act. The web keys
nothing off the role name; each screen reads its own flag on the one probe.
_Avoid_: accountant supervisor (a different role, which holds settlement supervision).

**Profit center** (of a store):
The finance code the Plants master records for a store (`Plants.ProfitCenter`, e.g. `PH-019`), which
finance books by (BackOffice 1990). Every collection paper and grid shows the store as **one
server-composed string**, `storeText`: `PH-019 (P019)` when a profit center is recorded, else the
store code alone, never `()`. The web renders `storeText` as sent and never composes it. The raw
`profitCenter` rides beside it for sorting and the file.
_Avoid_: cost center; the SAP profit-center resolver (it derives what SAP receives, not this).

**Skipped line** (of a link):
A line on the linked request that the copy did **not** put on the order, reported per line rather
than silently dropped. Two kinds, and they are different rows: **refused** (not sellable at the
plant, no price, an engine refusal — the server's code, nothing to press) and **below ATP**
(`requested`/`available`, and an *add anyway* the agent presses deliberately, because `HasBelowAtp`
is a fraud signal and a flag nobody saw proves nothing). The link stands regardless of how many
lines landed.
_Avoid_: failed line, dropped item (nothing failed — the guardrails held).

**Skipped import line** (of a master-data import):
A line of a WPF tab-separated import (cities, districts, document source users) that the server
did not apply, answered per line as `{ line, key, reason }` (spec 430 D8) — `line` is the 1-based
line as sent, empty lines not counted. A known reason (`UNKNOWN_CITY`, `UNKNOWN_STAFF`,
`UNKNOWN_SOURCE`) is worded; any other is shown as its code, never dropped. Distinct from an
**error line**, which the preview catches before sending (wrong column count) and which blocks Send.
_Avoid_: skipped line unqualified (that is a link's), failed line.

**IDoc**:
The document the SAP rail generates for a till transaction and sends to SAP — one per **IDoc type**
(an aggregated envelope, a sales-as-per-receipt envelope, an FI document, and others). Several exist
for one transaction; at most five in production. The **IDoc Inspector** (`/reports/idoc-inspector`,
spec 1386) is the read-only view of what the rail produced, keyed on **store + transaction number**.
_Avoid_: SAP document, export file (the *file* is what a batch writes; the IDoc is the row).

**IDoc batch**:
A sealed unit of delivery to SAP holding many **IDocs**; **sealing** it is what makes it exportable,
and an exported batch is the closest thing to proof SAP received something. A document in no batch is
**not batched** (3.1% of production) and reachable only by the inspector's own loader.
⚠️ **Nothing to do with a batch (CHARG)**, a physical lot of a material — both words appear on the
inspector screen, the second inside item details, and the copy must keep them apart.
_Avoid_: export batch, bundle, run.

**Parked entry**:
A queue entry whose workflow **has not shipped yet** — no handler is registered in the running
process, so nothing is wrong and nothing will happen. 3.2% of production entries. It is one of the
ten **verdicts** and must never read as a failure or as *still waiting*.
_Avoid_: stuck, pending, failed.

**Verdict**:
The server's named answer to "what happened to this transaction" — one of ten machine codes, decided
server-side so two people reading the same transaction cannot disagree. Always a **200**, never a 404
or an empty result; the client owns the wording and the server never sends a sentence.
_Avoid_: status, error (a verdict is an answer, including when it names nothing to show).

**Source tag**:
The provenance stamp on an IDoc line or condition, recording which layer minted it — the answer to
*why is this fee here*. ⚠️ An **empty** tag renders as a dimmed **unknown**, never as a POS row: the
ledger's own convention defaults an untagged row to POS, and applying that default on screen would let
a provenance bug disguise itself as ordinary data. Payments and FI lines carry **no** provenance at
all, and the screen says so rather than showing a blank column.
_Avoid_: **origin** as a synonym for the source tag — the tag says which LAYER minted the row, while a
condition's own `conditionSource` (its origin: minted by hand, automatic, a distributed header copy, a
base price) is a different and smaller mark that rides beside it. The screen's column is labelled
*minted by*.

**Loyalty member**:
A customer's identity in the loyalty programme — the person a `loyId` names, carrying their profile,
points balance, tier and history. ⚠️ Findable by **exactly two keys**: the loyalty id and the mobile
number. Email, national ID and name are fields *on* a member, never ways *to* one — which is why
clearing the mobile makes a member unreachable and clearing the email does not. A loyalty id is
**digits only**; nothing about its digits says whether a typed number is a loyalty id or a mobile, so
a lookup tries the mobile first and the loyalty id second rather than guessing.
_Avoid_: customer (the person, who exists whether or not they are enrolled), account, card holder.

**Member command**:
A named, single-purpose write against one loyalty member — update profile, change mobile, block,
unblock, remove email, remove mobile. Each is invoked on its own, refuses on its own, and leaves its
own trail; there is deliberately **no "save the form"** that writes several at once, because one
trail entry has room for only one name and a composite write would have to lie about which change it
was. The same word the Document Details **command families** use, and the same idea.
_Avoid_: save, update (unqualified), action (that is the *record* a command leaves, see below).

**Member update snapshot**:
The row a member command leaves behind — a copy of the member's profile **as it stood after the
command**, stamped with which command wrote it, who ran it and when. ⚠️ An **after-image, not a
diff**: it says what the member became, never what changed or what the value used to be. Recovering a
previous value means reading the *preceding* snapshot, and this trail is deliberately visible on no
screen.
_Avoid_: audit log, change log, history (the **member action** is the screen-visible trail; this is
the quieter one beneath it).

**Contact removal**:
The command that clears a member's reachability at their own request — the mobile, the email, or
both, each removable on its own. ⚠️ **Not deletion, and the copy must never imply it is**: the
member, their name, their national ID, their points and their whole purchase history remain, and only
the ways of reaching or finding them are taken away. Removing the **mobile** also ends the member's
ability to sign in and blocks the account; removing the **email** ends a contact channel and nothing
else.
_Avoid_: erasure, account deletion, close account, GDPR/PDPL erasure, anonymisation — every one of
them claims more than the command does.

**Case reference**:
The customer's own request, named by the agent, recorded on a contact removal so the trail says *why*
a member was made unreachable. Free text and non-PII by convention — it is the one thing a removal
records, since the removed values themselves are kept nowhere new.
_Avoid_: note, comment, remark (those invite prose; this is a pointer to a request that happened
elsewhere).

**System reason**:
A blocked-reason the system sets and an agent may not choose. It marks how a member came to be
blocked — by a mobile collision, by inactivity, by their own removal request — as opposed to the
ordinary reasons a person picks from a list. The distinction exists so that a state carrying a
serious claim cannot be applied by hand to a member the claim isn't true of.
_Avoid_: internal reason, hidden reason (it is shown wherever a member's block is shown; it is
unselectable, not invisible).

**Skip (invoice email)**:
An attempt to email a receipt's tax invoice that correctly sends nothing, because there is no
deliverable recipient — no loyalty member, a blank or malformed address, an internal support
address, a shared placeholder member, or a missing online order. Terminal and correct, never a
failure; each carries a **skip reason** naming which condition fired, worded on screen as the thing
to fix.
_Avoid_: failed, ignored, not sent (a failure is the provider refusing a real send; a skip never
tried).

**Requeue (invoice email)**:
A person putting **one** receipt's already-queued invoice email back in front of the send queue,
typically after the customer corrected their email and called to ask for the invoice again. It
sends the same tax invoice to the **current** recipient on file — it never names an address of its
own — and grants it fresh attempts while the earlier ones stay on record. Only a receipt the queue
already holds can be requeued: insurance, credit and non-emailing stores' receipts were never
queued. The screen's action is labelled **Resend**, which is the customer's word for it.
_Avoid_: resend to another address, retry (a retry is the queue's own next attempt), re-drive (the
bulk return of a backlog).
