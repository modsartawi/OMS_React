---
status: done
spec: 180
blocked-by: —
---

# 189 — theCouponNamesItselfAndComesOff

## What to build

`applyCoupon` shipped in v1.0 and the projection deliberately **hides** the `COUP` voucher line it
creates — rightly, because its money is already flattened onto the product line. Nothing replaced it,
so an applied coupon moves the total and **names itself nowhere**: its discount arrives as an
`AppliedBonusBuy`, which carries no coupon attribution at all, and the agent's only way to discover a
coupon is to apply it again and read the refusal. There is no way to take one off.

`CouponPicker`, `coupon-view` and the `coupon` chip already exist and are proved by
`coupon-159-drive.mjs`; `ConsoleShell` already accepts `onChangeCoupon`. **`CallCenterConsolePage`
supplies nothing** — that, plus the two verbs, is the work.

**The coupon is the last chip in the row**, carrying the **code and never the amount** — the chip row
has never held money, so the amount draws in the modal and the receipt gains no coupon row. It is the
only chip an order need never fill and carries no submit blocker.

Three rules that are not obvious and must be built as written:

1. **A shut gate is not a shut chip.** `canApplyCoupon` gates *applying*; the list projects
   regardless, because an order may hold a coupon the agent has to read out on a call where a new one
   may not be applied. `canRemoveCoupon` is the **server's boolean and never `coupons.length > 0`** —
   whether a remote reversal hop can be attempted is not a count.
2. 🚩 **`COUPON_REVERSAL_REFUSED` means NOTHING CHANGED.** The server reverses *before* it voids, so
   a refusal leaves the order untouched and the coupon still on it — the **opposite** of what a
   failed remove normally means. An agent told *"could not remove"* would reasonably tell the caller
   the discount had gone. The console says it in those words, and names `abandon` as the escape.
3. 🚩 **A coupon-gated near-miss is stated, never offered.** Capture 02 already offers `COUPT173` — a
   **coupon SKU** — as an addable material prerequisite, and prerequisite matching has no line-type
   filter, so a plain add qualifies the bonus buy **while burning nothing**. The fourth
   `prereq.kind`, `coupon`, draws as its own class: not actionable (no basket change reaches it), not
   unavailable (it is real, and the caller may hold the coupon), **not counted** in the top bar's
   *offers within reach*, and answered at the coupon chip. `guidance-view` already carries the class.

A second, *different* coupon is accepted — the engine holds a list and the duplicate check is
per-code, so the console must not enforce a one-coupon rule the engine does not have.

## Spine reach

model (`header.coupons[]`, the two capabilities, `prereq.kind` — already present) ·
api (`applyCoupon`, `removeCoupon`) · logic (`coupon-view`, `guidance-view`) ·
component (page wiring) · i18n (already present) · test

## Proof (→ `tdd` red-green cycles)

- [x] `couponSurface` — the list projects while `canApply` is false, with the reason carried;
      `canRemove` is the server's boolean and a test that would fail if anyone derived it from
      `coupons.length` · pure — 13 tests, and since the v1.10 re-capture **three of them read the
      wire's own bytes** rather than a hand-built header (capture 01's shut `NO_CUSTOMER` gate,
      capture 02's real applied coupon). Plus `couponRemoveFailure`, added at review — see Comments
- [x] `guidance-view` — a `coupon` prereq classifies as `needsCoupon`, is **not** counted in the
      actionable total, and an unknown future kind still degrades safely · pure — 39 tests. The
      re-capture made this claim provable off the wire: **both** of capture 03's near-misses now
      answer `kind: "coupon"`, so `actionableCount` is 0 and `openByDefault` is null over the
      contract's own fixture
- [x] `coupon-159-drive.mjs` **re-pointed at the wired console** — applying, reading back, applying a
      second different code, removing; a refused removal renders the *nothing changed* sentence and
      the coupon is still listed · flow (Playwright) — **103/103 against `/callcenter`** with only
      the wire stubbed, the coupon half off capture 14's own bytes (the loyalty half is 190's)

## Boundaries

