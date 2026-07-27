---
status: done
spec: 160
blocked-by: 166
---

# 167 — movingTheStoreShowsTheDiffAndRefusesWhole

## What to build

Changing where a **non-empty** basket is fulfilled from — by editing the address, or by overriding
the store deliberately — is a plant rebind, and the agent sees exactly what moves before anything
moves.

**This slice owns the confirmation pattern the console uses everywhere.** "Are you sure" arrives on
the **success path**: `200`, the **unchanged** state, and a `pendingConfirmation` block carrying a
token that **pins** the previewed diff.

- It renders as a **modal sheet**. Ruled deliberately ([135](135-agent-console-prototype.md)): an
  inline card in a scrolling flow can be scrolled past, and these are the two moments that must be
  able to stop the agent.
- The preview names line-by-line price movement, promotions whose value moves, availability
  re-freeze, and any line that would no longer price.
- Accepting **re-sends the same verb with the same `requestId`** plus the token — one user action is
  one `requestId`, including the retry that carries the token.
- 🚩 `CONFIRM_TOKEN_STALE` means the basket moved underneath the preview. The console re-sends
  **without** the token and shows a fresh preview — it never commits a diff the agent did not see.
- Declining costs nothing: the preview is the engine door run and not persisted, which is why there
  is no dry-run flag.

**A refusal is a banner, not a crash surface.** `REBIND_REFUSED` is atomic — nothing partial is ever
persisted — and it names the offending line **in the banner *and* tints that line in the basket**, so
"nothing was changed, fix this line" is legible in one glance.

## Spine reach

api (`SetStore`; `SetAddress` on the confirm path) · logic (pending-confirmation state machine;
request-id reuse across the confirm re-send) · component (confirm modal, refusal banner, line tint) ·
i18n · test (pure + flow)

## Proof (→ `tdd` red-green cycles)

- [x] `oneActionKeepsOneRequestId` — pure: an action mints one ULID, a retry of it reuses that id,
      the confirm re-send reuses it, and only a genuinely new action mints a new one · pure
      (`store-move.test.ts`, 4 cases — the id discipline is a **module**, not a call-site
      convention, so it is testable at all)
- [x] `aStoreMoveIsPreviewedThenCommitted` — drive: a store change on a basket with lines returns the
      **unchanged** state plus a modal naming the diff; accepting commits exactly what was previewed;
      a stale token re-previews instead of committing · flow (Playwright, extends
      `tools/callcenter-drive.mjs`, over fixtures `05` and `06` — boxes 26, 26b, 27, 28, 30)
- [x] `aRefusedRebindChangesNothingAndSaysWhichLine` — drive: `REBIND_REFUSED` renders the banner,
      tints the named line, and leaves the basket byte-identical · flow (box 29)
- [x] Added beyond the named seam: 11 more `store-move.test.ts` cases over the preview projection —
      `pendingConfirmation.detail` is `unknown` by the model's own hand (§9), so its parsing is
      exactly where a silent regression over money would live. They cover an unrecognised detail
      block, a diff row with no pair of figures, the availability filter, the delivery fee, and both
      sources of `unpriceableLines[]`. **265/265 drive boxes**, 15 pure cases.

## Boundaries

