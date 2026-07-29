---
type: wayfinder-ticket
wayfinder: prototype
map: 126
status: done
blocked-by: —
claim-note: minted with `status: claimed` by mistake in ea8f98c (INDEX said **open**, no branch, no
  assets, no answer, and no other 154–159 sibling was minted that way). Taken 2026-07-29 as the
  map's last open ticket.
---

# 159 — The console draws its coupon and its loyalty signup

## Question

**Owner-reported gap, 2026-07-27.** Two features that are already **in phase 1 and already settled**
are drawn nowhere, in [135](135-agent-console-prototype.md)'s console or in
[138](138-near-miss-guidance-design.md)'s host. Unlike 154–158 this is a *drawing* job: no contract
question is open.

### Redeem coupon

- In scope: map note 5 lists `applyCoupon` (`AddCouponAsync`) in the verb list; the contract has
  `POST CallCenterWeb/ApplyCoupon { transactionId, requestId, couponCode }` returning the whole
  `SessionState`, plus `COUPON_REJECTED` (carrying the engine's own reason sub-code) and
  `COUPON_ALREADY_APPLIED` in the taxonomy.
- `grep -i coupon` over `VariantA.tsx` returns **nothing**. There is no entry field, no applied-coupon
  line, and no refusal surface.

What the drawing must settle:

- **Where the entry lives.** A coupon is a header-ish act with a basket-level effect. The chip row
  (settled → collapses to a chip) or the receipt (where its effect appears) both argue for
  themselves, and they are different claims about what a coupon *is*.
- **How an applied coupon reads beside a fired promotion.** Both make the order cheaper and both
  land near the receipt; [138](138-near-miss-guidance-design.md) just spent a whole ticket on how a
  promotion states itself, and a coupon must not read as a fourth near-miss class.
- **`COUPON_REJECTED` carries a sub-code from the engine.** It is a business outcome, not a crash —
  and the agent is on the phone, so the refusal has to be sayable out loud.
- **Rebind interaction, already ruled:** [129](129-rebind-store-door.md) leaves coupons **untouched**
  by a plant rebind (`"C" NewPricingAndKeepManual` keeps the coupon line), while promotion values
  move. So a rebind preview shows promotions changing and the coupon holding — draw that, because a
  coupon that visibly survives a store change is reassuring and one that silently does is suspicious.

### Add new loyalty

- In scope: [132](132-header-capture-inventory.md) ruled it — CC2's create is a **two-step loyalty
  OTP signup collecting country + mobile, then OTP; no name, no email**
  (`CustomerCreateService` / `CustomerCreateSectionVM`). *"Phase 1 keeps all of it; there is nothing
  to build server-side."* Customer **edit** does not exist in CC2 and stays out.
- 135 draws the caller rail with a mobile field and an attached-customer state, but **no signup
  path** — so the console currently has no answer to "this caller isn't in the system".

What the drawing must settle:

- **The OTP step inside a phone call.** The caller reads the code back — so the wait is spoken, not
  silent, and the surface must not steal the whole console while it runs.
- **Where signup sits relative to lookup.** A not-found lookup is the natural entry, and it must not
  read as a failure.
- **The ordering constraint it inherits.** [137](137-callcenter-web-door.md) makes the address book
  unreachable before customer attach — a freshly signed-up caller is attached but address-less, which
  is 135's `attached` state, so the two flows must meet there cleanly.
- 🚩 **Check the door.** 137 gated *loyalty lookup* among its nine routes; confirm the **signup**
  routes (`Loy/*`, branch-scoped OTP) are on `CallCenterWeb/*` too, or the console can find a caller
  it cannot create.

Deliverable: both surfaces drawn into the console prototype (135's variant A / 138's host), with the
states above, plus whatever the door check turns up.

## Answer

**Contract v1.10, additive** — and the ticket's own premise was wrong in the most useful way. It
opened *"this is a **drawing** job: no contract question is open"*. Four are, and two of them are
holes rather than drawings.

Owner rulings, 2026-07-29: **remove with a real server-side reversal** (of three options), the
coupon is a **chip in the header row** (not a receipt row), and signup sends the **call-centre's own
store code** as its branch.

### The coupon

🚩 **`applyCoupon` was the one verb on this contract with no field to show its result.** The server
built it end-to-end (`CallCenterSessionService.Verbs.cs:256-324` — redeem at `ICouponService`, then
`AddCouponAsync` with the campaign SKU and the redemption id), and the *only* coupon-aware line in
the whole `SessionState` projection is the one that **hides** it:
`CallCenterSessionStateProjection.cs:195-201` drops every `COUP` voucher line. That exclusion is
right and stays — its money is already flattened onto the product line, and two lines for one
discount is worse. Nothing replaced it. So an applied coupon moved the totals and named itself
nowhere: the discount arrives as an `AppliedBonusBuy`, which carries **no coupon attribution at all**
(nine fields, none of them a coupon), indistinguishable from an automatic promotion. The agent's only
way to discover a coupon was on the order was to apply it again and read `COUPON_ALREADY_APPLIED`.
⇒ `header.coupons[]` — an **array**, because the engine holds a list and the duplicate check is
per-code, so a second, different coupon is accepted today. It costs **no engine change and no new
read**: `CallCenterProjectionInput.Lines` already carries `PromotionCouponCode` and
`PromotionCouponDiscount`.

🚩 **The owner's "new BackOffice issue" was already built — for the till, by issue 211.** The
removal question looked like design: the engine *can* void a coupon line (581 fixed the soft-deleted
line re-qualifying its own offer) but `CollectReversalContexts()` is reached from
**`VoidTransactionAsync` only**, so a bare void strands the burn. `PosCouponReverser` had already
ruled every part of it: **reverse first, void only if the reverse landed** — *"never a line whose
code stays burned, never a released code whose line the customer still pays for"* — a transport fault
is a **refusal** here (the deliberate inversion of the redeem's rule), and an already-refunded code is
an idempotent success. The web's `removeCoupon` composes that over the in-process `ICouponService`
the redeemer adapter already uses. The consequence the console had to carry:
**`COUPON_REVERSAL_REFUSED` means NOTHING CHANGED** — the opposite of what a failed remove normally
means, and an agent told *"could not remove"* would reasonably tell the caller the discount had gone.
The escape hatch is `abandon`, which reverses properly.

🚩 **`canApplyCoupon` is `canAddItem`'s predicate, and not for symmetry.** The redeem runs *before*
the add and writes `storeCode: scope.Plant` into the coupon service's ledger.
[129](129-rebind-store-door.md) ruled a rebind a *documented non-event* for coupons — true of the
**order** (the `"C"` re-price keeps the line, the sticky `C000` origin keeps the template matching)
and **false of the ledger row**, which does not move. So redeeming against a store
[175](175-nothing-enters-an-unaddressed-order.md) has labelled `seededAtOpen` burns a real coupon
against a store the order will not ship from. A shut gate is **not** a shut chip — the order may hold
a coupon the agent must read out on a call where a new one cannot be applied.

🚩 **The capture handed over a money hole the drawing never would have.** Capture 02's near-miss is
`T173 COUPON-GATED BBY`, `have 0 / need 1`, `prereq { kind: "material", materialNumber: "COUPT173" }`
— a **coupon SKU**. Drawn as an ordinary material prerequisite it is *add 1 more* with 172's
one-click add behind it, and prerequisite matching has **no line-type filter**:
`BonusBuySession.Prepare` enumerates `pricingItems.Where(i => !i.IsDeleted)`, and `PcItem.IsCoupon`
is read only by `SetCouponAttribution` and the stacking carve-out. A plain `addItem("COUPT173")`
therefore qualifies the same bonus buy a redeemed coupon does **while burning nothing** — the
discount given away free. ⚖ Recorded fairly: it may instead be **refused**, because a zero-priced
coupon SKU trips the no-price scan back-out that `AddCouponAsync` deliberately sidesteps; which one
happens depends on whether the campaign SKU carries a price, and both are wrong. A client cannot tell
a coupon SKU from any other material, so ⇒ a fourth `prereq.kind`, **`coupon`**: **stated, never
offered** — not `actionable` (no basket change reaches it), not `unavailable` (it is real and the
caller may hold the coupon), not counted in the top bar's *offers within reach*, and answered at the
coupon chip.

Also settled: the engine gate is **open** (`DocumentTypeCatalog.BuildCallCenterOrder` sets
`IsCouponAllowed = true` explicitly, and 233 made the default deny — so silence would have refused
every coupon); the chip is **last in the row**, the only chip an order need never fill, carrying no
`submitBlocker`; and it carries the **code, never the amount** — the chip row has never held money,
so the amount draws in the modal and the receipt gains no coupon row (the owner's chip-over-receipt
ruling doing real work).

### The loyalty signup

✅ **The door check the ticket flagged is already answered, favourably.**
`CallCenterWeb/SignUpByBranch` and `CallCenterWeb/ConfirmSignUpByBranch` are both mounted and gated
(`CallCenterWebEndpoints.cs:143-144`) — so the console cannot find a caller it cannot create. 132's
*"nothing to build server-side"* held for the routes.

🚩 **It did not hold for what the browser may put in them.** `BranchId` is written to
`CreatedByBranchId` on the member **forever**, plus every `LogMemberUpdate` and member-action row;
CC2 fills it from `POSCommon.Store.StoreCode`, and the validator does not require it. The two routes
are **verbatim pass-throughs today**, so any signed-in agent could credit any pharmacy in the estate
with an enrolment. The owner ruled the web sends the call centre's own store — which means the
**server stamps it**, exactly as 878/801 stamp `CountryKey` / `LanguageKey` / `AddressType` on the
address capture. That is 137's *"delegates verbatim"* law breaking a **third** time, deliberately.
⚠ It needs a store code the web can name: 128 recorded that the `Store` table already holds the call
centre as a store, but the web has no `POSSetup` — so it is configuration (156's `PosConfig`
precedent), and the row must be query-verified as a deploy step.

🚩 **The country list is compiled into the WPF client** (`LoyaltyHelpers.Countries` — six GCC
countries) and CC2 builds the wire's mobile itself, dialling code + local with a leading zero
stripped **for SA only**. Copying that here would put one rule in two clients over the value the
loyalty base *keys on* — [156](156-delivery-fee-shared-rule.md)'s exact failure. So the console's
dialling-code line is a **preview the agent reads back**, display only, and the wire carries the
country code beside what was typed; the server builds the enrolled number. Recommended to 878's
sibling, not assumed.

Drawn **inline in the caller rail, never a modal** — the one arrangement decision here, and it has a
reason rather than a preference: the wait between *Send code* and the code arriving is **spoken**,
the caller is holding the line reading digits back, and a modal would take the basket away for the
length of a conversation the agent is having anyway. Unlike the coupon, nothing about a signup is a
fact of the **order** — it belongs to the caller, and the caller has a column. It hangs off the
not-found lookup as the ordinary next thing (no alarm ground — a miss is not a failure), carries the
number already typed, collects **two fields and no more** (132's ruling kept whole), and ends at a
member the agent still has to **attach** — 165's two steps, which a freshly enrolled caller does not
get to skip. No resend and no countdown: CC2 has neither, and a countdown the console invented would
promise an expiry only the loyalty service knows.

### Built and driven

The prototype mounts the **real `ConsoleShell`** (176's pattern, 177's lesson) at
`console/__prototype__/CouponSignupPrototypePage.tsx`, route `/prototype/callcenter-coupon`.
`tools/coupon-159-drive.mjs` — **84/84**, no page errors; typecheck, 573 vitest, three lint gates.
⚠ **Every state is a STUB and the drive says so in its own output**: unlike 176, which stood on a
real capture of the flip, v1.10 exists on no server. 177's rule — a hand-authored fixture is a
hypothesis about shape *and* about population — applies to all of it, and BackOffice
`CcContractFixtureTests` is what will settle both.

Server work minted as BackOffice
[879](C:\Work\DMSCO\BackOffice\.issues\879-cc-coupon-projection-removal-and-signup-branch.md).

🚩 **Found on the way, and not this ticket's**: `tools/callcenter-drive.mjs` is **red on a clean
tree** — verified by stashing — failing at `[data-cc-search-add="200145"]`. The search row renders;
its *Add* does not, because `ItemSearchPanel` draws the button only when `add.onAdd` is passed, and
the page passes it only while `canAddItem` holds. That is 175's opening gate meeting a drive written
before it. The console's own gate has been failing since, and nobody ran it.

🚩 **The pattern worth keeping**: six tickets now — after [156](156-delivery-fee-shared-rule.md),
[157](157-price-check.md), [158](158-stock-in-other-stores.md), [176](176-fulfilment-mode-drawn.md)
and [179](179-the-address-editor-and-its-capture-contract.md) — have turned into findings by reading
what the ticket already **inherited** before designing anything. This one adds a narrower one: the
ticket declared *no contract question is open*, and a declaration of completeness in a ticket written
weeks before it is worked is exactly the sentence to distrust. The same instinct that made 175's
`plantSource` read as *hygiene* when it was the behaviour.

[Captures](assets/159-coupon-signup/) · [prototype](../src/features/callcenter/console/__prototype__/CouponSignupPrototypePage.tsx)
