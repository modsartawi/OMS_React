# HITL-409 — unattended decisions, ticket 409 (the caller bar replaces the customer rail)

## Q: Which order do the attached caller's fields take in the bar?
**Decision taken:** `railFields`'s six fields, re-seated in the order 379's approved capture and the ticket list: name · tier · points · mobile · member · email (`BAR_ORDER` in `caller-bar.ts`). The cap, the field set and the sourcing rules are still `railFields`'s, and `rail-view.ts` keeps 135's own order and its tests.
**Why:** The ticket and 379 §3 both list "name · tier · points · mobile · member id", and the C captures draw that order. "135's six-field cap and order hold" is read as *a fixed order the bar does not vary*. Email is the sixth field, which neither the capture nor the list shows. It is kept, last.
**Revisit if:** the owner wants 135's literal order (name, mobile, member, tier, points, email) at S6. That is a one-line change to `BAR_ORDER` plus its test.

## Q: What gives when the bar can't fit on one line at 1280?
**Decision taken:** The email is the only field that shrinks, and it clamps to an ellipsis. The name never shrinks; it clamps itself only past 16rem. Each value clamps on its own isolate, so the ellipsis lands at the value's end in either script. Everything except ✕ sits in one clipping cluster, so ✕ is never pushed off the bar.
**Why:** The drive measured that a realistic Arabic name, tier, points, mobile, member id, email and the requests chip overflow 904px by a few dozen pixels. In the first build the name shrank too and lost its first letters under LTR.
**Revisit if:** the operator lead wants the email dropped from the bar rather than clamped.

## Q: Points and the mobile — mono or sans?
**Decision taken:** The mobile and the member id are in mono, as C7 says. Points are in sans, isolated in `Ltr`.
**Why:** C7 names the mobile and the member id for mono. A points balance is a quantity, and quantities stay in sans (359's reversal). The prototype set points in mono; that was ignored.
**Revisit if:** a typography review rules a phone number is not a code (/standards-review raised it as a judgement call).

## Q: The bar's height, before and after attach.
**Decision taken:** One fixed row, `h-12` (48px), in both states. Everything the bar opens sits in the flow under that row: the attach or remove failure, the sign-up and the linked-request detail. None of them sits inside the row.
**Why:** "The bar takes the same pixels before and after attach." The prototype's two states were 52px and 44px.
**Revisit if:** never, unless the owner accepts a height change at attach.

## Q: The linked-request detail (not prototyped) — what is it drawn from?
**Decision taken:**
- **The chip:** a bordered chip holds a toggle button ("Converting request ‹no›", `aria-expanded`) and an icon-only ↗. The toggle opens the detail.
- **The detail:** it is `ChipSection`, the same in-flow section the sentence's words open, so Esc closes it and focus returns to the chip. It holds a label/value list: Reason, Raised at store (the code in `Ltr` and mono), and Pharmacist's note (`<bdi>`, pre-wrapped).
- **The footer:** the ↗ link, spelled out, and **Unlink**, which opens 195's `UnlinkConfirm` unchanged.
- **When it opens:** the open state is keyed on the request number, so a later link of another request never opens it by itself (/code-review finding, fixed).
**Why:** 379 says to draw it "from the bar's and `SignupPanel`'s idiom", and to follow 175 §9's in-flow section.
**Revisit if:** the owner draws it differently at S6. ⚠ Owner sign-off pending.

## Q: How is "Raised at store" said in the detail?
**Decision taken:** As a label ("Raised at store", `linkedRequest.detail.raisedAt`) beside the code as its value. The picker's `request.raisedAt` sentence stays for the picker.
**Why:** The detail is a label/value list like the ledger, so no t() interpolation needs `fsi`.
**Revisit if:** a copy review wants one key for both, so the two cannot drift.

## Q: Key names.
**Decision taken:**
- **Renamed:** the console's `rail.*` keys that still render moved to `callerBar.*`, with the same English copy. `signup.open` moved to `callerBar.signUp`.
- **Added:**
  - `requests.openShort_one/_other`: "<n>{{count}}</n> open request(s) · View". The count sits in its own slot, isolated with `Ltr`.
  - `linkedRequest.{chip, show, detail.{title, reason, raisedAt, note}}`.
  - `sentence.addressRetained`, a `<label>` slot in `<bdi>`.
- **Reworded:** `steps.caller.hint` is now "— in the caller bar above".
- **Retired:** `rail.address`, `noAddress`, `pickAddress`, `addressNeedsCaller`, `addressUnavailable`, `changeAddress`, `collectingFrom`, `storeNotChosen`, `addressRetained`, plus `request.cardTitle`, `request.openCount_*` and `request.view`.
**Why:** The ticket names `callerBar.*`, `requests.openShort`, `linkedRequest.detail.*` and the caller hint. The rail is gone, so leaving its keys under `rail.` would misname them. `requests` sits beside `request` because the ticket names it so.
**Revisit if:** a copy review wants `request.openShort` instead.

## Q: The requests chip under an RTL page with English copy.
**Decision taken:** The chip is `dir="auto"`, so an English key reads "2 open requests · View" even on an RTL page, and an Arabic template reads right-to-left.
**Why:** It is 408's ruling for the sentence (prose takes its own direction). Without it the drive measured "open requests · View 2" under RTL.
**Revisit if:** an Arabic reviewer wants the page direction forced.

## Q: Dead derivations after the rail retired.
**Decision taken:** Deleted `fulfilment-view.railBlock`, `rail-view.addressSlot` and `rail-view.addressPlace`, with their tests. Nothing renders them now.
**Why:** 379 retires the rail's address and collection blocks. The sentence owns the address, and `header-sentence.ts` composes it itself.
**Revisit if:** an address block outside the sentence comes back.

## Q: The attach failure while the sign-up's "created" step shows.
**Decision taken:** The bar draws an attach or remove failure under itself in every state except that one. In that state the sign-up panel already shows it under its own Attach button (`signupError`).
**Why:** The rail never drew it twice, and the bar should not either.
**Revisit if:** never.

## Comments
- The baselines for the regression drives are unchanged:
  - `coupon-159` 99/103: the same 4 sign-up failures as at HEAD.
  - `callcenter-guidance` 105/107: blank offerId, Bby/*.
  - `foundation` 1294/1302: topbar/bell.
  - `address-editor`: it now reaches the same baseline timeout on `[data-cc-district-search]`. It no longer stops earlier on the retired `[data-cc-pick-address]`.
- `header-175-drive` is a prototype drive hard-wired to port 5199, so it was not run.
- The regression drives rewrite committed screenshots under `.issues/assets/159|176|194`. They were restored with `git checkout`, and none are committed.