**Endpoints:** `POST CallCenterWeb/SetStore` (+ `SetAddress`'s confirm path). Codes:
`REBIND_REFUSED` (409, carries `unpriceableLines[]`), `CONFIRM_TOKEN_STALE` (409),
`CONFIRM_TOKEN_INVALID` (400). Fixtures `05-rebind-preview.json` / `06-rebind-refused.json` join
`payloads.ts` — **shape only**. The modal pattern built here is reused verbatim by
[169](169-below-availability-accepted.md); a second confirmation mechanism would be a defect.

## Done when

A store move on a live basket is previewed in a modal, committed exactly as previewed or refused
whole with the offending line named twice, and a preview the agent declines leaves no trace.

## Blocked by

[166](166-address-derives-the-store.md) — the inline path and the chip must exist before the
confirmed path branches off them.

## As built

- **The rebind is ONE action, and the id discipline is a module.** `store-move.ts` mints a
  `requestId` in exactly one place (`beginStoreMove`) and carries it through
  `committingStoreMove` (the confirm) and `repreviewingStoreMove` (the stale re-issue). Nothing else
  in the console mints one for a rebind, which is why "one action, one id **including** the confirm
  re-send" (§4) is a property a pure test can hold rather than a convention a call site remembers.
  The drive proves it end-to-end: three sends of `SetAddress`, one id.
- 🚩 **One confirmation mechanism, structurally.** `ConfirmSheet.tsx` owns everything true of *any*
  confirmation — the modal, the two buttons and which is the default, the re-issue notice, the
  failure line, and the blocked-commit block — and `StoreMoveConfirm.tsx` supplies only the
  store-change **body**. [169](169-below-availability-accepted.md) mounts the same sheet with a body
  of its own; the marker is `pendingConfirmation.kind`, so the drive can see both kinds arriving
  through the same element. That split is the ticket's *"reused verbatim … a second confirmation
  mechanism would be a defect"*, made mechanical instead of aspirational.
- **The re-preview is bounded by the thing that raises it.** `CONFIRM_TOKEN_STALE` only ever answers
  a send that CARRIED a token, and the re-send carries none — so the page re-previews only when
  `move.confirmToken` was set, and a server answering the same code to a token-less send falls
  through to the ordinary failure surface. Without that condition, "it cannot loop" was a comment
  rather than a guarantee, on a verb that re-prices a live basket.
- **`CONFIRM_TOKEN_INVALID` re-previews too**, deliberately. Expired and already-used both mean *this
  token cannot commit*, and the only safe answer to that is a diff the agent can look at again. The
  two get different copy because *your preview went stale* and *your preview expired* are different
  facts to the agent.
- 🚩 **A preview that already names an unpriceable line offers no commit.** `unpriceableLines[]`
  rides the preview *and* the refusal by contract (§5.1), so the refusal is knowable before the round
  trip — fixture 06's own note says so. Pressing a button whose only possible answer is
  `REBIND_REFUSED` would be making the agent discover the refusal. The 409 path still exists and is
  driven (box 29): it is the case where the basket moved between the preview and the commit.
- **The refusal is drawn twice from one source.** `rebindRefusal()` reads the offending lines off the
  refusal envelope (`ApiError.data`, which `core/api.ts` carries) and falls back to the preview the
  agent was just shown. Fixture 06's note that core *drops* `data` is out of date; both paths are
  covered anyway, because neither source may be the only one the banner can name a line from.
- **The delivery fee is part of the diff.** It is recomputed at the new plant (§2.2), so
  `moneyStandsStill` counts it — a sheet that said *no line changes price* while the fee moved would
  be telling the agent the caller pays the same when they do not.
- **The chip is the way back in.** 166 deferred clickable chips; the store chip becomes one here
  (135's progressive collapse — a settled section re-opens in place), gated on
  `capabilities.canChangeStore` so a chip with nowhere to go stays a `<span>` rather than a disabled
  control. Slot, source and reference get theirs at [173](173-header-complete-before-submit.md).
- **`StorePicker` reads the estate when it is opened**, from the existing shared `StoreDetails`
  lookup, unfiltered (§2.2 — the door refuses what it will not do). Its 40-row display cap **states
  the count it is not showing**; a list that quietly stopped would read as "your branch is not in the
  estate".
- **Not built, deliberately.** `setFulfilment`'s `PickInStore` path (154/v1.1) reaches this same
  rebind through `setAddress`'s existing rule and needs nothing here. The chips for slot, source and
  reference stay inert — their sections do not exist until 173, and three i18n keys with no call site
  were removed rather than left waiting.
