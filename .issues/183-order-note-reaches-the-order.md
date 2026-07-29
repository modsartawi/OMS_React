---
status: done
spec: 180
blocked-by: —
---

# 183 — theOrderNoteReachesTheOrder

## What to build

The agent types what the caller told them and it travels with the order.
[175](175-nothing-enters-an-unaddressed-order.md) ruled the order note **in**; nobody built it, and
`api.ts` has no `setOrderNote`.

A chip like every other header field — it opens a modal, takes free text, and saves. Clearing it
(sending `null`) is a real act, so a stale instruction never travels with the order. It carries no
submit blocker: an order with no note is an ordinary order.

The sidecar's `OrderNote` column is BackOffice [871](C:\Work\DMSCO\BackOffice\.issues\871-cc-opening-gate-and-plant-source.md)'s
one new column, so this slice is genuinely one field wide on both sides.

## Spine reach

model (`header.orderNote`, already present) · api (`setOrderNote`) · logic (`header-chips`) ·
component (page wiring + a small form) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `header-chips` — the note chip carries its text when set and reads as unset when `null`;
      it never contributes a submit blocker · pure — `header-chips.test.ts`, two boxes: the text
      round-trips and `null`/`''`/whitespace all read *unset*; and no blocker code the contract
      names (all nine, listed) can mark the chip.
- [x] `callcenter-drive.mjs` extension — typing a note, reloading, and reading it back; then
      clearing it and confirming it is gone rather than blank-but-present · flow (Playwright) —
      scenario **38c**, 11 boxes, `502/502 passed`. Two new stub options carry it: `staysOpen`
      (every Open after the first answers `refusedExisting`, which is what a reload really meets
      under law 9 — so the read-back goes through *Resume* → `GET State`, the console's own
      recovery verb) and `statePersists` (`State` answers with the state the stub has been
      mutating rather than the opening fixture, so a purely client-side note cannot pass). The
      second tab is handed the same stub — a new page with no route of its own would reach the
      real proxy, and a different stub would prove nothing about what the order holds.

## As built

- `api.ts` — `setOrderNote(transactionId, requestId, note: string | null)`; `null` CLEARS.
- `header-chips.ts` — a **`note`** chip, LAST, after the coupon: the row now ends with the two
  chips an order need never fill. Blank in any form (`null`, `''`, whitespace) reads *unset*, so a
  cleared note never draws as settled-and-blank.
- `NoteForm.tsx` — a textarea, *Save*, and a *Clear* offered only where there is something to
  clear. Emptying the box and saving reaches the same verb with the same `null` — one act, two
  doors into it. No client-side length rule: the column is `NVARCHAR(MAX)`.
- `CallCenterConsolePage.tsx` — the `orderNote` mutation (one `requestId` per act, minted outside
  the thunk, `runGuarded` for the busy retry) + the chip opener, gated on the order being open,
  like the slot and source sections. No capability of its own (§2 lists none).
- `ConsoleShell.tsx` — `onChangeNote` through to the chip row; the chip's value span is clamped
  (`max-w-[16rem] truncate`) because one chip's value is now free text of any length. A rendering
  limit only — the text is intact in the DOM.
- i18n — `chips.note`, `chips.change.note`, and the `note.*` block.

**Review (standards + spec, both axes on the commit itself)** — no rule violated (envelope,
zero-literal, logical utilities, feature shape all clean). Two findings taken and fixed:
🚩 a header carrying `'   '` was the ONE state the console could not clear — the chip read it as
unset so nothing looked outstanding, while *Save* sat disabled because the trimmed forms matched
and *Clear* was hidden for the same reason. *Empty but present* is the exact residue this slice
exists to remove, so `changed` now compares what would be SENT against what the order LITERALLY
holds, and *Clear* is offered wherever the header holds anything at all. And the chip clamp's
comment was corrected: it applies to every chip, deliberately — a branch name long enough to do
the same damage would otherwise be a second bug waiting. Left as built: *Save* disabled when
nothing changed (an act that would send what the order already holds is not a correction), and
the ends-only trim, which is what makes an emptied box, a spaces-only box and *Clear* one act.

⚠ **Server-side is BackOffice 871** (the `OrderNote` column + the `SetOrderNote` verb). This slice
is driven against the stub; nothing was verified against a live SIS.Api.

## Boundaries

**Server:** BackOffice 871 (contract v1.3's remaining verb). Envelope codes: `SESSION_CLOSED`,
`SESSION_BUSY` (existing retry).
**i18n:** existing namespace; chip label, modal title, placeholder, save/clear.

## Done when

A note typed in the running app survives a refresh and a second tab, and clearing it removes it
rather than leaving an empty string.

## Blocked by

None — can start immediately.
