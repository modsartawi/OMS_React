---
status: open
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

- [ ] `oneActionKeepsOneRequestId` — pure: an action mints one ULID, a retry of it reuses that id,
      the confirm re-send reuses it, and only a genuinely new action mints a new one · pure
- [ ] `aStoreMoveIsPreviewedThenCommitted` — drive: a store change on a basket with lines returns the
      **unchanged** state plus a modal naming the diff; accepting commits exactly what was previewed;
      a stale token re-previews instead of committing · flow (Playwright, extends
      `tools/callcenter-drive.mjs`, over fixtures `05` and `06`)
- [ ] `aRefusedRebindChangesNothingAndSaysWhichLine` — drive: `REBIND_REFUSED` renders the banner,
      tints the named line, and leaves the basket byte-identical · flow

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