**Server:** BackOffice [879](C:\Work\DMSCO\BackOffice\.issues\879-cc-coupon-projection-removal-and-signup-branch.md)
— **implementing now**. Contract v1.10, additive. Envelope codes: `COUPON_REJECTED`,
`COUPON_ALREADY_APPLIED`, **`COUPON_REVERSAL_REFUSED`** (new), `NO_CUSTOMER_ATTACHED`,
`STORE_NOT_CHOSEN`.
**i18n:** ✅ `chips.coupon`, `coupon.*` and `guidance.needsCoupon` already exist from the prototype.
⚠ Every state is a **stub** until 879 lands, and the drive must keep saying so in its own output.

## Done when

In the running app the chip names the coupons on the order, the modal shows each one's amount,
applying is refused with real words before a caller and a chosen store, a refused removal says
nothing changed, and a coupon-gated offer has no Add button and does not raise the top-bar count.

## Blocked by

None — can start immediately. ⚠ Shares `CallCenterConsolePage` with
[182](182-mode-flips-the-screen-payment-word-follows.md); run them in sequence rather than
concurrently.

## Comments

**The wire landed underneath this ticket while it was being built.** 189 was written against a
contract v1.10 that existed on no server ("⚠ Every state is a **stub** until 879 lands"). BackOffice
879 has since shipped and the map's fixtures were re-captured at v1.10 — including a new
`14-coupon-on-and-off.json` (applied / duplicate / removed / `couponSkuIsNotAnAdd`). So the two
pure Proof claims are now proved against the wire's own bytes rather than a hypothesis, and the
drive's coupon states are built from capture 14 instead of a mock. **Two things are still stubs and
the drive says so in its own output:** `COUPON_REVERSAL_REFUSED` (the captured removal succeeded, so
no capture holds the refusing leg — and it is the one refusal whose wording the console owns), and
the second coupon's own money.

**The re-capture arrived red.** Five pure tests were already failing on the branch when this ticket
started, all in the two modules named in its Proof, all because their fixture inputs had changed
underneath them: capture 01 now carries a real shut `canApplyCoupon` gate (so a "server that never
heard of the capability" case had to strip the field rather than assume it unset), and **both** of
capture 03's near-misses now answer `kind: "coupon"` (so the strip's captured offers are no longer
actionable, open nothing by default, and state no set sentence). Fixed as part of this slice —
the answers changed, the rules did not. One consequence worth naming: since the re-capture there is
**no captured `kind: "material"` left anywhere on the map**, so US42's material-set phrasing is now
proved over the illustration and says so in a comment.

**🚩 The near-miss defect this ticket found is fixed on both sides.** `addItem("COUPT173")` is now
refused `ITEM_NOT_SELLABLE` — *"That is a coupon, not an item. Apply it in the coupon field."* —
and capture 14's note records that the assertion was written so nobody later "fixes" it by allowing
it. The client half holds independently: a `coupon` prereq draws as a stated row with no Add and
does not raise the top bar's count.

> Answers [181](181-console-drive-green-on-clean-tree.md)'s finding for this ticket — *"the guidance
> strip draws no card at all for a coupon-kind near-miss"*. It draws no **card** by design (a card
> is expandable and carries an Add); it draws a **stated row** in the needs-coupon region, and the
> drive asserts both halves — `needsCoupon >= 1` and `couponCards === 0`.

**The ticket's "last chip in the row" line is stale, and the code is right.** 159 put the coupon
last; [183](183-order-note-reaches-the-order.md) then landed the note beside it under the *same*
rule — `header-chips.ts` documents the pair explicitly: the two chips an order need never fill close
the row, so chips that are empty on most orders do not push the ones carrying a `submitBlocker`
along it. The drive now asserts the pair (`coupon, note`) rather than the position, and says why.

**Review finding, applied: the generic remove failure was over-claiming rule 2.** The first cut gave
`coupon.removeFailed` the wording *"Nothing has changed on this order — it is still there"*, which
`apiErrorMessage` would have shown for **any** failure — including `network`/`unknown`, where the
response was lost and the void may well have landed. That is the console asserting the one fact it
cannot see, in the exact sentence reserved for the one code that guarantees it. The choice now lives
in `coupon-view.couponRemoveFailure(code)` as a pure, tested rule returning the key **and whether it
outranks the server's own message** — because `COUPON_REVERSAL_REFUSED` does carry an envelope
sentence, and relaying it would have suppressed the console's. The general phrase now promises
nothing: *"…this console cannot say whether it came off — check the list above before you tell the
caller."*
